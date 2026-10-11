#include "StorageSetupDialog.h"
#include "DatabaseManager.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFileDialog>
#include <QStandardPaths>
#include <QDir>
#include <QFileInfo>
#include <QStorageInfo>
#include <QMessageBox>
#include <QKeyEvent>
#include <QCloseEvent>
#include <QPainter>
#include <QPainterPath>
#include <QDateTime>
#include <QSqlDatabase>
#include <QSqlQuery>
#include <QSqlError>
#include <QCoreApplication>
#include <QUuid>

StorageSetupDialog::StorageSetupDialog(QWidget *parent, bool isMissingPath, const QString &missingPath)
    : QDialog(parent, Qt::Dialog | Qt::WindowTitleHint | Qt::CustomizeWindowHint | Qt::WindowCloseButtonHint)
    , m_isMissingPath(isMissingPath)
    , m_missingPath(missingPath)
{
    setWindowTitle("Storage Location Setup - University of Lakki Marwat LMS");
    setFixedSize(580, m_isMissingPath ? 640 : 590);
    setAttribute(Qt::WA_DeleteOnClose, false);

    setupUi();
    applyTheme();

    // Default recommendation on initial launch
    if (!m_isMissingPath) {
        onUseRecommendedClicked();
    } else {
        updateValidationUi();
    }
}

QString StorageSetupDialog::getRecommendedFolder() const {
    QString docPath = QStandardPaths::writableLocation(QStandardPaths::DocumentsLocation);
    if (docPath.isEmpty()) {
        docPath = QStandardPaths::writableLocation(QStandardPaths::HomeLocation);
    }
    return QDir::toNativeSeparators(docPath + "/ULM Library");
}

