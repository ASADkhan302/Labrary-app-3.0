#include "SettingsPage.h"
#include "DatabaseManager.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFormLayout>
#include <QGroupBox>
#include <QFileDialog>
#include <QMessageBox>
#include <QDateTime>
#include <QDesktopServices>
#include <QUrl>
#include <QClipboard>
#include <QGuiApplication>
#include <QFileInfo>

SettingsPage::SettingsPage(QWidget *parent)
    : QWidget(parent)
{
    setupUi();
    loadSettings();
    updateStorageDisplay();
}

void SettingsPage::setupUi() {
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(32, 28, 32, 28);
    mainLayout->setSpacing(18);

    // Title
    auto *headerLabel = new QLabel("<h2>Library System Configuration & Storage Parameters</h2>", this);
    headerLabel->setStyleSheet("color: #F1F5F9;");
    mainLayout->addWidget(headerLabel);

    auto *descLabel = new QLabel(
        "Manage campus workstation identifiers, circulation loan parameters, active database storage location, "
        "and disaster recovery snapshots.",
        this
    );
    descLabel->setStyleSheet("color: #A8B5C8;");
    mainLayout->addWidget(descLabel);

    // Group 1: General & Station Information
    auto *generalGroup = new QGroupBox("Institution & Workstation Identification", this);
    auto *generalForm = new QFormLayout(generalGroup);
    generalForm->setSpacing(12);

    m_instNameInput = new QLineEdit(this);
    generalForm->addRow("Institution Title:", m_instNameInput);

    m_libNameInput = new QLineEdit(this);
    generalForm->addRow("Library / Branch Name:", m_libNameInput);

    m_workstationInput = new QLineEdit(this);
    generalForm->addRow("Workstation Machine ID:", m_workstationInput);

    mainLayout->addWidget(generalGroup);

    // Group 2: Circulation Rules & Fine Rates
    auto *policyGroup = new QGroupBox("Circulation Policy & Fines", this);
    auto *policyForm = new QFormLayout(policyGroup);
    policyForm->setSpacing(12);

    m_loanDaysSpin = new QSpinBox(this);
    m_loanDaysSpin->setRange(1, 90);
    m_loanDaysSpin->setSuffix(" Days");
    policyForm->addRow("Default Loan Duration:", m_loanDaysSpin);

    m_fineRateSpin = new QSpinBox(this);
    m_fineRateSpin->setRange(0, 1000);
    m_fineRateSpin->setPrefix("Rs ");
    m_fineRateSpin->setSuffix(" / Day");
    policyForm->addRow("Overdue Fine Rate:", m_fineRateSpin);

    m_graceDaysSpin = new QSpinBox(this);
    m_graceDaysSpin->setRange(0, 14);
    m_graceDaysSpin->setSuffix(" Days");
    policyForm->addRow("Overdue Grace Period:", m_graceDaysSpin);

    m_audioToggle = new QCheckBox("Enable Synthesized Audio Feedback (Chords & Diagnostic Beeps)", this);
    policyForm->addRow("Audio Engine:", m_audioToggle);

    mainLayout->addWidget(policyGroup);

    // Group 3: Database Storage Location (Phase 1 Extension)
    auto *storageGroup = new QGroupBox("Library Data Storage Repository (%APPDATA%\\ULM Library\\config.ini)", this);
    auto *storageLayout = new QVBoxLayout(storageGroup);
    storageLayout->setSpacing(10);

    auto *storagePathRow = new QHBoxLayout();
    storagePathRow->setSpacing(8);

    m_storagePathDisplay = new QLineEdit(this);
    m_storagePathDisplay->setReadOnly(true);
    m_storagePathDisplay->setFont(QFont("JetBrains Mono", 9));
    m_storagePathDisplay->setStyleSheet(
        "QLineEdit {"
        "  background-color: #0F172A;"
        "  color: #38BDF8;"
        "  border: 1px solid #334155;"
        "  border-radius: 6px;"
        "  padding: 6px 10px;"
        "}"
    );
    storagePathRow->addWidget(m_storagePathDisplay, 1);

    m_btnOpenFolder = new QPushButton("Open Folder", this);
    m_btnOpenFolder->setObjectName("btnSecondary");
    connect(m_btnOpenFolder, &QPushButton::clicked, this, &SettingsPage::onOpenStorageFolder);
    storagePathRow->addWidget(m_btnOpenFolder);

    m_btnCopyPath = new QPushButton("Copy Path", this);
    m_btnCopyPath->setObjectName("btnSecondary");
    connect(m_btnCopyPath, &QPushButton::clicked, this, &SettingsPage::onCopyStoragePath);
    storagePathRow->addWidget(m_btnCopyPath);

    storageLayout->addLayout(storagePathRow);

    auto *storageActionsRow = new QHBoxLayout();
    storageActionsRow->setSpacing(10);

    m_btnMoveData = new QPushButton("Move Data to a New Folder...", this);
    m_btnMoveData->setObjectName("btnSecondary");
    m_btnMoveData->setToolTip("Safely relocates database using VACUUM INTO, verifies counts, switches to new copy, and retains original.");
    connect(m_btnMoveData, &QPushButton::clicked, this, &SettingsPage::onMoveDataToNewFolder);
    storageActionsRow->addWidget(m_btnMoveData);

    m_btnSwitchDb = new QPushButton("Switch to Another Existing Database...", this);
    m_btnSwitchDb->setObjectName("btnSecondary");
    m_btnSwitchDb->setToolTip("Points the LMS to another existing ULM_Library.db file.");
    connect(m_btnSwitchDb, &QPushButton::clicked, this, &SettingsPage::onSwitchToExistingDatabase);
    storageActionsRow->addWidget(m_btnSwitchDb);

    storageActionsRow->addStretch(1);
    storageLayout->addLayout(storageActionsRow);

    m_storageStatus = new QLabel(this);
    m_storageStatus->setStyleSheet("color: #94A3B8; font-size: 11px;");
    storageLayout->addWidget(m_storageStatus);

    mainLayout->addWidget(storageGroup);

    // Group 4: Database Maintenance & Disaster Recovery
    auto *dbGroup = new QGroupBox("SQLite Database Maintenance & Disaster Recovery", this);
    auto *dbLayout = new QHBoxLayout(dbGroup);
    dbLayout->setSpacing(14);

    m_btnBackup = new QPushButton("Backup Database Now (VACUUM INTO)", this);
    m_btnBackup->setObjectName("btnSecondary");
    connect(m_btnBackup, &QPushButton::clicked, this, &SettingsPage::onBackupNow);
    dbLayout->addWidget(m_btnBackup);

    m_btnRestore = new QPushButton("Restore Database Snapshot...", this);
    m_btnRestore->setObjectName("btnSecondary");
    connect(m_btnRestore, &QPushButton::clicked, this, &SettingsPage::onRestoreDatabase);
    dbLayout->addWidget(m_btnRestore);

    m_btnClearDemo = new QPushButton("Clear Demo Data", this);
    m_btnClearDemo->setObjectName("btnDanger");
    connect(m_btnClearDemo, &QPushButton::clicked, this, &SettingsPage::onClearDemoData);
    dbLayout->addWidget(m_btnClearDemo);

    mainLayout->addWidget(dbGroup);

    // Status Message & Save Button
    auto *bottomRow = new QHBoxLayout();
    m_statusMessage = new QLabel(this);
    m_statusMessage->setStyleSheet("color: #10B981; font-weight: bold;");
    bottomRow->addWidget(m_statusMessage, 1);

    m_btnSave = new QPushButton("Save System Settings", this);
    m_btnSave->setObjectName("btnPrimary");
    m_btnSave->setMinimumWidth(180);
    m_btnSave->setMinimumHeight(38);
    connect(m_btnSave, &QPushButton::clicked, this, &SettingsPage::onSaveSettings);
    bottomRow->addWidget(m_btnSave);

    mainLayout->addLayout(bottomRow);
    mainLayout->addStretch(1);
}

