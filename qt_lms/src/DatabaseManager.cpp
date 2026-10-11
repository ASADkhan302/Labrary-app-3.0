#include "DatabaseManager.h"
#include <QStandardPaths>
#include <QDir>
#include <QCoreApplication>
#include <QDateTime>
#include <QDebug>
#include <QDate>
#include <QFile>
#include <QTextStream>
#include <QRegularExpression>
#include <cmath>

DatabaseManager& DatabaseManager::instance() {
    static DatabaseManager inst;
    return inst;
}

DatabaseManager::DatabaseManager(QObject *parent)
    : QObject(parent)
{
}

DatabaseManager::~DatabaseManager() {
    closeDatabase();
    releaseDatabaseLock();
}

QString DatabaseManager::getConfigIniPath() {
    QString appData = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir dir(appData);
    if (!dir.exists()) {
        dir.mkpath(".");
    }
    return QDir::toNativeSeparators(dir.filePath("config.ini"));
}

QString DatabaseManager::getSavedDatabasePath() {
    QSettings settings(getConfigIniPath(), QSettings::IniFormat);
    return settings.value("Storage/database_path", QString()).toString();
}

QString DatabaseManager::getSavedFolderPath() {
    QSettings settings(getConfigIniPath(), QSettings::IniFormat);
    return settings.value("Storage/folder_path", QString()).toString();
}

bool DatabaseManager::saveConfig(const QString &folderPath, const QString &dbPath) {
    QSettings settings(getConfigIniPath(), QSettings::IniFormat);
    settings.setValue("Storage/folder_path", QDir::toNativeSeparators(folderPath));
    settings.setValue("Storage/database_path", QDir::toNativeSeparators(dbPath));
    settings.setValue("Storage/last_configured", QDateTime::currentDateTime().toString(Qt::ISODate));
    settings.sync();
    return (settings.status() == QSettings::NoError);
}

bool DatabaseManager::acquireDatabaseLock(const QString &folderPath, QString &errorMessage) {
    releaseDatabaseLock();

    QString lockPath = QDir::toNativeSeparators(folderPath + "/ULM_Library.db.lock");
    m_lockFile = new QFile(lockPath, this);
    if (!m_lockFile->open(QIODevice::ReadWrite)) {
        errorMessage = "Database is locked by another instance of ULM LMS on this or another workstation.";
        delete m_lockFile;
        m_lockFile = nullptr;
        return false;
    }

    // Write lock metadata
    QByteArray info = QString("Locked by PID %1 at %2\n")
        .arg(QCoreApplication::applicationPid())
        .arg(QDateTime::currentDateTime().toString(Qt::ISODate))
        .toUtf8();
    m_lockFile->write(info);
    m_lockFile->flush();

    return true;
}

void DatabaseManager::releaseDatabaseLock() {
    if (m_lockFile) {
        if (m_lockFile->isOpen()) {
            m_lockFile->close();
            m_lockFile->remove();
        }
        delete m_lockFile;
        m_lockFile = nullptr;
    }
}

bool DatabaseManager::initializeStorage(const QString &folderPath, const QString &dbPath, QString &errorMessage) {
    QDir dir(folderPath);
    if (!dir.exists()) {
        if (!dir.mkpath(".")) {
            errorMessage = QString("Cannot create directory at: %1").arg(folderPath);
            return false;
        }
    }

    if (!dir.exists("Backups")) {
        dir.mkpath("Backups");
    }

    if (!acquireDatabaseLock(folderPath, errorMessage)) {
        return false;
    }

    if (!openDatabase(dbPath)) {
        errorMessage = QString("Failed to open SQLite database: %1").arg(m_db.lastError().text());
        releaseDatabaseLock();
        return false;
    }

    saveConfig(folderPath, dbPath);
    return true;
}

bool DatabaseManager::moveDatabaseToNewFolder(const QString &newFolderPath, QString &oldLocationKept, QString &errorMessage) {
    if (!m_db.isOpen()) {
        errorMessage = "Database is not currently open.";
        return false;
    }

    QDir targetDir(newFolderPath);
    if (!targetDir.exists()) {
        if (!targetDir.mkpath(".")) {
            errorMessage = QString("Cannot create target directory: %1").arg(newFolderPath);
            return false;
        }
    }
    if (!targetDir.exists("Backups")) {
        targetDir.mkpath("Backups");
    }

    QString newDbPath = QDir::toNativeSeparators(newFolderPath + "/ULM_Library.db");
    QFile existingFile(newDbPath);
    if (existingFile.exists()) {
        errorMessage = "A database file already exists in the chosen destination folder. Please choose another folder or open the existing file.";
        return false;
    }

    // 1. Safety backup in existing folder prior to move
    QString safetyBackup = QDir::toNativeSeparators(m_currentFolderPath + "/Backups/safety_backup_pre_move_" + QDateTime::currentDateTime().toString("yyyyMMdd_hhmmss") + ".db");
    backupDatabase(safetyBackup);

    // 2. Count current records for post-move verification
    int expectedBooks = 0;
    int expectedBorrowers = 0;
    {
        QSqlQuery q(m_db);
        if (q.exec("SELECT COUNT(*) FROM books WHERE is_active = 1;") && q.next()) {
            expectedBooks = q.value(0).toInt();
        }
        if (q.exec("SELECT COUNT(*) FROM borrowers WHERE is_active = 1;") && q.next()) {
            expectedBorrowers = q.value(0).toInt();
        }
    }

    // 3. Copy via SQLite VACUUM INTO (never plain file copy while database is live)
    {
        QSqlQuery q(m_db);
        QString escaped = QDir::fromNativeSeparators(newDbPath);
        escaped.replace("'", "''");
        QString sql = QString("VACUUM INTO '%1';").arg(escaped);
        if (!q.exec(sql)) {
            errorMessage = QString("VACUUM INTO copy failed: %1").arg(q.lastError().text());
            return false;
        }
    }

    // 4. Verify record counts in the new copy
    int verifiedBooks = 0;
    int verifiedBorrowers = 0;
    {
        QString verifyConn = "verify_move_" + QString::number(QDateTime::currentMSecsSinceEpoch());
        QSqlDatabase verifyDb = QSqlDatabase::addDatabase("QSQLITE", verifyConn);
        verifyDb.setDatabaseName(newDbPath);
        if (!verifyDb.open()) {
            errorMessage = "Failed to open new copy for verification.";
            QFile::remove(newDbPath);
            QSqlDatabase::removeDatabase(verifyConn);
            return false;
        }

        QSqlQuery q(verifyDb);
        if (q.exec("PRAGMA integrity_check;") && q.next()) {
            if (q.value(0).toString() != "ok") {
                errorMessage = "Integrity check failed on the newly copied database.";
                verifyDb.close();
                QFile::remove(newDbPath);
                QSqlDatabase::removeDatabase(verifyConn);
                return false;
            }
        }

        if (q.exec("SELECT COUNT(*) FROM books WHERE is_active = 1;") && q.next()) {
            verifiedBooks = q.value(0).toInt();
        }
        if (q.exec("SELECT COUNT(*) FROM borrowers WHERE is_active = 1;") && q.next()) {
            verifiedBorrowers = q.value(0).toInt();
        }

        verifyDb.close();
        QSqlDatabase::removeDatabase(verifyConn);
    }

    if (verifiedBooks != expectedBooks || verifiedBorrowers != expectedBorrowers) {
        errorMessage = QString("Verification mismatch: expected %1 books and %2 borrowers, found %3 books and %4 borrowers.")
            .arg(expectedBooks).arg(expectedBorrowers).arg(verifiedBooks).arg(verifiedBorrowers);
        QFile::remove(newDbPath);
        return false;
    }

    // 5. Success: Switch to new location, keep the old one intact
    oldLocationKept = m_currentDbPath;

    closeDatabase();
    releaseDatabaseLock();

    QString lockErr;
    if (!acquireDatabaseLock(newFolderPath, lockErr)) {
        errorMessage = QString("Failed to lock new repository: %1").arg(lockErr);
        // Fallback reopen old
        openDatabase(oldLocationKept);
        return false;
    }

    if (!openDatabase(newDbPath)) {
        errorMessage = "Failed to mount new database copy.";
        openDatabase(oldLocationKept);
        return false;
    }

    saveConfig(newFolderPath, newDbPath);
    return true;
}

bool DatabaseManager::switchDatabase(const QString &newDbPath, QString &errorMessage) {
    QFileInfo fi(newDbPath);
    if (!fi.exists() || !fi.isFile()) {
        errorMessage = "Database file does not exist.";
        return false;
    }

    QString folderPath = QDir::toNativeSeparators(fi.absolutePath());

    // Verify file integrity
    {
        QString testConn = "test_switch_" + QString::number(QDateTime::currentMSecsSinceEpoch());
        QSqlDatabase testDb = QSqlDatabase::addDatabase("QSQLITE", testConn);
        testDb.setDatabaseName(newDbPath);
        if (!testDb.open()) {
            errorMessage = QString("Cannot open SQLite file: %1").arg(testDb.lastError().text());
            QSqlDatabase::removeDatabase(testConn);
            return false;
        }
        QSqlQuery q(testDb);
        if (q.exec("PRAGMA integrity_check;") && q.next()) {
            if (q.value(0).toString() != "ok") {
                errorMessage = "Integrity check failed on database file.";
                testDb.close();
                QSqlDatabase::removeDatabase(testConn);
                return false;
            }
        }
        testDb.close();
        QSqlDatabase::removeDatabase(testConn);
    }

    closeDatabase();
    releaseDatabaseLock();

    QString lockErr;
    if (!acquireDatabaseLock(folderPath, lockErr)) {
        errorMessage = lockErr;
        return false;
    }

    if (!openDatabase(newDbPath)) {
        errorMessage = "Failed to open selected database.";
        return false;
    }

    saveConfig(folderPath, newDbPath);
    return true;
}

bool DatabaseManager::openDatabase(const QString &customPath) {
    if (m_db.isOpen()) return true;

    m_db = QSqlDatabase::addDatabase("QSQLITE");

    QString dbPath = customPath;
    if (dbPath.isEmpty()) {
        dbPath = getSavedDatabasePath();
    }
    if (dbPath.isEmpty()) {
        QString appDir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
        QDir dir(appDir);
        if (!dir.exists()) {
            dir.mkpath(".");
        }
        dbPath = dir.filePath("ulm_library.db");
    }

    dbPath = QDir::toNativeSeparators(dbPath);
    m_currentDbPath = dbPath;
    QFileInfo fi(dbPath);
    m_currentFolderPath = QDir::toNativeSeparators(fi.absolutePath());

    m_db.setDatabaseName(dbPath);

    if (!m_db.open()) {
        qCritical() << "Failed to open database:" << m_db.lastError().text();
        return false;
    }

    // High performance PRAGMAs for 100k+ records
    QSqlQuery q(m_db);
    q.exec("PRAGMA foreign_keys = ON;");
    q.exec("PRAGMA journal_mode = WAL;");
    q.exec("PRAGMA synchronous = NORMAL;");
    q.exec("PRAGMA cache_size = -64000;"); // 64 MB RAM cache
    q.exec("PRAGMA temp_store = MEMORY;");

    if (!runMigrations()) {
        qCritical() << "Failed to run migrations.";
        return false;
    }

    // Run automated startup backup (keeping last 14)
    runAutomaticStartupBackup();

    // Check if initial seed is needed
    if (!isDemoDataPresent()) {
        seedDemoData();
    }

    return true;
}