void StorageSetupDialog::setupUi() {
    auto *rootLayout = new QVBoxLayout(this);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    // Canvas background
    setStyleSheet("QDialog { background-color: #020617; }");

    // Centered Card Container (580px wide, card #0B1220, 1px #334155 border, 12px radius, 24px padding)
    m_cardFrame = new QFrame(this);
    m_cardFrame->setObjectName("setupCard");
    m_cardFrame->setStyleSheet(
        "QFrame#setupCard {"
        "  background-color: #0B1220;"
        "  border: 1px solid #334155;"
        "  border-radius: 12px;"
        "}"
    );

    auto *cardLayout = new QVBoxLayout(m_cardFrame);
    cardLayout->setContentsMargins(24, 24, 24, 24);
    cardLayout->setSpacing(16);

    // 1. Header with ULM Crest Vector Badge & Titles
    auto *headerLayout = new QHBoxLayout();
    headerLayout->setSpacing(14);

    // Vector Crest Icon Box
    auto *crestBox = new QLabel(m_cardFrame);
    crestBox->setFixedSize(48, 48);
    crestBox->setStyleSheet(
        "QLabel {"
        "  background-color: rgba(245, 158, 11, 0.12);"
        "  border: 1px solid rgba(245, 158, 11, 0.35);"
        "  border-radius: 10px;"
        "}"
    );
    crestBox->setAlignment(Qt::AlignCenter);

    // Draw Vector Crest (ULM shield & book insignia)
    QPixmap crestPix(48, 48);
    crestPix.fill(Qt::transparent);
    {
        QPainter p(&crestPix);
        p.setRenderHint(QPainter::Antialiasing);
        // Outer shield
        QPainterPath shield;
        shield.moveTo(24, 6);
        shield.lineTo(40, 12);
        shield.quadTo(41, 30, 24, 42);
        shield.quadTo(7, 30, 8, 12);
        shield.closeSubpath();
        p.setPen(QPen(QColor("#F59E0B"), 1.8));
        p.setBrush(QColor(245, 158, 11, 30));
        p.drawPath(shield);

        // Inner book emblem
        p.setPen(QPen(QColor("#F59E0B"), 1.5));
        p.drawLine(16, 22, 24, 25);
        p.drawLine(32, 22, 24, 25);
        p.drawLine(24, 25, 24, 34);
        p.drawLine(16, 22, 16, 31);
        p.drawLine(32, 22, 32, 31);
        p.drawLine(16, 31, 24, 34);
        p.drawLine(32, 31, 24, 34);
    }
    crestBox->setPixmap(crestPix);
    headerLayout->addWidget(crestBox);

    auto *titlesLayout = new QVBoxLayout();
    titlesLayout->setSpacing(3);

    auto *titleLabel = new QLabel("Choose where to store library data", m_cardFrame);
    titleLabel->setFont(QFont("Cinzel", 14, QFont::Bold));
    titleLabel->setStyleSheet("color: #F1F5F9; letter-spacing: 0.5px;");
    titlesLayout->addWidget(titleLabel);

    auto *subtitleLabel = new QLabel("All books, borrowers and loan records are saved in one database file in this folder.", m_cardFrame);
    subtitleLabel->setFont(QFont("Plus Jakarta Sans", 10));
    subtitleLabel->setStyleSheet("color: #94A3B8;");
    subtitleLabel->setWordWrap(true);
    titlesLayout->addWidget(subtitleLabel);

    headerLayout->addLayout(titlesLayout, 1);
    cardLayout->addLayout(headerLayout);

    // Missing Path Alert Banner (if applicable)
    if (m_isMissingPath) {
        m_missingPathBanner = new QLabel(m_cardFrame);
        m_missingPathBanner->setStyleSheet(
            "QLabel {"
            "  background-color: rgba(244, 63, 94, 0.15);"
            "  border: 1px solid rgba(244, 63, 94, 0.4);"
            "  border-radius: 8px;"
            "  padding: 8px 12px;"
            "  color: #FDA4AF;"
            "  font-family: 'JetBrains Mono', monospace;"
            "  font-size: 11px;"
            "}"
        );
        m_missingPathBanner->setWordWrap(true);
        m_missingPathBanner->setText(QString("Database not found at:\n%1\nPlease choose an existing database or select a new folder.").arg(m_missingPath));
        cardLayout->addWidget(m_missingPathBanner);
    }

    // 2. Two Selectable Option Cards (Radio style, amber border when selected)
    auto *optionsLayout = new QHBoxLayout();
    optionsLayout->setSpacing(12);

    m_modeGroup = new QButtonGroup(this);

    // Option 1 Card: Create a new library database
    m_cardCreateNew = new QFrame(m_cardFrame);
    m_cardCreateNew->setObjectName("cardCreateNew");
    m_cardCreateNew->setCursor(Qt::PointingHandCursor);
    auto *layoutOpt1 = new QVBoxLayout(m_cardCreateNew);
    layoutOpt1->setContentsMargins(12, 10, 12, 10);
    layoutOpt1->setSpacing(4);

    m_radioCreateNew = new QRadioButton("Create a new library database", m_cardCreateNew);
    m_radioCreateNew->setFont(QFont("Plus Jakarta Sans", 10, QFont::DemiBold));
    m_radioCreateNew->setChecked(true);
    layoutOpt1->addWidget(m_radioCreateNew);

    auto *descOpt1 = new QLabel("Initialize a fresh catalog and default schemas for campus workstations.", m_cardCreateNew);
    descOpt1->setFont(QFont("Plus Jakarta Sans", 8));
    descOpt1->setStyleSheet("color: #64748B; margin-left: 20px;");
    descOpt1->setWordWrap(true);
    layoutOpt1->addWidget(descOpt1);

    m_modeGroup->addButton(m_radioCreateNew, 0);
    optionsLayout->addWidget(m_cardCreateNew, 1);

    // Option 2 Card: Open an existing library database
    m_cardOpenExisting = new QFrame(m_cardFrame);
    m_cardOpenExisting->setObjectName("cardOpenExisting");
    m_cardOpenExisting->setCursor(Qt::PointingHandCursor);
    auto *layoutOpt2 = new QVBoxLayout(m_cardOpenExisting);
    layoutOpt2->setContentsMargins(12, 10, 12, 10);
    layoutOpt2->setSpacing(4);

    m_radioOpenExisting = new QRadioButton("Open an existing library database", m_cardOpenExisting);
    m_radioOpenExisting->setFont(QFont("Plus Jakarta Sans", 10, QFont::DemiBold));
    layoutOpt2->addWidget(m_radioOpenExisting);

    auto *descOpt2 = new QLabel("Mount a database moved from another PC or restored from backup (.db).", m_cardOpenExisting);
    descOpt2->setFont(QFont("Plus Jakarta Sans", 8));
    descOpt2->setStyleSheet("color: #64748B; margin-left: 20px;");
    descOpt2->setWordWrap(true);
    layoutOpt2->addWidget(descOpt2);

    m_modeGroup->addButton(m_radioOpenExisting, 1);
    optionsLayout->addWidget(m_cardOpenExisting, 1);

    cardLayout->addLayout(optionsLayout);

    // 3. Folder / Database Row: Read-only path box (JetBrains Mono) + [Browse...]
    auto *pathRowLayout = new QVBoxLayout();
    pathRowLayout->setSpacing(6);

    auto *pathLabelLayout = new QHBoxLayout();
    auto *lblPathTitle = new QLabel("Storage Path Location:", m_cardFrame);
    lblPathTitle->setFont(QFont("Plus Jakarta Sans", 9, QFont::Bold));
    lblPathTitle->setStyleSheet("color: #CBD5E1;");
    pathLabelLayout->addWidget(lblPathTitle);

    pathLabelLayout->addStretch(1);

    m_btnRecommended = new QPushButton("Use recommended folder", m_cardFrame);
    m_btnRecommended->setCursor(Qt::PointingHandCursor);
    m_btnRecommended->setStyleSheet(
        "QPushButton {"
        "  background: transparent;"
        "  color: #60A5FA;"
        "  border: none;"
        "  font-size: 11px;"
        "  text-decoration: underline;"
        "}"
        "QPushButton:hover { color: #93C5FD; }"
    );
    pathLabelLayout->addWidget(m_btnRecommended);
    pathRowLayout->addLayout(pathLabelLayout);

    auto *inputLayout = new QHBoxLayout();
    inputLayout->setSpacing(8);

    m_pathEdit = new QLineEdit(m_cardFrame);
    m_pathEdit->setReadOnly(true);
    m_pathEdit->setFont(QFont("JetBrains Mono", 10));
    m_pathEdit->setStyleSheet(
        "QLineEdit {"
        "  background-color: #0F172A;"
        "  color: #F8FAFC;"
        "  border: 1px solid #475569;"
        "  border-radius: 6px;"
        "  padding: 8px 12px;"
        "}"
    );
    m_pathEdit->setPlaceholderText("Select folder or existing database...");
    inputLayout->addWidget(m_pathEdit, 1);

    m_btnBrowse = new QPushButton("Browse...", m_cardFrame);
    m_btnBrowse->setCursor(Qt::PointingHandCursor);
    m_btnBrowse->setFont(QFont("Plus Jakarta Sans", 10, QFont::DemiBold));
    m_btnBrowse->setStyleSheet(
        "QPushButton {"
        "  background-color: #1E293B;"
        "  color: #F1F5F9;"
        "  border: 1px solid #475569;"
        "  border-radius: 6px;"
        "  padding: 8px 16px;"
        "}"
        "QPushButton:hover { background-color: #334155; border-color: #64748B; }"
        "QPushButton:focus { border: 2px solid #F59E0B; outline: none; }"
    );
    inputLayout->addWidget(m_btnBrowse);
    pathRowLayout->addLayout(inputLayout);

    cardLayout->addLayout(pathRowLayout);

    // 4. Preview Lines & Live Status Line
    auto *previewBox = new QFrame(m_cardFrame);
    previewBox->setStyleSheet(
        "QFrame {"
        "  background-color: rgba(15, 23, 42, 0.7);"
        "  border: 1px solid #1E293B;"
        "  border-radius: 8px;"
        "  padding: 8px 12px;"
        "}"
    );
    auto *previewLayout = new QVBoxLayout(previewBox);
    previewLayout->setContentsMargins(8, 8, 8, 8);
    previewLayout->setSpacing(4);

    m_previewDbLabel = new QLabel("Database file: <folder>\\ULM_Library.db", previewBox);
    m_previewDbLabel->setFont(QFont("JetBrains Mono", 9));
    m_previewDbLabel->setStyleSheet("color: #94A3B8;");
    previewLayout->addWidget(m_previewDbLabel);

    m_previewBackupsLabel = new QLabel("Backups: <folder>\\Backups", previewBox);
    m_previewBackupsLabel->setFont(QFont("JetBrains Mono", 9));
    m_previewBackupsLabel->setStyleSheet("color: #64748B;");
    previewLayout->addWidget(m_previewBackupsLabel);

    m_existingDbSummaryLabel = new QLabel(previewBox);
    m_existingDbSummaryLabel->setFont(QFont("JetBrains Mono", 9));
    m_existingDbSummaryLabel->setStyleSheet("color: #38BDF8;");
    m_existingDbSummaryLabel->setVisible(false);
    previewLayout->addWidget(m_existingDbSummaryLabel);

    cardLayout->addWidget(previewBox);

    // 5. Network Warning Frame (UNC / Mapped Share) with Required "I understand" Checkbox
    m_networkWarningFrame = new QFrame(m_cardFrame);
    m_networkWarningFrame->setStyleSheet(
        "QFrame {"
        "  background-color: rgba(245, 158, 11, 0.15);"
        "  border: 1px solid rgba(245, 158, 11, 0.4);"
        "  border-radius: 8px;"
        "  padding: 8px 10px;"
        "}"
    );
    auto *netLayout = new QVBoxLayout(m_networkWarningFrame);
    netLayout->setContentsMargins(8, 6, 8, 6);
    netLayout->setSpacing(6);

    auto *netMsg = new QLabel("SQLite can corrupt on network shares. Using a local disk is strongly recommended.", m_networkWarningFrame);
    netMsg->setFont(QFont("Plus Jakarta Sans", 9, QFont::Bold));
    netMsg->setStyleSheet("color: #FCD34D;");
    netMsg->setWordWrap(true);
    netLayout->addWidget(netMsg);

    m_chkNetworkUnderstood = new QCheckBox("I understand the corruption risk of running SQLite over a network share", m_networkWarningFrame);
    m_chkNetworkUnderstood->setFont(QFont("Plus Jakarta Sans", 9));
    m_chkNetworkUnderstood->setStyleSheet("color: #F1F5F9;");
    netLayout->addWidget(m_chkNetworkUnderstood);

    m_networkWarningFrame->setVisible(false);
    cardLayout->addWidget(m_networkWarningFrame);

    // Live Status Line (Green "Folder is ready" or Red/Amber message)
    m_statusLabel = new QLabel(m_cardFrame);
    m_statusLabel->setFont(QFont("Plus Jakarta Sans", 9, QFont::DemiBold));
    m_statusLabel->setStyleSheet("color: #94A3B8;");
    m_statusLabel->setWordWrap(true);
    cardLayout->addWidget(m_statusLabel);

    cardLayout->addStretch(1);

    // 6. Action Buttons at the bottom right: [Exit] (secondary) and [Continue] (primary amber)
    auto *buttonsLayout = new QHBoxLayout();
    buttonsLayout->setSpacing(12);
    buttonsLayout->addStretch(1);

    m_btnExit = new QPushButton("Exit", m_cardFrame);
    m_btnExit->setCursor(Qt::PointingHandCursor);
    m_btnExit->setFont(QFont("Plus Jakarta Sans", 10, QFont::DemiBold));
    m_btnExit->setStyleSheet(
        "QPushButton {"
        "  background-color: #1E293B;"
        "  color: #94A3B8;"
        "  border: 1px solid #334155;"
        "  border-radius: 6px;"
        "  padding: 8px 20px;"
        "}"
        "QPushButton:hover { background-color: #334155; color: #F1F5F9; }"
        "QPushButton:focus { border: 2px solid #F59E0B; outline: none; }"
    );
    buttonsLayout->addWidget(m_btnExit);

    m_btnContinue = new QPushButton("Continue", m_cardFrame);
    m_btnContinue->setCursor(Qt::PointingHandCursor);
    m_btnContinue->setFont(QFont("Plus Jakarta Sans", 10, QFont::Bold));
    m_btnContinue->setStyleSheet(
        "QPushButton {"
        "  background-color: #F59E0B;"
        "  color: #020617;"
        "  border: 1px solid #D97706;"
        "  border-radius: 6px;"
        "  padding: 8px 24px;"
        "}"
        "QPushButton:hover { background-color: #FBBF24; }"
        "QPushButton:disabled {"
        "  background-color: #334155;"
        "  color: #64748B;"
        "  border: 1px solid #1E293B;"
        "}"
        "QPushButton:focus { border: 2px solid #FFFFFF; outline: none; }"
    );
    m_btnContinue->setEnabled(false);
    buttonsLayout->addWidget(m_btnContinue);

    cardLayout->addLayout(buttonsLayout);
    rootLayout->addWidget(m_cardFrame);

    // Connect signals & slots
    connect(m_modeGroup, &QButtonGroup::idClicked, this, &StorageSetupDialog::onModeChanged);
    connect(m_btnBrowse, &QPushButton::clicked, this, &StorageSetupDialog::onBrowseClicked);
    connect(m_btnRecommended, &QPushButton::clicked, this, &StorageSetupDialog::onUseRecommendedClicked);
    connect(m_chkNetworkUnderstood, &QCheckBox::stateChanged, this, &StorageSetupDialog::onNetworkUnderstoodChanged);
    connect(m_btnContinue, &QPushButton::clicked, this, &StorageSetupDialog::onContinueClicked);
    connect(m_btnExit, &QPushButton::clicked, this, &StorageSetupDialog::onExitClicked);

    // Tab order setup for accessibility
    setTabOrder(m_radioCreateNew, m_radioOpenExisting);
    setTabOrder(m_radioOpenExisting, m_btnRecommended);
    setTabOrder(m_btnRecommended, m_btnBrowse);
    setTabOrder(m_btnBrowse, m_chkNetworkUnderstood);
    setTabOrder(m_chkNetworkUnderstood, m_btnExit);
    setTabOrder(m_btnExit, m_btnContinue);
}