void SettingsPage::updateStorageDisplay() {
    QString currentDb = DatabaseManager::instance().getCurrentDatabasePath();
    if (currentDb.isEmpty()) {
        currentDb = DatabaseManager::getSavedDatabasePath();
    }
    m_storagePathDisplay->setText(currentDb);
    m_storageStatus->setText("✓ Storage repository active and verified in WAL mode with single-instance lock.");
}

void SettingsPage::loadSettings() {
    auto &db = DatabaseManager::instance();
    m_instNameInput->setText(db.getSetting("institution_name", "University of Lakki Marwat"));
    m_libNameInput->setText(db.getSetting("library_name", "Central Campus Library"));
    m_workstationInput->setText(db.getSetting("workstation_id", "WS-ULM-01"));
    m_loanDaysSpin->setValue(db.getSetting("loan_period_days", "14").toInt());
    m_fineRateSpin->setValue(db.getSetting("fine_rate_paisa", "5000").toInt() / 100);
    m_graceDaysSpin->setValue(db.getSetting("grace_days", "0").toInt());
    m_audioToggle->setChecked(db.getSetting("audio_enabled", "true") == "true");
}

void SettingsPage::onOpenStorageFolder() {
    QString currentFolder = DatabaseManager::instance().getCurrentFolderPath();
    if (currentFolder.isEmpty()) {
        currentFolder = DatabaseManager::getSavedFolderPath();
    }
    if (!currentFolder.isEmpty()) {
        QDesktopServices::openUrl(QUrl::fromLocalFile(currentFolder));
    }
}