void DatabaseManager::closeDatabase() {
    if (m_db.isOpen()) {
        m_db.close();
    }
}

bool DatabaseManager::runMigrations() {
    QSqlQuery q(m_db);
    if (!q.exec("PRAGMA user_version;")) return false;
    
    int currentVersion = 0;
    if (q.next()) {
        currentVersion = q.value(0).toInt();
    }

    if (currentVersion < 1) {
        if (!m_db.transaction()) return false;

        // 1. Books Table (ONE ROW = ONE PHYSICAL COPY)
        bool ok = q.exec(
            "CREATE TABLE IF NOT EXISTS books ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  accession_no INTEGER UNIQUE NOT NULL,"
            "  barcode TEXT UNIQUE NOT NULL,"
            "  author TEXT,"
            "  title TEXT NOT NULL,"
            "  edition TEXT,"
            "  place TEXT,"
            "  publisher TEXT,"
            "  year INTEGER,"
            "  pages TEXT,"
            "  price_paisa INTEGER,"
            "  binding TEXT DEFAULT 'HB',"
            "  binding_code TEXT,"
            "  isbn TEXT,"
            "  source_remarks TEXT,"
            "  category TEXT,"
            "  dewey_call_number TEXT,"
            "  shelf TEXT,"
            "  status TEXT DEFAULT 'available',"
            "  is_active INTEGER DEFAULT 1,"
            "  created_at TEXT,"
            "  updated_at TEXT"
            ");"
        );
        if (!ok) { m_db.rollback(); return false; }

        // Indexes for 100k+ speed
        q.exec("CREATE INDEX IF NOT EXISTS idx_books_acc ON books(accession_no);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_books_barcode ON books(barcode);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_books_cat ON books(category);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);");

        // 2. Borrowers Table (Full People Schema)
        ok = q.exec(
            "CREATE TABLE IF NOT EXISTS borrowers ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  role TEXT NOT NULL DEFAULT 'Student',"
            "  university_id TEXT UNIQUE NOT NULL,"
            "  barcode TEXT UNIQUE NOT NULL,"
            "  name TEXT NOT NULL,"
            "  father_name TEXT,"
            "  department TEXT,"
            "  program TEXT,"
            "  session TEXT,"
            "  semester INTEGER DEFAULT 1,"
            "  designation TEXT,"
            "  email TEXT,"
            "  phone TEXT,"
            "  address TEXT,"
            "  photo_path TEXT,"
            "  borrow_limit INTEGER DEFAULT 3,"
            "  joined_date TEXT,"
            "  valid_until TEXT,"
            "  status TEXT DEFAULT 'active',"
            "  notes TEXT,"
            "  is_active INTEGER DEFAULT 1,"
            "  created_at TEXT,"
            "  updated_at TEXT"
            ");"
        );
        if (!ok) { m_db.rollback(); return false; }
        q.exec("CREATE INDEX IF NOT EXISTS idx_borrowers_uid ON borrowers(university_id);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_borrowers_barcode ON borrowers(barcode);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_borrowers_role ON borrowers(role);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_borrowers_status ON borrowers(status);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_borrowers_dept ON borrowers(department);");

        // 3. Transactions Table
        ok = q.exec(
            "CREATE TABLE IF NOT EXISTS transactions ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  book_id INTEGER NOT NULL REFERENCES books(id),"
            "  borrower_id INTEGER NOT NULL REFERENCES borrowers(id),"
            "  issue_date TEXT NOT NULL,"
            "  due_date TEXT NOT NULL,"
            "  return_date TEXT,"
            "  fine_paid_paisa INTEGER DEFAULT 0"
            ");"
        );
        if (!ok) { m_db.rollback(); return false; }
        q.exec("CREATE INDEX IF NOT EXISTS idx_trans_book ON transactions(book_id);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_trans_borrower ON transactions(borrower_id);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_trans_due ON transactions(due_date);");

        // 4. Settings Table
        ok = q.exec(
            "CREATE TABLE IF NOT EXISTS settings ("
            "  key TEXT PRIMARY KEY,"
            "  value TEXT"
            ");"
        );
        if (!ok) { m_db.rollback(); return false; }

        // 5. Audit Log Table
        ok = q.exec(
            "CREATE TABLE IF NOT EXISTS audit_log ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  username TEXT,"
            "  action TEXT,"
            "  details TEXT,"
            "  timestamp TEXT"
            ");"
        );
        if (!ok) { m_db.rollback(); return false; }

        // 6. FTS5 Virtual Table for Instant Search
        m_hasFts5 = q.exec(
            "CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5("
            "  title, author, isbn, barcode, accession_no, dewey_call_number, shelf,"
            "  content='books', content_rowid='id'"
            ");"
        );

        if (m_hasFts5) {
            q.exec(
                "CREATE TRIGGER IF NOT EXISTS books_ai AFTER INSERT ON books BEGIN"
                "  INSERT INTO books_fts(rowid, title, author, isbn, barcode, accession_no, dewey_call_number, shelf)"
                "  VALUES (new.id, new.title, new.author, new.isbn, new.barcode, new.accession_no, new.dewey_call_number, new.shelf);"
                "END;"
            );
            q.exec(
                "CREATE TRIGGER IF NOT EXISTS books_ad AFTER DELETE ON books BEGIN"
                "  INSERT INTO books_fts(books_fts, rowid, title, author, isbn, barcode, accession_no, dewey_call_number, shelf)"
                "  VALUES ('delete', old.id, old.title, old.author, old.isbn, old.barcode, old.accession_no, old.dewey_call_number, old.shelf);"
                "END;"
            );
            q.exec(
                "CREATE TRIGGER IF NOT EXISTS books_au AFTER UPDATE ON books BEGIN"
                "  INSERT INTO books_fts(books_fts, rowid, title, author, isbn, barcode, accession_no, dewey_call_number, shelf)"
                "  VALUES ('delete', old.id, old.title, old.author, old.isbn, old.barcode, old.accession_no, old.dewey_call_number, old.shelf);"
                "  INSERT INTO books_fts(rowid, title, author, isbn, barcode, accession_no, dewey_call_number, shelf)"
                "  VALUES (new.id, new.title, new.author, new.isbn, new.barcode, new.accession_no, new.dewey_call_number, new.shelf);"
                "END;"
            );
        }

        // Set default settings
        q.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('institution_name', 'University of Lakki Marwat');");
        q.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('library_name', 'Central Campus Library');");
        q.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('workstation_id', 'WS-ULM-01');");
        q.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('loan_period_days', '14');");
        q.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('fine_rate_paisa', '5000');"); // Rs 50/day
        q.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('max_unpaid_fine_paisa', '50000');"); // Rs 500 limit
        q.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('grace_days', '0');");
        q.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('audio_enabled', 'true');");

        q.exec("PRAGMA user_version = 2;");
        m_db.commit();
    } else if (currentVersion < 2) {
        // Migration v2: Alter existing borrowers table to support full People schema
        if (!m_db.transaction()) return false;

        QStringList alterQueries = {
            "ALTER TABLE borrowers ADD COLUMN barcode TEXT;",
            "ALTER TABLE borrowers ADD COLUMN father_name TEXT;",
            "ALTER TABLE borrowers ADD COLUMN program TEXT;",
            "ALTER TABLE borrowers ADD COLUMN session TEXT;",
            "ALTER TABLE borrowers ADD COLUMN semester INTEGER DEFAULT 1;",
            "ALTER TABLE borrowers ADD COLUMN designation TEXT;",
            "ALTER TABLE borrowers ADD COLUMN address TEXT;",
            "ALTER TABLE borrowers ADD COLUMN photo_path TEXT;",
            "ALTER TABLE borrowers ADD COLUMN valid_until TEXT;",
            "ALTER TABLE borrowers ADD COLUMN status TEXT DEFAULT 'active';",
            "ALTER TABLE borrowers ADD COLUMN notes TEXT;",
            "ALTER TABLE borrowers ADD COLUMN created_at TEXT;",
            "ALTER TABLE borrowers ADD COLUMN updated_at TEXT;"
        };

        for (const QString &sql : alterQueries) {
            q.exec(sql);
        }

        // Backfill barcode = university_id for existing rows
        q.exec("UPDATE borrowers SET barcode = university_id WHERE barcode IS NULL OR barcode = '';");
        q.exec("UPDATE borrowers SET status = 'active' WHERE status IS NULL OR status = '';");
        q.exec("UPDATE borrowers SET created_at = joined_date WHERE created_at IS NULL;");

        q.exec("CREATE INDEX IF NOT EXISTS idx_borrowers_barcode ON borrowers(barcode);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_borrowers_role ON borrowers(role);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_borrowers_status ON borrowers(status);");
        q.exec("CREATE INDEX IF NOT EXISTS idx_borrowers_dept ON borrowers(department);");

        q.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('max_unpaid_fine_paisa', '50000');");

        q.exec("PRAGMA user_version = 2;");
        m_db.commit();
    }

    return true;
}

int DatabaseManager::getNextAccessionNumber() {
    QSqlQuery q(m_db);
    q.exec("SELECT MAX(accession_no) FROM books;");
    if (q.next() && !q.value(0).isNull()) {
        return q.value(0).toInt() + 1;
    }
    return 10001;
}

bool DatabaseManager::addBook(Book &book) {
    if (!m_db.transaction()) return false;

    if (book.accession_no <= 0) {
        book.accession_no = getNextAccessionNumber();
    }
    if (book.barcode.isEmpty()) {
        book.barcode = Book::formatBarcode(book.accession_no);
    }

    QString now = QDateTime::currentDateTime().toString(Qt::ISODate);
    book.created_at = now;
    book.updated_at = now;

    QSqlQuery q(m_db);
    q.prepare(
        "INSERT INTO books ("
        "  accession_no, barcode, author, title, edition, place, publisher,"
        "  year, pages, price_paisa, binding, binding_code, isbn, source_remarks,"
        "  category, dewey_call_number, shelf, status, is_active, created_at, updated_at"
        ") VALUES ("
        "  :acc, :bar, :auth, :title, :ed, :place, :pub,"
        "  :yr, :pages, :price, :bind, :bcode, :isbn, :src,"
        "  :cat, :dewey, :shelf, :status, :act, :ca, :ua"
        ");"
    );
    q.bindValue(":acc", book.accession_no);
    q.bindValue(":bar", book.barcode);
    q.bindValue(":auth", book.author);
    q.bindValue(":title", book.title);
    q.bindValue(":ed", book.edition);
    q.bindValue(":place", book.place);
    q.bindValue(":pub", book.publisher);
    q.bindValue(":yr", book.year > 0 ? QVariant(book.year) : QVariant(QVariant::Int));
    q.bindValue(":pages", book.pages);
    q.bindValue(":price", book.price_paisa > 0 ? QVariant(book.price_paisa) : QVariant(QVariant::Int));
    q.bindValue(":bind", book.binding);
    q.bindValue(":bcode", book.binding_code);
    q.bindValue(":isbn", book.isbn);
    q.bindValue(":src", book.source_remarks);
    q.bindValue(":cat", book.category);
    q.bindValue(":dewey", book.dewey_call_number);
    q.bindValue(":shelf", book.shelf);
    q.bindValue(":status", book.status.isEmpty() ? "available" : book.status);
    q.bindValue(":act", book.is_active ? 1 : 0);
    q.bindValue(":ca", book.created_at);
    q.bindValue(":ua", book.updated_at);

    if (!q.exec()) {
        qWarning() << "Failed to insert book:" << q.lastError().text();
        m_db.rollback();
        return false;
    }

    book.id = q.lastInsertId().toInt();
    logAudit("ADD_BOOK", QString("Added accession #%1 - %2").arg(book.accession_no).arg(book.title));

    return m_db.commit();
}

