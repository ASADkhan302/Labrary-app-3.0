#include <QApplication>
#include <QFile>
#include <QFontDatabase>
#include <QDebug>
#include <QMessageBox>
#include <QFileInfo>
#include <QDir>
#include "DatabaseManager.h"
#include "StorageSetupDialog.h"
#include "MainWindow.h"
#include "BootSplashScreen.h"

int main(int argc, char *argv[]) {
    // Windows 10/11 DPI Awareness
    QApplication::setHighDpiScaleFactorRoundingPolicy(Qt::HighDpiScaleFactorRoundingPolicy::PassThrough);

    QApplication app(argc, argv);
    app.setApplicationName("ULM_LibraryManagementSystem");
    app.setApplicationDisplayName("University of Lakki Marwat - Central Campus LMS");
    app.setOrganizationName("University of Lakki Marwat");
    app.setOrganizationDomain("ulm.edu.pk");
    app.setApplicationVersion("1.0.0");

    // Load Permanent High-Contrast Dark QSS Stylesheet
    QFile qssFile(":/resources/style.qss");
    if (qssFile.open(QFile::ReadOnly | QFile::Text)) {
        app.setStyleSheet(QString::fromUtf8(qssFile.readAll()));
        qssFile.close();
    } else {
        qWarning() << "Warning: Could not load :/resources/style.qss";
    }

    // Step 1: Check Storage Configuration in %APPDATA%\ULM Library\config.ini
    QString savedDbPath = DatabaseManager::getSavedDatabasePath();
    QString savedFolderPath = DatabaseManager::getSavedFolderPath();

    bool needsSetup = false;
    bool isMissing = false;

    if (savedDbPath.isEmpty() || savedFolderPath.isEmpty()) {
        // Case 1: First launch (no saved config)
        needsSetup = true;
        isMissing = false;
    } else {
        // Case 2: Check if saved location exists and is accessible
        QFileInfo fi(savedDbPath);
        QDir folderDir(savedFolderPath);
        if (!folderDir.exists() || !fi.exists()) {
            needsSetup = true;
            isMissing = true;
        }
    }

    QString finalFolderPath = savedFolderPath;
    QString finalDbPath = savedDbPath;

    if (needsSetup) {
        StorageSetupDialog setupDialog(nullptr, isMissing, savedDbPath);
        if (setupDialog.exec() != QDialog::Accepted) {
            // User chose Exit or cancelled
            return 0;
        }
        finalFolderPath = setupDialog.getSelectedFolderPath();
        finalDbPath = setupDialog.getSelectedDatabasePath();
    }

    // Step 2: Initialize Database and Acquire Single-Instance Lock
    QString errorMsg;
    if (!DatabaseManager::instance().initializeStorage(finalFolderPath, finalDbPath, errorMsg)) {
        QMessageBox::critical(nullptr, "Storage & Database Error", 
            QString("Could not initialize the library database:\n\n%1\n\n"
                    "If another instance of ULM LMS is running, please close it and try again.")
            .arg(errorMsg));
        return 1;
    }

    // Step 3: Instantiate Main Window
    auto *mainWindow = new MainWindow();

    // Step 4: Boot Splash: 2.5 s animated diagnostic lines (ULM BIOS 2.4, SQLite mounted, scanner ready), skippable
    auto *splash = new BootSplashScreen();
    QObject::connect(splash, &BootSplashScreen::bootCompleted, [mainWindow]() {
        mainWindow->show();
    });

    splash->show();

    return app.exec();
}