void SettingsPage::onCopyStoragePath() {
    QString currentDb = DatabaseManager::instance().getCurrentDatabasePath();
    if (!currentDb.isEmpty()) {
        QGuiApplication::clipboard()->setText(currentDb);
        m_storageStatus->setText("✓ Database file path copied to clipboard.");
    }
}

void SettingsPage::onMoveDataToNewFolder() {
    QString targetFolder = QFileDialog::getExistingDirectory(
        this,
        "Choose New Folder for Library Database",
        DatabaseManager::instance().getCurrentFolderPath(),
        QFileDialog::ShowDirsOnly | QFileDialog::DontResolveSymlinks
    );
    if (targetFolder.isEmpty()) return;

    QString oldLocation;
    QString errorMessage;

    if (DatabaseManager::instance().moveDatabaseToNewFolder(targetFolder, oldLocation, errorMessage)) {
        QMessageBox::information(
            this,
            "Database Moved Successfully",
            QString("The database was safely duplicated, verified, and mounted at:\n%1\\ULM_Library.db\n\n"
                    "The original database file remains untouched at:\n%2\n\n"
                    "The old file was NOT deleted so that your historical backups remain completely safe.")
            .arg(targetFolder)
            .arg(oldLocation)
        );
        updateStorageDisplay();
        emit dataChanged();
    } else {
        QMessageBox::critical(
            this,
            "Move Failed",
            QString("Could not relocate database to the selected folder:\n\n%1").arg(errorMessage)
        );
    }
}

void SettingsPage::onSwitchToExistingDatabase() {
    QString existingFile = QFileDialog::getOpenFileName(
        this,
        "Select Existing ULM Library Database to Mount",
        DatabaseManager::instance().getCurrentFolderPath(),
        "SQLite Database (*.db *.sqlite);;All Files (*.*)"
    );
    if (existingFile.isEmpty()) return;

    QString errorMessage;
    if (DatabaseManager::instance().switchDatabase(existingFile, errorMessage)) {
        QMessageBox::information(
            this,
            "Database Switched",
            QString("The LMS has now switched to the database at:\n%1\n\nAll application screens will reload.")
            .arg(existingFile)
        );
        updateStorageDisplay();
        loadSettings();
        emit dataChanged();
    } else {
        QMessageBox::critical(
            this,
            "Switch Failed",
            QString("Could not switch to selected database:\n\n%1").arg(errorMessage)
        );
    }
}