bool DatabaseManager::updateBook(const Book &book) {
    if (!m_db.transaction()) return false;

    QString now = QDateTime::currentDateTime().toString(Qt::ISODate);

    QSqlQuery q(m_db);
    q.prepare(
        "UPDATE books SET"
        "  author = :auth, title = :title, edition = :ed, place = :place, publisher = :pub,"
        "  year = :yr, pages = :pages, price_paisa = :price, binding = :bind, binding_code = :bcode,"
        "  isbn = :isbn, source_remarks = :src, category = :cat, dewey_call_number = :dewey,"
        "  shelf = :shelf, status = :status, is_active = :act, updated_at = :ua"
        " WHERE id = :id;"
    );
    q.bindValue(":auth", book.author);
    q.bindValue(":title", book.title);
    q.bindValue(":ed", book.edition);
    q.bindValue(":place", book.place);
    q.bindValue(":pub", book.publisher);
    q.bindValue(":yr", book.year > 0 ? QVariant(book.year) : QVariant(QVariant::Int));
    q.bindValue(":pages", book.pages);
    q.bindValue(":price", book.price_paisa > 0 ? QVariant(book.price_paisa) : QVariant(QVariant::Int));
    q.bindValue(":bind", book.binding);
    q.bindValue(":bcode", book.binding_code);
    q.bindValue(":isbn", book.isbn);
    q.bindValue(":src", book.source_remarks);
    q.bindValue(":cat", book.category);
    q.bindValue(":dewey", book.dewey_call_number);
    q.bindValue(":shelf", book.shelf);
    q.bindValue(":status", book.status);
    q.bindValue(":act", book.is_active ? 1 : 0);
    q.bindValue(":ua", now);
    q.bindValue(":id", book.id);

    if (!q.exec()) {
        m_db.rollback();
        return false;
    }

    logAudit("EDIT_BOOK", QString("Updated book ID %1 - %2").arg(book.id).arg(book.title));
    return m_db.commit();
}

std::optional<Book> DatabaseManager::getBookById(int id) {
    QSqlQuery q(m_db);
    q.prepare("SELECT * FROM books WHERE id = :id;");
    q.bindValue(":id", id);
    if (q.exec() && q.next()) {
        Book b;
        b.id = q.value("id").toInt();
        b.accession_no = q.value("accession_no").toInt();
        b.barcode = q.value("barcode").toString();
        b.author = q.value("author").toString();
        b.title = q.value("title").toString();
        b.edition = q.value("edition").toString();
        b.place = q.value("place").toString();
        b.publisher = q.value("publisher").toString();
        b.year = q.value("year").toInt();
        b.pages = q.value("pages").toString();
        b.price_paisa = q.value("price_paisa").toInt();
        b.binding = q.value("binding").toString();
        b.binding_code = q.value("binding_code").toString();
        b.isbn = q.value("isbn").toString();
        b.source_remarks = q.value("source_remarks").toString();
        b.category = q.value("category").toString();
        b.dewey_call_number = q.value("dewey_call_number").toString();
        b.shelf = q.value("shelf").toString();
        b.status = q.value("status").toString();
        b.is_active = q.value("is_active").toInt() == 1;
        b.created_at = q.value("created_at").toString();
        b.updated_at = q.value("updated_at").toString();
        return b;
    }
    return std::nullopt;
}

std::optional<Book> DatabaseManager::getBookByBarcode(const QString &barcode) {
    QSqlQuery q(m_db);
    q.prepare("SELECT * FROM books WHERE barcode = :barcode LIMIT 1;");
    q.bindValue(":barcode", barcode.trimmed());
    if (q.exec() && q.next()) {
        Book b;
        b.id = q.value("id").toInt();
        b.accession_no = q.value("accession_no").toInt();
        b.barcode = q.value("barcode").toString();
        b.author = q.value("author").toString();
        b.title = q.value("title").toString();
        b.edition = q.value("edition").toString();
        b.place = q.value("place").toString();
        b.publisher = q.value("publisher").toString();
        b.year = q.value("year").toInt();
        b.pages = q.value("pages").toString();
        b.price_paisa = q.value("price_paisa").toInt();
        b.binding = q.value("binding").toString();
        b.binding_code = q.value("binding_code").toString();
        b.isbn = q.value("isbn").toString();
        b.source_remarks = q.value("source_remarks").toString();
        b.category = q.value("category").toString();
        b.dewey_call_number = q.value("dewey_call_number").toString();
        b.shelf = q.value("shelf").toString();
        b.status = q.value("status").toString();
        b.is_active = q.value("is_active").toInt() == 1;
        b.created_at = q.value("created_at").toString();
        b.updated_at = q.value("updated_at").toString();
        return b;
    }
    return std::nullopt;
}

std::optional<Book> DatabaseManager::getBookByAccessionNo(int accNo) {
    QSqlQuery q(m_db);
    q.prepare("SELECT * FROM books WHERE accession_no = :acc LIMIT 1;");
    q.bindValue(":acc", accNo);
    if (q.exec() && q.next()) {
        Book b;
        b.id = q.value("id").toInt();
        b.accession_no = q.value("accession_no").toInt();
        b.barcode = q.value("barcode").toString();
        b.author = q.value("author").toString();
        b.title = q.value("title").toString();
        b.edition = q.value("edition").toString();
        b.place = q.value("place").toString();
        b.publisher = q.value("publisher").toString();
        b.year = q.value("year").toInt();
        b.pages = q.value("pages").toString();
        b.price_paisa = q.value("price_paisa").toInt();
        b.binding = q.value("binding").toString();
        b.binding_code = q.value("binding_code").toString();
        b.isbn = q.value("isbn").toString();
        b.source_remarks = q.value("source_remarks").toString();
        b.category = q.value("category").toString();
        b.dewey_call_number = q.value("dewey_call_number").toString();
        b.shelf = q.value("shelf").toString();
        b.status = q.value("status").toString();
        b.is_active = q.value("is_active").toInt() == 1;
        b.created_at = q.value("created_at").toString();
        b.updated_at = q.value("updated_at").toString();
        return b;
    }
    return std::nullopt;
}

bool DatabaseManager::withdrawBook(int id) {
    QSqlQuery q(m_db);
    q.prepare("UPDATE books SET status = 'withdrawn', updated_at = :up WHERE id = :id;");
    q.bindValue(":up", QDateTime::currentDateTime().toString(Qt::ISODate));
    q.bindValue(":id", id);
    if (q.exec()) {
        logAudit("WITHDRAW_BOOK", QString("Marked copy ID %1 as withdrawn").arg(id));
        return true;
    }
    return false;
}

bool DatabaseManager::hasLoanHistory(int bookId) {
    QSqlQuery q(m_db);
    q.prepare("SELECT COUNT(*) FROM transactions WHERE book_id = :id;");
    q.bindValue(":id", bookId);
    if (q.exec() && q.next()) {
        return q.value(0).toInt() > 0;
    }
    return false;
}

bool DatabaseManager::hasDuplicateIsbn(const QString &isbn, int excludeId) {
    if (isbn.trimmed().isEmpty()) return false;
    QSqlQuery q(m_db);
    q.prepare("SELECT COUNT(*) FROM books WHERE isbn = :isbn AND id != :ex AND is_active = 1;");
    q.bindValue(":isbn", isbn.trimmed());
    q.bindValue(":ex", excludeId);
    if (q.exec() && q.next()) {
        return q.value(0).toInt() > 0;
    }
    return false;
}

QStringList DatabaseManager::getDistinctAuthors() {
    QStringList list;
    QSqlQuery q(m_db);
    q.exec("SELECT DISTINCT author FROM books WHERE author IS NOT NULL AND author != '' ORDER BY author ASC LIMIT 100;");
    while (q.next()) {
        list << q.value(0).toString();
    }
    return list;
}

QStringList DatabaseManager::getDistinctPublishers() {
    QStringList list;
    QSqlQuery q(m_db);
    q.exec("SELECT DISTINCT publisher FROM books WHERE publisher IS NOT NULL AND publisher != '' ORDER BY publisher ASC LIMIT 100;");
    while (q.next()) {
        list << q.value(0).toString();
    }
    return list;
}

QStringList DatabaseManager::getDistinctPlaces() {
    QStringList list;
    QSqlQuery q(m_db);
    q.exec("SELECT DISTINCT place FROM books WHERE place IS NOT NULL AND place != '' ORDER BY place ASC LIMIT 50;");
    while (q.next()) {
        list << q.value(0).toString();
    }
    return list;
}

QStringList DatabaseManager::getDistinctCategories() {
    QStringList list;
    QSqlQuery q(m_db);
    q.exec("SELECT DISTINCT category FROM books WHERE category IS NOT NULL AND category != '' ORDER BY category ASC;");
    while (q.next()) {
        list << q.value(0).toString();
    }
    return list;
}

QString DatabaseManager::getSetting(const QString &key, const QString &defaultValue) {
    QSqlQuery q(m_db);
    q.prepare("SELECT value FROM settings WHERE key = :key;");
    q.bindValue(":key", key);
    if (q.exec() && q.next()) {
        return q.value(0).toString();
    }
    return defaultValue;
}

bool DatabaseManager::setSetting(const QString &key, const QString &value) {
    QSqlQuery q(m_db);
    q.prepare("INSERT INTO settings (key, value) VALUES (:k, :v) ON CONFLICT(key) DO UPDATE SET value = :v;");
    q.bindValue(":k", key);
    q.bindValue(":v", value);
    return q.exec();
}

void DatabaseManager::logAudit(const QString &action, const QString &details, const QString &user) {
    QSqlQuery q(m_db);
    q.prepare("INSERT INTO audit_log (username, action, details, timestamp) VALUES (:u, :a, :d, :t);");
    q.bindValue(":u", user);
    q.bindValue(":a", action);
    q.bindValue(":d", details);
    q.bindValue(":t", QDateTime::currentDateTime().toString(Qt::ISODate));
    q.exec();
}

bool DatabaseManager::isDemoDataPresent() {
    QSqlQuery q(m_db);
    q.exec("SELECT COUNT(*) FROM books WHERE source_remarks = 'DEMO';");
    if (q.next()) {
        return q.value(0).toInt() > 0;
    }
    return false;
}