void StorageSetupDialog::applyTheme() {
    QString activeCard = 
        "QFrame {"
        "  background-color: rgba(245, 158, 11, 0.08);"
        "  border: 1.5px solid #F59E0B;"
        "  border-radius: 8px;"
        "}";
    QString inactiveCard = 
        "QFrame {"
        "  background-color: #0F172A;"
        "  border: 1px solid #334155;"
        "  border-radius: 8px;"
        "}";

    if (m_mode == StorageSetupMode::CreateNew) {
        m_cardCreateNew->setStyleSheet(activeCard);
        m_cardOpenExisting->setStyleSheet(inactiveCard);
    } else {
        m_cardCreateNew->setStyleSheet(inactiveCard);
        m_cardOpenExisting->setStyleSheet(activeCard);
    }
}

void StorageSetupDialog::onModeChanged(int id) {
    m_mode = (id == 0) ? StorageSetupMode::CreateNew : StorageSetupMode::OpenExisting;
    applyTheme();

    if (m_mode == StorageSetupMode::CreateNew) {
        m_btnRecommended->setVisible(true);
        if (m_currentPath.endsWith(".db", Qt::CaseInsensitive)) {
            QFileInfo fi(m_currentPath);
            onPathChanged(fi.absolutePath());
        } else {
            updateValidationUi();
        }
    } else {
        m_btnRecommended->setVisible(false);
        updateValidationUi();
    }
}