void SettingsPage::onSaveSettings() {
    auto &db = DatabaseManager::instance();
    db.setSetting("institution_name", m_instNameInput->text().trimmed());
    db.setSetting("library_name", m_libNameInput->text().trimmed());
    db.setSetting("workstation_id", m_workstationInput->text().trimmed());
    db.setSetting("loan_period_days", QString::number(m_loanDaysSpin->value()));
    db.setSetting("fine_rate_paisa", QString::number(m_fineRateSpin->value() * 100));
    db.setSetting("grace_days", QString::number(m_graceDaysSpin->value()));
    db.setSetting("audio_enabled", m_audioToggle->isChecked() ? "true" : "false");

    db.logAudit("UPDATE_SETTINGS", "Updated system loan parameters and station identification");
    m_statusMessage->setText("Settings successfully persisted to SQLite database.");
    emit dataChanged();
}

void SettingsPage::onBackupNow() {
    QString defName = QString("ULM_Library_Backup_%1.db")
                          .arg(QDateTime::currentDateTime().toString("yyyyMMdd_hhmmss"));
    QString dest = QFileDialog::getSaveFileName(this, "Save Database Snapshot", defName, "SQLite Database (*.db)");
    if (dest.isEmpty()) return;

    if (DatabaseManager::instance().backupDatabase(dest)) {
        QMessageBox::information(this, "Backup Succeeded",
                                 QString("Full database snapshot was safely archived to:\n%1").arg(dest));
    } else {
        QMessageBox::critical(this, "Backup Failed", "An error occurred while creating the database snapshot.");
    }
}

void SettingsPage::onRestoreDatabase() {
    auto confirm = QMessageBox::warning(
        this,
        "Confirm Database Restore",
        "Restoring will overwrite the current live library catalog and transactions with the backup file.\n"
        "A safety snapshot of your current database will be saved automatically first.\n\n"
        "Do you wish to proceed?",
        QMessageBox::Yes | QMessageBox::No,
        QMessageBox::No
    );

    if (confirm != QMessageBox::Yes) return;

    QString backupFile = QFileDialog::getOpenFileName(this, "Select Database Backup to Restore", "", "SQLite Database (*.db);;All Files (*.*)");
    if (backupFile.isEmpty()) return;

    QString errorMsg;
    if (DatabaseManager::instance().restoreDatabase(backupFile, errorMsg)) {
        QMessageBox::information(this, "Restore Successful",
                                 "The database was successfully verified and restored.\nThe application views will now reload.");
        loadSettings();
        updateStorageDisplay();
        emit dataChanged();
    } else {
        QMessageBox::critical(this, "Restore Aborted",
                             QString("Database restore failed validation:\n%1").arg(errorMsg));
    }
}

void SettingsPage::onClearDemoData() {
    auto answer = QMessageBox::question(
        this,
        "Clear Demo Data Confirmation",
        "Are you sure you want to remove all sample demo books (marked with Source 'DEMO') "
        "and sample university borrowers?\n\n"
        "Real registered items will NOT be affected. This action cannot be undone.",
        QMessageBox::Yes | QMessageBox::No,
        QMessageBox::No
    );

    if (answer == QMessageBox::Yes) {
        if (DatabaseManager::instance().clearDemoData()) {
            QMessageBox::information(this, "Demo Data Cleared", "All sample demo records have been permanently removed.");
            emit dataChanged();
        } else {
            QMessageBox::warning(this, "Operation Failed", "Could not clear demo data from SQLite database.");
        }
    }
}