void DatabaseManager::seedDemoData() {
    if (!m_db.transaction()) return;

    struct SeedItem {
        int acc;
        const char* title;
        const char* author;
        const char* edition;
        const char* place;
        const char* publisher;
        int year;
        const char* pages;
        int price;
        const char* bind;
        const char* bcode;
        const char* isbn;
        const char* cat;
        const char* callNo;
        const char* shelf;
    };

    SeedItem books[] = {
        {10001, "Introduction to Algorithms", "Thomas H. Cormen, Charles E. Leiserson", "3rd", "Cambridge, MA", "MIT Press", 2009, "1292", 1250000, "HB", "01", "9780262033848", "Computer Science", "005.133 COR", "CS-01-A"},
        {10002, "Introduction to Algorithms", "Thomas H. Cormen, Charles E. Leiserson", "3rd", "Cambridge, MA", "MIT Press", 2009, "1292", 1250000, "HB", "01", "9780262033848", "Computer Science", "005.133 COR", "CS-01-A"},
        {10003, "Clean Code: A Handbook of Agile Software Craftsmanship", "Robert C. Martin", "1st", "Boston", "Prentice Hall", 2008, "464", 620000, "SB", "02", "9780132350884", "Computer Science", "005.1 MAR", "CS-01-B"},
        {10004, "Design Patterns: Elements of Reusable Object-Oriented Software", "Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides", "1st", "Reading, MA", "Addison-Wesley", 1994, "395", 740000, "HB", "01", "9780201633610", "Computer Science", "005.12 GAM", "CS-02-A"},
        {10005, "The C++ Programming Language", "Bjarne Stroustrup", "4th", "Upper Saddle River", "Addison-Wesley", 2013, "1368", 1120000, "SB", "02", "9780321563842", "Computer Science", "005.133 STR", "CS-02-B"},
        {10006, "Database System Concepts", "Abraham Silberschatz, Henry F. Korth", "7th", "New York", "McGraw-Hill", 2019, "1376", 1350000, "HB", "01", "9780078022159", "Computer Science", "005.74 SIL", "CS-03-A"},
        {10007, "University Physics with Modern Physics", "Hugh D. Young, Roger A. Freedman", "14th", "San Francisco", "Pearson", 2015, "1600", 1540000, "HB", "01", "9780321973610", "Physics", "530.1 YOU", "SCI-01-A"},
        {10008, "Classical Electrodynamics", "John David Jackson", "3rd", "New York", "Wiley", 1998, "832", 980000, "HB", "01", "9780471309321", "Physics", "537.6 JAC", "SCI-01-B"},
        {10009, "Calculus: Early Transcendentals", "James Stewart", "8th", "Boston", "Cengage Learning", 2015, "1368", 1180000, "HB", "01", "9781285741550", "Mathematics", "515.1 STE", "MATH-01-A"},
        {10010, "Calculus: Early Transcendentals", "James Stewart", "8th", "Boston", "Cengage Learning", 2015, "1368", 1180000, "HB", "01", "9781285741550", "Mathematics", "515.1 STE", "MATH-01-A"},
        {10011, "Organic Chemistry", "Paula Yurkanis Bruice", "8th", "Boston", "Pearson", 2016, "1344", 1290000, "HB", "01", "9780134042282", "Chemistry", "547 BRU", "SCI-02-A"},
        {10012, "Principles of Biochemistry", "David L. Nelson, Michael M. Cox", "7th", "New York", "W. H. Freeman", 2017, "1328", 1420000, "HB", "01", "9781464126116", "Chemistry", "572 NEL", "SCI-02-B"},
        {10013, "Constitutional Law of Pakistan", "Hamid Khan", "4th", "Karachi", "Oxford University Press", 2017, "1120", 450000, "HB", "01", "9780199405626", "Law", "342.549 KHA", "LAW-01-A"},
        {10014, "Principles of Muhammadan Law", "Sir Dinshah Fardunji Mulla", "20th", "Lahore", "Mansoor Book House", 2010, "580", 250000, "HB", "01", "9789694480022", "Law", "340.59 MUL", "LAW-01-B"},
        {10015, "A History of Islamic Societies", "Ira M. Lapidus", "3rd", "Cambridge", "Cambridge University Press", 2014, "1020", 890000, "SB", "02", "9780521732970", "Islamic Studies", "297.09 LAP", "ISL-01-A"},
        {10016, "English Grammar in Use", "Raymond Murphy", "5th", "Cambridge", "Cambridge University Press", 2019, "390", 280000, "SB", "02", "9781108457651", "English", "428.2 MUR", "ENG-01-A"},
        {10017, "Artificial Intelligence: A Modern Approach", "Stuart Russell, Peter Norvig", "4th", "Hoboken, NJ", "Pearson", 2020, "1152", 1450000, "HB", "01", "9780134610993", "Computer Science", "006.3 RUS", "CS-04-A"},
        {10018, "Computer Networking: A Top-Down Approach", "James F. Kurose, Keith W. Ross", "7th", "Boston", "Pearson", 2016, "864", 950000, "HB", "01", "9780133594140", "Computer Science", "004.6 KUR", "CS-04-B"},
        {10019, "Linear Algebra and Its Applications", "David C. Lay", "5th", "Boston", "Pearson", 2015, "576", 820000, "SB", "02", "9780321982384", "Mathematics", "512.5 LAY", "MATH-02-A"},
        {10020, "Pakistan: A New History", "Ian Talbot", "Updated", "Karachi", "Oxford University Press", 2015, "350", 180000, "SB", "02", "9780199401734", "History", "954.91 TAL", "HIS-01-A"}
    };

    QSqlQuery q(m_db);
    QString now = QDateTime::currentDateTime().toString(Qt::ISODate);

    for (const auto& b : books) {
        q.prepare(
            "INSERT OR IGNORE INTO books ("
            "  accession_no, barcode, author, title, edition, place, publisher,"
            "  year, pages, price_paisa, binding, binding_code, isbn, source_remarks,"
            "  category, dewey_call_number, shelf, status, is_active, created_at, updated_at"
            ") VALUES ("
            "  :acc, :bar, :auth, :title, :ed, :place, :pub,"
            "  :yr, :pages, :price, :bind, :bcode, :isbn, 'DEMO',"
            "  :cat, :dewey, :shelf, 'available', 1, :now, :now"
            ");"
        );
        q.bindValue(":acc", b.acc);
        q.bindValue(":bar", Book::formatBarcode(b.acc));
        q.bindValue(":auth", b.author);
        q.bindValue(":title", b.title);
        q.bindValue(":ed", b.edition);
        q.bindValue(":place", b.place);
        q.bindValue(":pub", b.publisher);
        q.bindValue(":yr", b.year);
        q.bindValue(":pages", b.pages);
        q.bindValue(":price", b.price);
        q.bindValue(":bind", b.bind);
        q.bindValue(":bcode", b.bcode);
        q.bindValue(":isbn", b.isbn);
        q.bindValue(":cat", b.cat);
        q.bindValue(":dewey", b.callNo);
        q.bindValue(":shelf", b.shelf);
        q.bindValue(":now", now);
        q.exec();
    }

    // Seed Borrowers (8 People with notes = "DEMO")
    struct SeedPerson {
        const char* name;
        const char* father;
        const char* uid;
        const char* role;
        const char* dept;
        const char* prog;
        const char* sess;
        int sem;
        const char* desig;
        const char* email;
        const char* phone;
        int limit;
    };

    SeedPerson people[] = {
        {"Muhammad Tariq Khan", "Gulzar Khan", "ULM-FA23-BCS-042", "Student", "Computer Science", "BCS", "FA23", 4, "", "tariq.cs@ulm.edu.pk", "0345-9876541", 3},
        {"Fatima Bibi", "Sher Zaman", "ULM-SP22-PHY-019", "Student", "Physics", "BS Physics", "SP22", 6, "", "fatima.phy@ulm.edu.pk", "0333-1234567", 3},
        {"Zubair Ahmad", "Mir Baz Khan", "ULM-FA21-LAW-088", "Student", "Law", "LLB", "FA21", 8, "", "zubair.law@ulm.edu.pk", "0312-9988776", 3},
        {"Ayesha Noor", "Akhtar Ali", "ULM-SP23-ENG-031", "Student", "English", "BS English", "SP23", 4, "", "ayesha.eng@ulm.edu.pk", "0346-6655443", 3},
        {"Dr. Asadullah Marwat", "", "ULM-FAC-CS-007", "Faculty", "Computer Science", "", "", 0, "Professor", "dr.asad@ulm.edu.pk", "0300-5551234", 10},
        {"Dr. Shahida Parveen", "", "ULM-FAC-MATH-012", "Faculty", "Mathematics", "", "", 0, "Associate Professor", "shahida.math@ulm.edu.pk", "0301-4447788", 10},
        {"Engr. Bilal Khan", "", "ULM-STF-LAB-003", "Staff", "Computer Science", "", "", 0, "Lab Engineer", "bilal.lab@ulm.edu.pk", "0334-7788990", 5},
        {"Qari Abdul Rehman", "", "ULM-STF-LIB-009", "Staff", "Islamic Studies", "", "", 0, "Assistant Librarian", "rehman.lib@ulm.edu.pk", "0321-3322110", 5}
    };

    for (const auto& p : people) {
        q.prepare(
            "INSERT OR IGNORE INTO borrowers ("
            "  role, university_id, barcode, name, father_name, department, program, session, semester,"
            "  designation, email, phone, address, photo_path, borrow_limit, joined_date, valid_until,"
            "  status, notes, is_active, created_at, updated_at"
            ") VALUES ("
            "  :r, :u, :b, :n, :fn, :d, :prog, :sess, :sem,"
            "  :desig, :e, :p, :addr, '', :l, :j, :v,"
            "  'active', 'DEMO', 1, :now, :now"
            ");"
        );
        q.bindValue(":r", p.role);
        q.bindValue(":u", p.uid);
        q.bindValue(":b", p.uid);
        q.bindValue(":n", p.name);
        q.bindValue(":fn", p.father);
        q.bindValue(":d", p.dept);
        q.bindValue(":prog", p.prog);
        q.bindValue(":sess", p.sess);
        q.bindValue(":sem", p.sem);
        q.bindValue(":desig", p.desig);
        q.bindValue(":e", p.email);
        q.bindValue(":p", p.phone);
        q.bindValue(":addr", "Main Campus, University of Lakki Marwat");
        q.bindValue(":l", p.limit);
        q.bindValue(":j", now);
        q.bindValue(":v", QDate::currentDate().addYears(2).toString(Qt::ISODate));
        q.bindValue(":now", now);
        q.exec();
    }

    // Seed Active Transactions (Relative to today so overdue loans guaranteed)
    QDate today = QDate::currentDate();
    
    // 1. Overdue loan (Issued 24 days ago, due 10 days ago)
    q.exec(
        QString("INSERT OR IGNORE INTO transactions (book_id, borrower_id, issue_date, due_date, return_date) "
                "VALUES (1, 1, '%1', '%2', NULL);")
        .arg(today.addDays(-24).toString(Qt::ISODate))
        .arg(today.addDays(-10).toString(Qt::ISODate))
    );
    q.exec("UPDATE books SET status = 'issued' WHERE id = 1;");

    // 2. Active on-time loan (Issued 5 days ago, due in 9 days)
    q.exec(
        QString("INSERT OR IGNORE INTO transactions (book_id, borrower_id, issue_date, due_date, return_date) "
                "VALUES (3, 3, '%1', '%2', NULL);")
        .arg(today.addDays(-5).toString(Qt::ISODate))
        .arg(today.addDays(9).toString(Qt::ISODate))
    );
    q.exec("UPDATE books SET status = 'issued' WHERE id = 3;");

    // 3. Severely Overdue loan (Issued 45 days ago, due 31 days ago)
    q.exec(
        QString("INSERT OR IGNORE INTO transactions (book_id, borrower_id, issue_date, due_date, return_date) "
                "VALUES (7, 2, '%1', '%2', NULL);")
        .arg(today.addDays(-45).toString(Qt::ISODate))
        .arg(today.addDays(-31).toString(Qt::ISODate))
    );
    q.exec("UPDATE books SET status = 'issued' WHERE id = 7;");

    m_db.commit();
}