void StorageSetupDialog::onBrowseClicked() {
    if (m_mode == StorageSetupMode::CreateNew) {
        QString dir = QFileDialog::getExistingDirectory(
            this,
            "Select Folder for Library Database",
            m_currentPath.isEmpty() ? QStandardPaths::writableLocation(QStandardPaths::DocumentsLocation) : m_currentPath,
            QFileDialog::ShowDirsOnly | QFileDialog::DontResolveSymlinks
        );
        if (!dir.isEmpty()) {
            onPathChanged(QDir::toNativeSeparators(dir));
        }
    } else {
        QString file = QFileDialog::getOpenFileName(
            this,
            "Open Existing ULM Library Database",
            m_currentPath.isEmpty() ? QStandardPaths::writableLocation(QStandardPaths::DocumentsLocation) : m_currentPath,
            "SQLite Database (*.db *.sqlite *.sqlite3);;All Files (*.*)"
        );
        if (!file.isEmpty()) {
            onPathChanged(QDir::toNativeSeparators(file));
        }
    }
}

void StorageSetupDialog::onUseRecommendedClicked() {
    m_radioCreateNew->setChecked(true);
    onModeChanged(0);
    QString rec = getRecommendedFolder();
    onPathChanged(rec);
}

void StorageSetupDialog::onPathChanged(const QString &newPath) {
    m_currentPath = newPath;
    m_pathEdit->setText(m_currentPath);
    updateValidationUi();
}

