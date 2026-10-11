#pragma once

#include <QObject>
#include <QSqlDatabase>
#include <QSqlQuery>
#include <QSqlError>
#include <QString>
#include <QStringList>
#include <QVector>
#include <QMap>
#include <QFile>
#include <optional>
#include "Models.h"

struct ActiveLoanInfo {
    int transaction_id = 0;
    int book_id = 0;
    int accession_no = 0;
    QString barcode;
    QString title;
    QString author;
    int borrower_id = 0;
    QString borrower_name;
    QString university_id;
    QString role;
    QString issue_date;
    QString due_date;
    int days_overdue = 0;
    int fine_paisa = 0;
};

struct LibraryStats {
    int total_titles = 0;
    int total_copies = 0;
    int active_loans = 0;
    int overdue_loans = 0;
    double on_time_rate = 100.0;
    QMap<QString, int> copies_by_category;
    QVector<QPair<QString, QPair<int, int>>> monthly_activity;
};

class DatabaseManager : public QObject {
    Q_OBJECT
public:
    static DatabaseManager& instance();

    // Storage Location & Database Lifecycle (Phase 1 Extension)
    static QString getConfigIniPath();
    static QString getSavedDatabasePath();
    static QString getSavedFolderPath();
    static bool saveConfig(const QString &folderPath, const QString &dbPath);

    bool initializeStorage(const QString &folderPath, const QString &dbPath, QString &errorMessage);
    bool acquireDatabaseLock(const QString &folderPath, QString &errorMessage);
    void releaseDatabaseLock();

    QString getCurrentDatabasePath() const { return m_currentDbPath; }
    QString getCurrentFolderPath() const { return m_currentFolderPath; }
    QString getPhotosFolderPath() const;

    bool moveDatabaseToNewFolder(const QString &newFolderPath, QString &oldLocationKept, QString &errorMessage);
    bool switchDatabase(const QString &newDbPath, QString &errorMessage);

    bool openDatabase(const QString &path = QString());
    void closeDatabase();

    // Migrations
    bool runMigrations();

    // Books CRUD (Phase 1)
    int getNextAccessionNumber();
    bool addBook(Book &book);
    bool updateBook(const Book &book);
    std::optional<Book> getBookById(int id);
    std::optional<Book> getBookByBarcode(const QString &barcode);
    std::optional<Book> getBookByAccessionNo(int accNo);
    bool withdrawBook(int id);
    bool hasLoanHistory(int bookId);

    // Queries & Autocomplete
    bool hasDuplicateIsbn(const QString &isbn, int excludeId = 0);
    QStringList getDistinctAuthors();
    QStringList getDistinctPublishers();
    QStringList getDistinctPlaces();
    QStringList getDistinctCategories();

    // Settings (Phase 2)
    QString getSetting(const QString &key, const QString &defaultValue = QString());
    bool setSetting(const QString &key, const QString &value);

    // Audit Log
    void logAudit(const QString &action, const QString &details, const QString &user = "admin");

    // Demo Data
    void seedDemoData();
    bool clearDemoData();
    bool isDemoDataPresent();

    // Borrowers CRUD (Phase 3 Extension: People Form)
    QVector<Borrower> getAllBorrowers(const QString &search = QString(), 
                                      const QString &roleFilter = QString(),
                                      const QString &statusFilter = QString(),
                                      const QString &deptFilter = QString());
    std::optional<Borrower> getBorrowerById(int id);
    std::optional<Borrower> getBorrowerByUniversityId(const QString &uid);
    std::optional<Borrower> getBorrowerByBarcode(const QString &barcode);
    std::optional<Borrower> getBorrowerByNameAndPhone(const QString &name, const QString &phone, int excludeId = 0);
    bool hasDuplicateUniversityId(const QString &uid, int excludeId, QString &outExistingName, int &outExistingId);
    bool addBorrower(Borrower &borrower);
    bool updateBorrower(const Borrower &borrower);
    bool setBorrowerStatus(int id, const QString &newStatus);
    bool deleteBorrower(int id); // If loan history exists, soft-deletes to 'left'
    bool hasBorrowerLoanHistory(int borrowerId);
    int getBorrowerActiveLoansCount(int borrowerId);
    int getBorrowerUnpaidFinesPaisa(int borrowerId);
    int getBorrowerTotalPaidFinesPaisa(int borrowerId);
    QVector<Transaction> getBorrowerTransactions(int borrowerId);
    QStringList getDistinctBorrowerDepartments();
    QString saveBorrowerPhoto(const QString &sourceImagePath, const QString &universityId);

    // Circulation Rules Check (Phase 3)
    bool canIssueBookToBorrower(int borrowerId, QString &blockReason);
    bool issueBook(int bookId, int borrowerId, int loanDays);
    bool returnBook(int transactionId, int finePaidPaisa = 0);
    QVector<ActiveLoanInfo> getActiveLoans();

    // Backup & Restore (Phase 2)
    bool backupDatabase(const QString &targetPath);
    bool restoreDatabase(const QString &backupPath, QString &errorMessage);
    void runAutomaticStartupBackup();

    // CSV Import / Export (Phase 2 & 3)
    bool exportCatalogToCsv(const QString &filePath);
    bool importBooksFromCsv(const QString &filePath, const QMap<int, QString> &columnMap, 
                            QStringList &errors, int &importedCount, int &skippedCount);
    bool importBorrowersFromCsv(const QString &filePath, const QMap<int, QString> &columnMap,
                                QStringList &errors, int &importedCount, int &skippedCount);
    QString getBorrowersCsvTemplate() const;

    // Reports & Statistics (Phase 5)
    LibraryStats getLibraryStatistics();

    QSqlDatabase& database() { return m_db; }

private:
    DatabaseManager(QObject *parent = nullptr);
    ~DatabaseManager();
    DatabaseManager(const DatabaseManager&) = delete;
    DatabaseManager& operator=(const DatabaseManager&) = delete;

    QSqlDatabase m_db;
    bool m_hasFts5 = false;

    QString m_currentDbPath;
    QString m_currentFolderPath;
    QFile *m_lockFile = nullptr;
};