bool DatabaseManager::clearDemoData() {
    if (!m_db.transaction()) return false;

    QSqlQuery q(m_db);
    q.exec("DELETE FROM transactions WHERE book_id IN (SELECT id FROM books WHERE source_remarks = 'DEMO');");
    q.exec("DELETE FROM books WHERE source_remarks = 'DEMO';");
    q.exec("DELETE FROM borrowers WHERE notes = 'DEMO';");

    logAudit("CLEAR_DEMO", "Purged all sample demo books and demo university borrowers (notes = 'DEMO')");
    return m_db.commit();
}

QString DatabaseManager::getPhotosFolderPath() const {
    QString folder = m_currentFolderPath;
    if (folder.isEmpty()) {
        folder = getSavedFolderPath();
    }
    if (folder.isEmpty()) {
        folder = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    }
    QString photosDir = QDir::toNativeSeparators(folder + "/Photos");
    QDir d(photosDir);
    if (!d.exists()) {
        d.mkpath(".");
    }
    return photosDir;
}

QString DatabaseManager::saveBorrowerPhoto(const QString &sourceImagePath, const QString &universityId) {
    if (sourceImagePath.trimmed().isEmpty() || !QFile::exists(sourceImagePath)) {
        return QString();
    }
    QImage img(sourceImagePath);
    if (img.isNull()) {
        return QString();
    }
    // Resize to 300 px
    QImage scaled = img.scaled(300, 300, Qt::KeepAspectRatio, Qt::SmoothTransformation);
    QString cleanUid = universityId;
    cleanUid.replace(QRegularExpression("[^a-zA-Z0-9_-]"), "_");
    QString destFileName = QString("%1.png").arg(cleanUid);
    QString destFullPath = QDir::toNativeSeparators(getPhotosFolderPath() + "/" + destFileName);
    if (scaled.save(destFullPath, "PNG")) {
        return destFullPath;
    }
    return QString();
}

// -------------------------------------------------------------
// Phase 3: Borrowers Management (People: Student, Faculty, Staff)
// -------------------------------------------------------------
QVector<Borrower> DatabaseManager::getAllBorrowers(const QString &search, 
                                                  const QString &roleFilter,
                                                  const QString &statusFilter,
                                                  const QString &deptFilter) {
    QVector<Borrower> list;
    QString sql = "SELECT * FROM borrowers WHERE is_active = 1 ";
    
    if (!roleFilter.isEmpty() && roleFilter != "All") {
        sql += QString(" AND role = '%1' ").arg(roleFilter);
    }
    if (!statusFilter.isEmpty() && statusFilter != "All") {
        sql += QString(" AND status = '%1' ").arg(statusFilter);
    }
    if (!deptFilter.isEmpty() && deptFilter != "All") {
        sql += QString(" AND department = '%1' ").arg(deptFilter);
    }
    if (!search.trimmed().isEmpty()) {
        QString s = search.trimmed();
        sql += QString(" AND (name LIKE '%%1%' OR university_id LIKE '%%1%' OR phone LIKE '%%1%' OR email LIKE '%%1%' OR program LIKE '%%1%') ")
               .arg(s);
    }
    sql += " ORDER BY name ASC;";

    QSqlQuery q(m_db);
    if (q.exec(sql)) {
        while (q.next()) {
            Borrower b;
            b.id = q.value("id").toInt();
            b.role = q.value("role").toString();
            b.university_id = q.value("university_id").toString();
            b.barcode = q.value("barcode").toString();
            if (b.barcode.isEmpty()) b.barcode = b.university_id;
            b.name = q.value("name").toString();
            b.father_name = q.value("father_name").toString();
            b.department = q.value("department").toString();
            b.program = q.value("program").toString();
            b.session = q.value("session").toString();
            b.semester = q.value("semester").toInt();
            b.designation = q.value("designation").toString();
            b.email = q.value("email").toString();
            b.phone = q.value("phone").toString();
            b.address = q.value("address").toString();
            b.photo_path = q.value("photo_path").toString();
            b.borrow_limit = q.value("borrow_limit").toInt();
            b.joined_date = q.value("joined_date").toString();
            b.valid_until = q.value("valid_until").toString();
            b.status = q.value("status").toString();
            if (b.status.isEmpty()) b.status = "active";
            b.notes = q.value("notes").toString();
            b.is_active = q.value("is_active").toInt() == 1;
            b.created_at = q.value("created_at").toString();
            b.updated_at = q.value("updated_at").toString();
            list.append(b);
        }
    }
    return list;
}

std::optional<Borrower> DatabaseManager::getBorrowerById(int id) {
    QSqlQuery q(m_db);
    q.prepare("SELECT * FROM borrowers WHERE id = :id LIMIT 1;");
    q.bindValue(":id", id);
    if (q.exec() && q.next()) {
        Borrower b;
        b.id = q.value("id").toInt();
        b.role = q.value("role").toString();
        b.university_id = q.value("university_id").toString();
        b.barcode = q.value("barcode").toString();
        if (b.barcode.isEmpty()) b.barcode = b.university_id;
        b.name = q.value("name").toString();
        b.father_name = q.value("father_name").toString();
        b.department = q.value("department").toString();
        b.program = q.value("program").toString();
        b.session = q.value("session").toString();
        b.semester = q.value("semester").toInt();
        b.designation = q.value("designation").toString();
        b.email = q.value("email").toString();
        b.phone = q.value("phone").toString();
        b.address = q.value("address").toString();
        b.photo_path = q.value("photo_path").toString();
        b.borrow_limit = q.value("borrow_limit").toInt();
        b.joined_date = q.value("joined_date").toString();
        b.valid_until = q.value("valid_until").toString();
        b.status = q.value("status").toString();
        if (b.status.isEmpty()) b.status = "active";
        b.notes = q.value("notes").toString();
        b.is_active = q.value("is_active").toInt() == 1;
        b.created_at = q.value("created_at").toString();
        b.updated_at = q.value("updated_at").toString();
        return b;
    }
    return std::nullopt;
}

std::optional<Borrower> DatabaseManager::getBorrowerByUniversityId(const QString &uid) {
    QSqlQuery q(m_db);
    q.prepare("SELECT * FROM borrowers WHERE university_id = :uid LIMIT 1;");
    q.bindValue(":uid", uid.trimmed());
    if (q.exec() && q.next()) {
        Borrower b;
        b.id = q.value("id").toInt();
        b.role = q.value("role").toString();
        b.university_id = q.value("university_id").toString();
        b.barcode = q.value("barcode").toString();
        if (b.barcode.isEmpty()) b.barcode = b.university_id;
        b.name = q.value("name").toString();
        b.father_name = q.value("father_name").toString();
        b.department = q.value("department").toString();
        b.program = q.value("program").toString();
        b.session = q.value("session").toString();
        b.semester = q.value("semester").toInt();
        b.designation = q.value("designation").toString();
        b.email = q.value("email").toString();
        b.phone = q.value("phone").toString();
        b.address = q.value("address").toString();
        b.photo_path = q.value("photo_path").toString();
        b.borrow_limit = q.value("borrow_limit").toInt();
        b.joined_date = q.value("joined_date").toString();
        b.valid_until = q.value("valid_until").toString();
        b.status = q.value("status").toString();
        if (b.status.isEmpty()) b.status = "active";
        b.notes = q.value("notes").toString();
        b.is_active = q.value("is_active").toInt() == 1;
        return b;
    }
    return std::nullopt;
}

std::optional<Borrower> DatabaseManager::getBorrowerByBarcode(const QString &barcode) {
    QSqlQuery q(m_db);
    q.prepare("SELECT * FROM borrowers WHERE barcode = :b OR university_id = :b LIMIT 1;");
    q.bindValue(":b", barcode.trimmed());
    if (q.exec() && q.next()) {
        Borrower b;
        b.id = q.value("id").toInt();
        b.role = q.value("role").toString();
        b.university_id = q.value("university_id").toString();
        b.barcode = q.value("barcode").toString();
        if (b.barcode.isEmpty()) b.barcode = b.university_id;
        b.name = q.value("name").toString();
        b.father_name = q.value("father_name").toString();
        b.department = q.value("department").toString();
        b.program = q.value("program").toString();
        b.session = q.value("session").toString();
        b.semester = q.value("semester").toInt();
        b.designation = q.value("designation").toString();
        b.email = q.value("email").toString();
        b.phone = q.value("phone").toString();
        b.address = q.value("address").toString();
        b.photo_path = q.value("photo_path").toString();
        b.borrow_limit = q.value("borrow_limit").toInt();
        b.joined_date = q.value("joined_date").toString();
        b.valid_until = q.value("valid_until").toString();
        b.status = q.value("status").toString();
        if (b.status.isEmpty()) b.status = "active";
        b.notes = q.value("notes").toString();
        b.is_active = q.value("is_active").toInt() == 1;
        return b;
    }
    return std::nullopt;
}

std::optional<Borrower> DatabaseManager::getBorrowerByNameAndPhone(const QString &name, const QString &phone, int excludeId) {
    if (name.trimmed().isEmpty() || phone.trimmed().isEmpty()) return std::nullopt;
    QString norm = Borrower::normalizePhone(phone);

    QSqlQuery q(m_db);
    QString sql = "SELECT * FROM borrowers WHERE LOWER(name) = LOWER(:n) AND phone = :p";
    if (excludeId > 0) sql += " AND id != " + QString::number(excludeId);
    sql += " LIMIT 1;";

    q.prepare(sql);
    q.bindValue(":n", name.trimmed());
    q.bindValue(":p", norm);
    if (q.exec() && q.next()) {
        Borrower b;
        b.id = q.value("id").toInt();
        b.name = q.value("name").toString();
        b.university_id = q.value("university_id").toString();
        return b;
    }
    return std::nullopt;
}

bool DatabaseManager::hasDuplicateUniversityId(const QString &uid, int excludeId, QString &outExistingName, int &outExistingId) {
    QSqlQuery q(m_db);
    QString sql = "SELECT id, name FROM borrowers WHERE university_id = :u";
    if (excludeId > 0) {
        sql += " AND id != " + QString::number(excludeId);
    }
    sql += " LIMIT 1;";
    q.prepare(sql);
    q.bindValue(":u", uid.trimmed());
    if (q.exec() && q.next()) {
        outExistingId = q.value("id").toInt();
        outExistingName = q.value("name").toString();
        return true;
    }
    return false;
}