void StorageSetupDialog::onNetworkUnderstoodChanged(int) {
    updateValidationUi();
}

StorageValidationResult StorageSetupDialog::validateStorage(const QString &path, StorageSetupMode mode) {
    StorageValidationResult res;
    if (path.trimmed().isEmpty()) {
        res.isValid = false;
        res.errorMessage = "Please choose a storage location.";
        return res;
    }

    QString normalized = QDir::fromNativeSeparators(path.trimmed());

    // 1. Reject Program Files and Windows folders
    QString winDir = QDir::fromNativeSeparators(QDir::cleanPath("C:/Windows"));
    QString prog1 = QDir::fromNativeSeparators(QDir::cleanPath("C:/Program Files"));
    QString prog2 = QDir::fromNativeSeparators(QDir::cleanPath("C:/Program Files (x86)"));

    if (normalized.startsWith(winDir, Qt::CaseInsensitive) ||
        normalized.startsWith(prog1, Qt::CaseInsensitive) ||
        normalized.startsWith(prog2, Qt::CaseInsensitive)) {
        res.isValid = false;
        res.isProgramFilesOrWindows = true;
        res.errorMessage = "Access denied: Cannot store database inside Program Files or Windows system folders.";
        return res;
    }

    // 2. Check Network Path (UNC prefix \\ or //)
    if (path.startsWith("\\\\") || path.startsWith("//")) {
        res.isNetworkPath = true;
    }

    if (mode == StorageSetupMode::CreateNew) {
        // Target folder
        QDir dir(normalized);
        QString folderPath = normalized;
        QString dbPath = QDir::toNativeSeparators(folderPath + "/ULM_Library.db");

        // Check if path is actually a file
        QFileInfo fi(folderPath);
        if (fi.isFile()) {
            folderPath = fi.absolutePath();
            dbPath = QDir::toNativeSeparators(folderPath + "/ULM_Library.db");
            dir = QDir(folderPath);
        }

        // Test if folder exists or can be created
        if (!dir.exists()) {
            if (!dir.mkpath(".")) {
                res.isValid = false;
                res.errorMessage = QString("Cannot create directory at: %1").arg(QDir::toNativeSeparators(folderPath));
                return res;
            }
        }

        // Test writability (create and remove temporary file)
        QString testFile = folderPath + "/.ulm_write_test_" + QUuid::createUuid().toString(QUuid::WithoutBraces);
        QFile f(testFile);
        if (!f.open(QIODevice::WriteOnly)) {
            res.isValid = false;
            res.errorMessage = "Directory is read-only. Please choose a writable directory on this computer.";
            return res;
        }
        f.close();
        f.remove();

        // Check free disk space (< 500 MB warning)
        QStorageInfo storage(folderPath);
        if (storage.isValid()) {
            qint64 freeMb = storage.bytesAvailable() / (1024 * 1024);
            if (freeMb < 500) {
                res.isLowDiskSpace = true;
                res.warningMessage = QString("Low disk space warning: Only %1 MB available on drive (recommended: > 500 MB).").arg(freeMb);
            }
            if (storage.isReadOnly()) {
                res.isValid = false;
                res.errorMessage = "Selected storage device is read-only.";
                return res;
            }
            // Check drive type
            if (storage.name().contains("Removable", Qt::CaseInsensitive)) {
                res.isRemovableDrive = true;
            }
        }

        // Check if ULM_Library.db already exists there
        QFile dbFile(dbPath);
        if (dbFile.exists()) {
            res.fileAlreadyExists = true;
            res.warningMessage = "A database file (ULM_Library.db) already exists in this folder. Continue to open it, or choose another folder.";
        }

        res.isValid = true;
        m_finalFolderPath = QDir::toNativeSeparators(folderPath);
        m_finalDatabasePath = dbPath;

    } else {
        // Open Existing Mode (*.db file)
        QFileInfo fi(normalized);
        if (!fi.exists() || !fi.isFile()) {
            res.isValid = false;
            res.errorMessage = "Database file does not exist or is not a valid file.";
            return res;
        }

        m_finalDatabasePath = QDir::toNativeSeparators(fi.absoluteFilePath());
        m_finalFolderPath = QDir::toNativeSeparators(fi.absolutePath());

        // Validate SQLite file via temporary connection
        QString connName = "validate_existing_" + QUuid::createUuid().toString(QUuid::WithoutBraces);
        {
            QSqlDatabase tempDb = QSqlDatabase::addDatabase("QSQLITE", connName);
            tempDb.setDatabaseName(m_finalDatabasePath);
            if (!tempDb.open()) {
                res.isValid = false;
                res.errorMessage = QString("Cannot open SQLite file: %1").arg(tempDb.lastError().text());
                QSqlDatabase::removeDatabase(connName);
                return res;
            }

            // PRAGMA integrity_check
            QSqlQuery q(tempDb);
            if (q.exec("PRAGMA integrity_check;") && q.next()) {
                QString check = q.value(0).toString();
                if (check != "ok") {
                    res.isValid = false;
                    res.errorMessage = QString("Database integrity check failed: %1").arg(check);
                    tempDb.close();
                    QSqlDatabase::removeDatabase(connName);
                    return res;
                }
            }

            // Check user_version
            int version = 0;
            if (q.exec("PRAGMA user_version;") && q.next()) {
                version = q.value(0).toInt();
            }
            res.schemaVersion = version;
            if (version > 5) {
                res.isValid = false;
                res.errorMessage = QString("Database is from a newer version (Schema v%1). Please update LMS.").arg(version);
                tempDb.close();
                QSqlDatabase::removeDatabase(connName);
                return res;
            }

            // Fetch summary stats
            if (q.exec("SELECT COUNT(*) FROM books WHERE is_active = 1;") && q.next()) {
                res.booksCount = q.value(0).toInt();
            }
            if (q.exec("SELECT COUNT(*) FROM borrowers WHERE is_active = 1;") && q.next()) {
                res.borrowersCount = q.value(0).toInt();
            }

            res.lastModified = fi.lastModified().toString("yyyy-MM-dd HH:mm");
            tempDb.close();
        }
        QSqlDatabase::removeDatabase(connName);

        res.isValid = true;
    }

    return res;
}