bool DatabaseManager::addBorrower(Borrower &borrower) {
    QSqlQuery q(m_db);
    QString now = QDateTime::currentDateTime().toString(Qt::ISODate);

    borrower.phone = Borrower::normalizePhone(borrower.phone);
    if (borrower.barcode.isEmpty()) {
        borrower.barcode = borrower.university_id;
    }
    if (borrower.status.isEmpty()) {
        borrower.status = "active";
    }

    q.prepare(
        "INSERT INTO borrowers ("
        "  role, university_id, barcode, name, father_name, department, program, session, semester,"
        "  designation, email, phone, address, photo_path, borrow_limit, joined_date, valid_until,"
        "  status, notes, is_active, created_at, updated_at"
        ") VALUES ("
        "  :r, :u, :b, :n, :fn, :d, :prog, :sess, :sem,"
        "  :desig, :e, :p, :addr, :photo, :l, :j, :v,"
        "  :status, :notes, 1, :now, :now"
        ");"
    );
    q.bindValue(":r", borrower.role);
    q.bindValue(":u", borrower.university_id.trimmed());
    q.bindValue(":b", borrower.barcode.trimmed());
    q.bindValue(":n", borrower.name.trimmed());
    q.bindValue(":fn", borrower.father_name.trimmed());
    q.bindValue(":d", borrower.department.trimmed());
    q.bindValue(":prog", borrower.program.trimmed());
    q.bindValue(":sess", borrower.session.trimmed());
    q.bindValue(":sem", borrower.semester);
    q.bindValue(":desig", borrower.designation.trimmed());
    q.bindValue(":e", borrower.email.trimmed());
    q.bindValue(":p", borrower.phone);
    q.bindValue(":addr", borrower.address.trimmed());
    q.bindValue(":photo", borrower.photo_path.trimmed());
    q.bindValue(":l", borrower.borrow_limit);
    q.bindValue(":j", borrower.joined_date.isEmpty() ? QDate::currentDate().toString(Qt::ISODate) : borrower.joined_date);
    q.bindValue(":v", borrower.valid_until);
    q.bindValue(":status", borrower.status);
    q.bindValue(":notes", borrower.notes);
    q.bindValue(":now", now);

    if (q.exec()) {
        borrower.id = q.lastInsertId().toInt();
        logAudit("ADD_BORROWER", QString("Registered %1: %2 (%3)").arg(borrower.role).arg(borrower.name).arg(borrower.university_id));
        return true;
    }
    qWarning() << "Failed to add borrower:" << q.lastError().text();
    return false;
}

bool DatabaseManager::updateBorrower(const Borrower &borrower) {
    QSqlQuery q(m_db);
    QString now = QDateTime::currentDateTime().toString(Qt::ISODate);
    QString normPhone = Borrower::normalizePhone(borrower.phone);

    q.prepare(
        "UPDATE borrowers SET"
        "  role = :r, university_id = :u, barcode = :b, name = :n, father_name = :fn,"
        "  department = :d, program = :prog, session = :sess, semester = :sem,"
        "  designation = :desig, email = :e, phone = :p, address = :addr, photo_path = :photo,"
        "  borrow_limit = :l, joined_date = :j, valid_until = :v, status = :status,"
        "  notes = :notes, updated_at = :now WHERE id = :id;"
    );
    q.bindValue(":r", borrower.role);
    q.bindValue(":u", borrower.university_id.trimmed());
    q.bindValue(":b", borrower.barcode.isEmpty() ? borrower.university_id.trimmed() : borrower.barcode.trimmed());
    q.bindValue(":n", borrower.name.trimmed());
    q.bindValue(":fn", borrower.father_name.trimmed());
    q.bindValue(":d", borrower.department.trimmed());
    q.bindValue(":prog", borrower.program.trimmed());
    q.bindValue(":sess", borrower.session.trimmed());
    q.bindValue(":sem", borrower.semester);
    q.bindValue(":desig", borrower.designation.trimmed());
    q.bindValue(":e", borrower.email.trimmed());
    q.bindValue(":p", normPhone);
    q.bindValue(":addr", borrower.address.trimmed());
    q.bindValue(":photo", borrower.photo_path.trimmed());
    q.bindValue(":l", borrower.borrow_limit);
    q.bindValue(":j", borrower.joined_date);
    q.bindValue(":v", borrower.valid_until);
    q.bindValue(":status", borrower.status);
    q.bindValue(":notes", borrower.notes);
    q.bindValue(":now", now);
    q.bindValue(":id", borrower.id);

    if (q.exec()) {
        logAudit("UPDATE_BORROWER", QString("Updated %1 ID %2 (%3)").arg(borrower.role).arg(borrower.id).arg(borrower.name));
        return true;
    }
    return false;
}

bool DatabaseManager::setBorrowerStatus(int id, const QString &newStatus) {
    QSqlQuery q(m_db);
    q.prepare("UPDATE borrowers SET status = :s, updated_at = :now WHERE id = :id;");
    q.bindValue(":s", newStatus);
    q.bindValue(":now", QDateTime::currentDateTime().toString(Qt::ISODate));
    q.bindValue(":id", id);
    if (q.exec()) {
        logAudit("STATUS_BORROWER", QString("Changed status of borrower ID %1 to %2").arg(id).arg(newStatus));
        return true;
    }
    return false;
}

bool DatabaseManager::hasBorrowerLoanHistory(int borrowerId) {
    QSqlQuery q(m_db);
    q.prepare("SELECT COUNT(*) FROM transactions WHERE borrower_id = :bId;");
    q.bindValue(":bId", borrowerId);
    if (q.exec() && q.next()) {
        return q.value(0).toInt() > 0;
    }
    return false;
}

bool DatabaseManager::deleteBorrower(int id) {
    // If person has loan history, NEVER hard-delete: set status to "left" instead
    if (hasBorrowerLoanHistory(id)) {
        QSqlQuery q(m_db);
        q.prepare("UPDATE borrowers SET status = 'left', is_active = 0, updated_at = :now WHERE id = :id;");
        q.bindValue(":now", QDateTime::currentDateTime().toString(Qt::ISODate));
        q.bindValue(":id", id);
        if (q.exec()) {
            logAudit("DEACTIVATE_BORROWER", QString("Borrower ID %1 has loan history; status changed to 'left'").arg(id));
            return true;
        }
        return false;
    }

    // No loan history: safe to delete
    QSqlQuery q(m_db);
    q.prepare("DELETE FROM borrowers WHERE id = :id;");
    q.bindValue(":id", id);
    if (q.exec()) {
        logAudit("DELETE_BORROWER", QString("Permanently deleted borrower ID %1 without history").arg(id));
        return true;
    }
    return false;
}

int DatabaseManager::getBorrowerActiveLoansCount(int borrowerId) {
    QSqlQuery q(m_db);
    q.prepare("SELECT COUNT(*) FROM transactions WHERE borrower_id = :bId AND return_date IS NULL;");
    q.bindValue(":bId", borrowerId);
    if (q.exec() && q.next()) {
        return q.value(0).toInt();
    }
    return 0;
}

int DatabaseManager::getBorrowerUnpaidFinesPaisa(int borrowerId) {
    int dailyFinePaisa = getSetting("fine_rate_paisa", "5000").toInt(); // default Rs 50
    QSqlQuery q(m_db);
    q.prepare("SELECT due_date FROM transactions WHERE borrower_id = :bId AND return_date IS NULL;");
    q.bindValue(":bId", borrowerId);

    int totalFinesPaisa = 0;
    QDate today = QDate::currentDate();

    if (q.exec()) {
        while (q.next()) {
            QDate dueDate = QDate::fromString(q.value(0).toString(), Qt::ISODate);
            if (dueDate.isValid() && dueDate < today) {
                int days = dueDate.daysTo(today);
                totalFinesPaisa += (days * dailyFinePaisa);
            }
        }
    }
    return totalFinesPaisa;
}

int DatabaseManager::getBorrowerTotalPaidFinesPaisa(int borrowerId) {
    QSqlQuery q(m_db);
    q.prepare("SELECT COALESCE(SUM(fine_paid_paisa), 0) FROM transactions WHERE borrower_id = :bId;");
    q.bindValue(":bId", borrowerId);
    if (q.exec() && q.next()) {
        return q.value(0).toInt();
    }
    return 0;
}

QStringList DatabaseManager::getDistinctBorrowerDepartments() {
    QStringList depts = {
        "Computer Science", "Law", "Education", "Physics", 
        "Mathematics", "Chemistry", "English", "Islamic Studies", 
        "Management Sciences", "Civil Engineering"
    };
    QSqlQuery q(m_db);
    if (q.exec("SELECT DISTINCT department FROM borrowers WHERE department IS NOT NULL AND department != '' ORDER BY department ASC;")) {
        while (q.next()) {
            QString d = q.value(0).toString().trimmed();
            if (!d.isEmpty() && !depts.contains(d, Qt::CaseInsensitive)) {
                depts.append(d);
            }
        }
    }
    return depts;
}

bool DatabaseManager::canIssueBookToBorrower(int borrowerId, QString &blockReason) {
    auto opt = getBorrowerById(borrowerId);
    if (!opt) {
        blockReason = "Borrower record not found in system.";
        return false;
    }

    const Borrower &b = *opt;

    // 1. Status Check: Must be 'active'
    if (b.status.compare("active", Qt::CaseInsensitive) != 0) {
        blockReason = QString("Borrower account status is '%1'. Issuing books is blocked.")
                      .arg(b.status.toUpper());
        return false;
    }

    // 2. Validity Check: valid_until has not passed
    if (!b.valid_until.trimmed().isEmpty()) {
        QDate validDate = QDate::fromString(b.valid_until.trimmed(), Qt::ISODate);
        if (validDate.isValid() && validDate < QDate::currentDate()) {
            blockReason = QString("Membership validity expired on %1. Card renewal required.")
                          .arg(b.valid_until);
            return false;
        }
    }

    // 3. Borrow Limit Check
    int currentLoans = getBorrowerActiveLoansCount(borrowerId);
    if (currentLoans >= b.borrow_limit) {
        blockReason = QString("Borrowing limit reached: %1 has %2 of %3 allowed books currently issued.")
                      .arg(b.name).arg(currentLoans).arg(b.borrow_limit);
        return false;
    }

    // 4. Overdue Unpaid Fines Check (Threshold default Rs 500 = 50,000 paisa)
    int maxFinePaisa = getSetting("max_unpaid_fine_paisa", "50000").toInt();
    int unpaidFine = getBorrowerUnpaidFinesPaisa(borrowerId);
    if (unpaidFine > maxFinePaisa) {
        double fineRs = static_cast<double>(unpaidFine) / 100.0;
        double maxRs = static_cast<double>(maxFinePaisa) / 100.0;
        blockReason = QString("Unpaid overdue fines (Rs %1) exceed maximum allowable limit of Rs %2. Settlement required before issuing.")
                      .arg(fineRs, 0, 'f', 2).arg(maxRs, 0, 'f', 2);
        return false;
    }

    return true;
}

QString DatabaseManager::getBorrowersCsvTemplate() const {
    return "University_ID,Name,Role,Department,Father_Name,Program,Session,Semester,Designation,Phone,Email,Address,Borrow_Limit,Valid_Until,Status,Notes\n"
           "ULM-FA23-BCS-050,Shahid Afridi,Student,Computer Science,Fazal Afridi,BCS,FA23,4,,0300-1122334,shahid.cs@ulm.edu.pk,Lakki Marwat,3,2027-06-30,active,\n"
           "ULM-FAC-PHY-011,Dr. Rehmat Ullah,Faculty,Physics,,,,,Assistant Professor,0345-2233445,rehmat.phy@ulm.edu.pk,Bannu Road Campus,10,,active,\n"
           "ULM-STF-ADM-004,Muhammad Irfan,Staff,Management Sciences,,,,,Senior Clerk,0312-5566778,irfan.adm@ulm.edu.pk,Admin Block ULM,5,,active,\n";
}

bool DatabaseManager::importBorrowersFromCsv(const QString &filePath, const QMap<int, QString> &columnMap,
                                            QStringList &errors, int &importedCount, int &skippedCount) {
    importedCount = 0;
    skippedCount = 0;
    errors.clear();

    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        errors.append("Could not open CSV file for reading.");
        return false;
    }

    QTextStream in(&file);
    QString headerLine = in.readLine();
    int lineNumber = 1;

    if (!m_db.transaction()) return false;

    while (!in.atEnd()) {
        lineNumber++;
        QString line = in.readLine().trimmed();
        if (line.isEmpty()) continue;

        QStringList parts = line.split(',');
        Borrower b;
        b.role = "Student";
        b.borrow_limit = 3;
        b.status = "active";
        b.semester = 1;
        b.joined_date = QDate::currentDate().toString(Qt::ISODate);

        for (auto it = columnMap.begin(); it != columnMap.end(); ++it) {
            int colIdx = it.key();
            QString field = it.value();
            if (colIdx < parts.size()) {
                QString val = parts[colIdx].trimmed().remove('"');
                if (field == "university_id") b.university_id = val;
                else if (field == "name") b.name = val;
                else if (field == "role") b.role = val;
                else if (field == "department") b.department = val;
                else if (field == "father_name") b.father_name = val;
                else if (field == "program") b.program = val;
                else if (field == "session") b.session = val;
                else if (field == "semester") b.semester = val.toInt();
                else if (field == "designation") b.designation = val;
                else if (field == "phone") b.phone = val;
                else if (field == "email") b.email = val;
                else if (field == "address") b.address = val;
                else if (field == "borrow_limit") b.borrow_limit = val.toInt() > 0 ? val.toInt() : Borrower::defaultLimitForRole(b.role);
                else if (field == "valid_until") b.valid_until = val;
                else if (field == "status") b.status = val;
                else if (field == "notes") b.notes = val;
            }
        }

        if (b.university_id.isEmpty() || b.name.isEmpty()) {
            errors.append(QString("Line %1: Missing required University ID or Name.").arg(lineNumber));
            skippedCount++;
            continue;
        }

        QString existingName;
        int existingId = 0;
        if (hasDuplicateUniversityId(b.university_id, 0, existingName, existingId)) {
            errors.append(QString("Line %1: Duplicate University ID '%2' already assigned to %3.")
                          .arg(lineNumber).arg(b.university_id).arg(existingName));
            skippedCount++;
            continue;
        }

        if (addBorrower(b)) {
            importedCount++;
        } else {
            errors.append(QString("Line %1: Database insertion failed.").arg(lineNumber));
            skippedCount++;
        }
    }

    return m_db.commit();
}

int DatabaseManager::getBorrowerActiveLoansCount(int borrowerId) {
    QSqlQuery q(m_db);
    q.prepare("SELECT COUNT(*) FROM transactions WHERE borrower_id = :bId AND return_date IS NULL;");
    q.bindValue(":bId", borrowerId);
    if (q.exec() && q.next()) {
        return q.value(0).toInt();
    }
    return 0;
}

QVector<Transaction> DatabaseManager::getBorrowerTransactions(int borrowerId) {
    QVector<Transaction> list;
    QSqlQuery q(m_db);
    q.prepare("SELECT * FROM transactions WHERE borrower_id = :bId ORDER BY issue_date DESC;");
    q.bindValue(":bId", borrowerId);
    if (q.exec()) {
        while (q.next()) {
            Transaction t;
            t.id = q.value("id").toInt();
            t.book_id = q.value("book_id").toInt();
            t.borrower_id = q.value("borrower_id").toInt();
            t.issue_date = q.value("issue_date").toString();
            t.due_date = q.value("due_date").toString();
            t.return_date = q.value("return_date").toString();
            t.fine_paid_paisa = q.value("fine_paid_paisa").toInt();
            list.append(t);
        }
    }
    return list;
}

// -------------------------------------------------------------
// Phase 3: Circulation Desk
// -------------------------------------------------------------
bool DatabaseManager::issueBook(int bookId, int borrowerId, int loanDays) {
    if (!m_db.transaction()) return false;

    // Verify book is available
    auto bookOpt = getBookById(bookId);
    if (!bookOpt || bookOpt->status != "available") {
        m_db.rollback();
        return false;
    }

    // Verify borrower limit
    auto borrowerOpt = getBorrowerById(borrowerId);
    if (!borrowerOpt || !borrowerOpt->is_active) {
        m_db.rollback();
        return false;
    }

    int activeCount = getBorrowerActiveLoansCount(borrowerId);
    if (activeCount >= borrowerOpt->borrow_limit) {
        m_db.rollback();
        return false;
    }

    QDate today = QDate::currentDate();
    QDate due = today.addDays(loanDays > 0 ? loanDays : 14);

    QSqlQuery q(m_db);
    q.prepare(
        "INSERT INTO transactions (book_id, borrower_id, issue_date, due_date) "
        "VALUES (:bId, :borId, :issue, :due);"
    );
    q.bindValue(":bId", bookId);
    q.bindValue(":borId", borrowerId);
    q.bindValue(":issue", today.toString(Qt::ISODate));
    q.bindValue(":due", due.toString(Qt::ISODate));

    if (!q.exec()) {
        m_db.rollback();
        return false;
    }

    // Update book status
    QSqlQuery qBook(m_db);
    qBook.prepare("UPDATE books SET status = 'issued', updated_at = :up WHERE id = :id;");
    qBook.bindValue(":up", QDateTime::currentDateTime().toString(Qt::ISODate));
    qBook.bindValue(":id", bookId);

    if (!qBook.exec()) {
        m_db.rollback();
        return false;
    }

    logAudit("ISSUE_BOOK", QString("Issued copy ID %1 (%2) to %3 (%4)")
             .arg(bookId).arg(bookOpt->barcode).arg(borrowerOpt->name).arg(borrowerOpt->university_id));

    return m_db.commit();
}

bool DatabaseManager::returnBook(int transactionId, int finePaidPaisa) {
    if (!m_db.transaction()) return false;

    QSqlQuery q(m_db);
    q.prepare("SELECT book_id FROM transactions WHERE id = :txId AND return_date IS NULL;");
    q.bindValue(":txId", transactionId);
    if (!q.exec() || !q.next()) {
        m_db.rollback();
        return false;
    }
    int bookId = q.value(0).toInt();

    QString today = QDate::currentDate().toString(Qt::ISODate);

    QSqlQuery qReturn(m_db);
    qReturn.prepare(
        "UPDATE transactions SET return_date = :ret, fine_paid_paisa = :fine WHERE id = :txId;"
    );
    qReturn.bindValue(":ret", today);
    qReturn.bindValue(":fine", finePaidPaisa);
    qReturn.bindValue(":txId", transactionId);

    if (!qReturn.exec()) {
        m_db.rollback();
        return false;
    }

    // Mark book available
    QSqlQuery qBook(m_db);
    qBook.prepare("UPDATE books SET status = 'available', updated_at = :up WHERE id = :bId;");
    qBook.bindValue(":up", QDateTime::currentDateTime().toString(Qt::ISODate));
    qBook.bindValue(":bId", bookId);

    if (!qBook.exec()) {
        m_db.rollback();
        return false;
    }

    logAudit("RETURN_BOOK", QString("Returned transaction #%1 (Book #%2, fine Rs %3)")
             .arg(transactionId).arg(bookId).arg(finePaidPaisa / 100.0));

    return m_db.commit();
}

QVector<ActiveLoanInfo> DatabaseManager::getActiveLoans() {
    QVector<ActiveLoanInfo> list;
    QSqlQuery q(m_db);
    
    int fineRatePaisa = getSetting("fine_rate_paisa", "5000").toInt(); // default Rs 50
    int graceDays = getSetting("grace_days", "0").toInt();
    QDate today = QDate::currentDate();

    QString sql = 
        "SELECT t.id AS tx_id, t.issue_date, t.due_date, "
        "       b.id AS book_id, b.accession_no, b.barcode, b.title, b.author, "
        "       br.id AS borrower_id, br.name AS borrower_name, br.university_id, br.role "
        "FROM transactions t "
        "JOIN books b ON t.book_id = b.id "
        "JOIN borrowers br ON t.borrower_id = br.id "
        "WHERE t.return_date IS NULL "
        "ORDER BY t.due_date ASC;";

    if (q.exec(sql)) {
        while (q.next()) {
            ActiveLoanInfo item;
            item.transaction_id = q.value("tx_id").toInt();
            item.issue_date = q.value("issue_date").toString();
            item.due_date = q.value("due_date").toString();
            item.book_id = q.value("book_id").toInt();
            item.accession_no = q.value("accession_no").toInt();
            item.barcode = q.value("barcode").toString();
            item.title = q.value("title").toString();
            item.author = q.value("author").toString();
            item.borrower_id = q.value("borrower_id").toInt();
            item.borrower_name = q.value("borrower_name").toString();
            item.university_id = q.value("university_id").toString();
            item.role = q.value("role").toString();

            QDate dueDate = QDate::fromString(item.due_date, Qt::ISODate);
            int diffDays = dueDate.daysTo(today);
            if (diffDays > graceDays) {
                item.days_overdue = diffDays;
                item.fine_paisa = diffDays * fineRatePaisa;
            } else {
                item.days_overdue = 0;
                item.fine_paisa = 0;
            }

            list.append(item);
        }
    }
    return list;
}

// -------------------------------------------------------------
// Phase 2: Backup & Restore
// -------------------------------------------------------------
bool DatabaseManager::backupDatabase(const QString &targetPath) {
    QSqlQuery q(m_db);
    // Use SQLite VACUUM INTO for consistent transaction-safe live snapshot
    QString cleanPath = targetPath;
    cleanPath.replace("\\", "/");
    cleanPath.replace("'", "''");

    // Remove target if already exists
    if (QFile::exists(targetPath)) {
        QFile::remove(targetPath);
    }

    bool success = q.exec(QString("VACUUM INTO '%1';").arg(cleanPath));
    if (success) {
        logAudit("BACKUP", QString("Snapshot database created at: %1").arg(targetPath));
    } else {
        qWarning() << "Backup failed:" << q.lastError().text();
    }
    return success;
}