void StorageSetupDialog::updateValidationUi() {
    m_lastValidation = validateStorage(m_currentPath, m_mode);

    // Update Preview Labels
    if (!m_finalFolderPath.isEmpty()) {
        m_previewDbLabel->setText(QString("Database file: %1").arg(m_finalDatabasePath));
        m_previewBackupsLabel->setText(QString("Backups: %1\\Backups").arg(m_finalFolderPath));
    } else {
        m_previewDbLabel->setText("Database file: <folder>\\ULM_Library.db");
        m_previewBackupsLabel->setText("Backups: <folder>\\Backups");
    }

    // Existing DB summary
    if (m_mode == StorageSetupMode::OpenExisting && m_lastValidation.isValid) {
        m_existingDbSummaryLabel->setText(
            QString("Records: %1 books, %2 borrowers | Last modified: %3 (Schema v%4)")
            .arg(m_lastValidation.booksCount)
            .arg(m_lastValidation.borrowersCount)
            .arg(m_lastValidation.lastModified)
            .arg(m_lastValidation.schemaVersion)
        );
        m_existingDbSummaryLabel->setVisible(true);
    } else {
        m_existingDbSummaryLabel->setVisible(false);
    }

    // Network Warning display
    m_networkWarningFrame->setVisible(m_lastValidation.isNetworkPath);

    // Update Status line text & color
    if (!m_lastValidation.isValid) {
        m_statusLabel->setText(QString("❌ %1").arg(m_lastValidation.errorMessage));
        m_statusLabel->setStyleSheet("color: #FB7185; font-size: 11px;");
        m_btnContinue->setEnabled(false);
    } else if (!m_lastValidation.warningMessage.isEmpty()) {
        m_statusLabel->setText(QString("⚠️ %1").arg(m_lastValidation.warningMessage));
        m_statusLabel->setStyleSheet("color: #FBBF24; font-size: 11px;");
        
        bool canProceed = true;
        if (m_lastValidation.isNetworkPath && !m_chkNetworkUnderstood->isChecked()) {
            canProceed = false;
        }
        m_btnContinue->setEnabled(canProceed);
    } else {
        if (m_lastValidation.isNetworkPath && !m_chkNetworkUnderstood->isChecked()) {
            m_statusLabel->setText("⚠️ Please check 'I understand' to proceed with a network location.");
            m_statusLabel->setStyleSheet("color: #FBBF24; font-size: 11px;");
            m_btnContinue->setEnabled(false);
        } else {
            m_statusLabel->setText("✓ Storage location is ready and verified.");
            m_statusLabel->setStyleSheet("color: #34D399; font-size: 11px;");
            m_btnContinue->setEnabled(true);
        }
    }
}