bool DatabaseManager::restoreDatabase(const QString &backupPath, QString &errorMessage) {
    if (!QFile::exists(backupPath)) {
        errorMessage = "Specified backup file does not exist.";
        return false;
    }

    // Safety backup of current database first
    QString appDir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QString safetyBackup = appDir + QString("/pre_restore_safety_%1.db")
                                        .arg(QDateTime::currentDateTime().toString("yyyyMMdd_hhmmss"));
    backupDatabase(safetyBackup);

    // Verify candidate file with integrity_check in a temp connection
    {
        QSqlDatabase tempDb = QSqlDatabase::addDatabase("QSQLITE", "restore_verify");
        tempDb.setDatabaseName(backupPath);
        if (!tempDb.open()) {
            errorMessage = "Cannot open backup file for validation.";
            return false;
        }

        QSqlQuery vq(tempDb);
        if (!vq.exec("PRAGMA integrity_check;") || !vq.next() || vq.value(0).toString() != "ok") {
            errorMessage = "Backup failed PRAGMA integrity_check. File is corrupted.";
            tempDb.close();
            return false;
        }

        if (!vq.exec("PRAGMA user_version;") || !vq.next() || vq.value(0).toInt() < 1) {
            errorMessage = "Incompatible schema version in backup file.";
            tempDb.close();
            return false;
        }
        tempDb.close();
    }
    QSqlDatabase::removeDatabase("restore_verify");

    // Replace current database file
    QString currentDbPath = m_db.databaseName();
    closeDatabase();

    // Remove existing database and WAL files
    QFile::remove(currentDbPath);
    QFile::remove(currentDbPath + "-wal");
    QFile::remove(currentDbPath + "-shm");

    if (!QFile::copy(backupPath, currentDbPath)) {
        errorMessage = "Failed to overwrite live database with backup.";
        openDatabase(currentDbPath);
        return false;
    }

    // Reopen
    if (!openDatabase(currentDbPath)) {
        errorMessage = "Failed to reopen restored database.";
        return false;
    }

    logAudit("RESTORE", QString("Restored database from %1 (safety copy saved to %2)")
             .arg(backupPath).arg(safetyBackup));
    return true;
}

void DatabaseManager::runAutomaticStartupBackup() {
    QString appDir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir backupDir(appDir + "/backups");
    if (!backupDir.exists()) {
        backupDir.mkpath(".");
    }

    QString todayStamp = QDateTime::currentDateTime().toString("yyyyMMdd_hhmmss");
    QString backupFile = backupDir.filePath(QString("ulm_auto_backup_%1.db").arg(todayStamp));

    backupDatabase(backupFile);

    // Keep only last 14 backups
    QFileInfoList list = backupDir.entryInfoList(QStringList() << "*.db", QDir::Files, QDir::Time);
    if (list.size() > 14) {
        for (int i = 14; i < list.size(); ++i) {
            QFile::remove(list[i].absoluteFilePath());
        }
    }
}

// -------------------------------------------------------------
// Phase 2: CSV Import / Export
// -------------------------------------------------------------
bool DatabaseManager::exportCatalogToCsv(const QString &filePath) {
    QFile file(filePath);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text)) {
        return false;
    }

    QTextStream out(&file);
    out.setEncoding(QStringConverter::Utf8);

    // Write Header
    out << "Accession No,Barcode,Title,Author,Edition,Place,Publisher,Year,Pages,"
        << "Price Rs,Price Paisa,Binding,Binding Code,ISBN,Category,Dewey Call Number,Shelf,Status,Source\n";

    QSqlQuery q(m_db);
    q.exec("SELECT * FROM books WHERE is_active = 1 ORDER BY accession_no ASC;");

    auto quoteCsv = [](const QString &str) -> QString {
        QString s = str;
        s.replace("\"", "\"\"");
        return QString("\"%1\"").arg(s);
    };

    while (q.next()) {
        int paisa = q.value("price_paisa").toInt();
        double rupees = paisa / 100.0;

        out << q.value("accession_no").toInt() << ","
            << quoteCsv(q.value("barcode").toString()) << ","
            << quoteCsv(q.value("title").toString()) << ","
            << quoteCsv(q.value("author").toString()) << ","
            << quoteCsv(q.value("edition").toString()) << ","
            << quoteCsv(q.value("place").toString()) << ","
            << quoteCsv(q.value("publisher").toString()) << ","
            << q.value("year").toInt() << ","
            << quoteCsv(q.value("pages").toString()) << ","
            << QString::number(rupees, 'f', 2) << ","
            << paisa << ","
            << quoteCsv(q.value("binding").toString()) << ","
            << quoteCsv(q.value("binding_code").toString()) << ","
            << quoteCsv(q.value("isbn").toString()) << ","
            << quoteCsv(q.value("category").toString()) << ","
            << quoteCsv(q.value("dewey_call_number").toString()) << ","
            << quoteCsv(q.value("shelf").toString()) << ","
            << quoteCsv(q.value("status").toString()) << ","
            << quoteCsv(q.value("source_remarks").toString()) << "\n";
    }

    file.close();
    logAudit("EXPORT_CSV", QString("Exported catalog to %1").arg(filePath));
    return true;
}

bool DatabaseManager::importBooksFromCsv(const QString &filePath, const QMap<int, QString> &columnMap,
                                        QStringList &errors, int &importedCount, int &skippedCount) {
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        errors << QString("Cannot open CSV file: %1").arg(file.errorString());
        return false;
    }

    QTextStream in(&file);
    in.setEncoding(QStringConverter::Utf8);

    if (!m_db.transaction()) {
        errors << "Failed to begin SQL transaction.";
        return false;
    }

    importedCount = 0;
    skippedCount = 0;
    int lineNum = 0;

    // Helper parser for CSV lines with quotes
    auto parseCsvLine = [](const QString &line) -> QStringList {
        QStringList fields;
        QString field;
        bool inQuotes = false;
        for (int i = 0; i < line.length(); ++i) {
            QChar c = line[i];
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line[i + 1] == '"') {
                    field += '"';
                    ++i;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields << field.trimmed();
                field.clear();
            } else {
                field += c;
            }
        }
        fields << field.trimmed();
        return fields;
    };

    while (!in.atEnd()) {
        QString line = in.readLine();
        lineNum++;
        if (line.trimmed().isEmpty()) continue;
        if (lineNum == 1) continue; // Skip header

        QStringList fields = parseCsvLine(line);
        Book b;
        b.accession_no = 0;

        for (auto it = columnMap.begin(); it != columnMap.end(); ++it) {
            int colIdx = it.key();
            QString fieldName = it.value();
            if (colIdx >= fields.size()) continue;
            QString val = fields[colIdx];

            if (fieldName == "accession_no") b.accession_no = val.toInt();
            else if (fieldName == "title") b.title = val;
            else if (fieldName == "author") b.author = val;
            else if (fieldName == "edition") b.edition = val;
            else if (fieldName == "place") b.place = val;
            else if (fieldName == "publisher") b.publisher = val;
            else if (fieldName == "year") b.year = val.toInt();
            else if (fieldName == "pages") b.pages = val;
            else if (fieldName == "price_rs") b.price_paisa = static_cast<int>(std::round(val.toDouble() * 100));
            else if (fieldName == "price_paisa") b.price_paisa = val.toInt();
            else if (fieldName == "binding") b.binding = val;
            else if (fieldName == "binding_code") b.binding_code = val;
            else if (fieldName == "isbn") b.isbn = val;
            else if (fieldName == "category") b.category = val;
            else if (fieldName == "dewey_call_number") b.dewey_call_number = val;
            else if (fieldName == "shelf") b.shelf = val;
            else if (fieldName == "source_remarks") b.source_remarks = val;
        }

        if (b.title.trimmed().isEmpty()) {
            errors << QString("Line %1: Skipped - Missing mandatory Book Title").arg(lineNum);
            skippedCount++;
            continue;
        }

        if (b.accession_no > 0) {
            // Check duplicate accession number
            auto existing = getBookByAccessionNo(b.accession_no);
            if (existing) {
                errors << QString("Line %1: Skipped - Duplicate Accession #%2").arg(lineNum).arg(b.accession_no);
                skippedCount++;
                continue;
            }
        }

        if (!addBook(b)) {
            errors << QString("Line %1: Database error inserting '%2'").arg(lineNum).arg(b.title);
            skippedCount++;
        } else {
            importedCount++;
        }
    }

    file.close();
    m_db.commit();
    logAudit("IMPORT_CSV", QString("Imported %1 records, %2 skipped from %3").arg(importedCount).arg(skippedCount).arg(filePath));
    return true;
}

// -------------------------------------------------------------
// Phase 5: Reports & Statistics
// -------------------------------------------------------------
LibraryStats DatabaseManager::getLibraryStatistics() {
    LibraryStats stats;
    QSqlQuery q(m_db);

    // Total Physical Copies
    q.exec("SELECT COUNT(*) FROM books WHERE is_active = 1;");
    if (q.next()) stats.total_copies = q.value(0).toInt();

    // Total Distinct Titles (grouped by ISBN or title+author+edition)
    q.exec(
        "SELECT COUNT(DISTINCT CASE "
        "  WHEN isbn IS NOT NULL AND isbn != '' THEN isbn "
        "  ELSE title || '___' || COALESCE(author, '') || '___' || COALESCE(edition, '') "
        "END) FROM books WHERE is_active = 1;"
    );
    if (q.next()) stats.total_titles = q.value(0).toInt();

    // Active Loans
    q.exec("SELECT COUNT(*) FROM transactions WHERE return_date IS NULL;");
    if (q.next()) stats.active_loans = q.value(0).toInt();

    // Overdue Loans
    QString today = QDate::currentDate().toString(Qt::ISODate);
    q.exec(QString("SELECT COUNT(*) FROM transactions WHERE return_date IS NULL AND due_date < '%1';").arg(today));
    if (q.next()) stats.overdue_loans = q.value(0).toInt();

    // On-Time Return Rate
    q.exec("SELECT COUNT(*) FROM transactions WHERE return_date IS NOT NULL;");
    int returnedTotal = 0;
    if (q.next()) returnedTotal = q.value(0).toInt();

    if (returnedTotal > 0) {
        q.exec("SELECT COUNT(*) FROM transactions WHERE return_date IS NOT NULL AND return_date <= due_date;");
        int onTime = 0;
        if (q.next()) onTime = q.value(0).toInt();
        stats.on_time_rate = (static_cast<double>(onTime) / returnedTotal) * 100.0;
    } else {
        stats.on_time_rate = 100.0;
    }

    // Copies by Category
    q.exec("SELECT COALESCE(category, 'General'), COUNT(*) FROM books WHERE is_active = 1 GROUP BY category ORDER BY COUNT(*) DESC;");
    while (q.next()) {
        stats.copies_by_category[q.value(0).toString()] = q.value(1).toInt();
    }

    // Monthly Activity for last 6 months
    QDate cur = QDate::currentDate();
    for (int i = 5; i >= 0; --i) {
        QDate monthDate = cur.addMonths(-i);
        QString monthPrefix = monthDate.toString("yyyy-MM");
        QString monthLabel = monthDate.toString("MMM yyyy");

        int issuedCount = 0;
        int returnedCount = 0;

        QSqlQuery qIssue(m_db);
        qIssue.exec(QString("SELECT COUNT(*) FROM transactions WHERE issue_date LIKE '%1%';").arg(monthPrefix));
        if (qIssue.next()) issuedCount = qIssue.value(0).toInt();

        QSqlQuery qRet(m_db);
        qRet.exec(QString("SELECT COUNT(*) FROM transactions WHERE return_date LIKE '%1%';").arg(monthPrefix));
        if (qRet.next()) returnedCount = qRet.value(0).toInt();

        stats.monthly_activity.append(qMakePair(monthLabel, qMakePair(issuedCount, returnedCount)));
    }

    return stats;
}