void StorageSetupDialog::onContinueClicked() {
    if (!m_lastValidation.isValid) return;

    if (m_lastValidation.isNetworkPath && !m_chkNetworkUnderstood->isChecked()) {
        QMessageBox::warning(this, "Network Location Acknowledgment",
            "Please confirm that you understand SQLite may encounter locking issues or database corruption when hosted over network shares.");
        return;
    }

    // Create Backups subfolder
    QDir folderDir(m_finalFolderPath);
    if (!folderDir.exists("Backups")) {
        folderDir.mkpath("Backups");
    }

    // Single-instance lock test (ULM_Library.db.lock)
    QString lockFilePath = m_finalFolderPath + "/ULM_Library.db.lock";
    QFile *lockFile = new QFile(lockFilePath, this);
    if (!lockFile->open(QIODevice::ReadWrite)) {
        QMessageBox::critical(this, "Database Locked",
            "Cannot open database: The library database is already in use by another instance of ULM LMS on this or another workstation.\n\nPlease close the other instance first.");
        return;
    }

    emit storageConfigured(m_finalFolderPath, m_finalDatabasePath);
    accept();
}

void StorageSetupDialog::onExitClicked() {
    auto reply = QMessageBox::question(
        this,
        "Exit Setup",
        "Are you sure you want to exit the Library Management System?",
        QMessageBox::Yes | QMessageBox::No,
        QMessageBox::No
    );
    if (reply == QMessageBox::Yes) {
        reject();
        qApp->quit();
    }
}

void StorageSetupDialog::keyPressEvent(QKeyEvent *event) {
    if (event->key() == Qt::Key_Return || event->key() == Qt::Key_Enter) {
        if (m_btnContinue->isEnabled()) {
            onContinueClicked();
            return;
        }
    } else if (event->key() == Qt::Key_Escape) {
        onExitClicked();
        return;
    }
    QDialog::keyPressEvent(event);
}

void StorageSetupDialog::closeEvent(QCloseEvent *event) {
    onExitClicked();
    event->ignore();
}
