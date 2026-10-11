#pragma once

#include <QDialog>
#include <QLineEdit>
#include <QPushButton>
#include <QRadioButton>
#include <QLabel>
#include <QCheckBox>
#include <QButtonGroup>
#include <QFrame>
#include <QString>
#include "Models.h"

enum class StorageSetupMode {
    CreateNew,
    OpenExisting
};

struct StorageValidationResult {
    bool isValid = false;
    bool isNetworkPath = false;
    bool isLowDiskSpace = false;
    bool isRemovableDrive = false;
    bool fileAlreadyExists = false;
    bool isProgramFilesOrWindows = false;
    QString errorMessage;
    QString warningMessage;
    // Option 2 info
    int booksCount = 0;
    int borrowersCount = 0;
    int schemaVersion = 0;
    QString lastModified;
};

class StorageSetupDialog : public QDialog {
    Q_OBJECT
public:
    explicit StorageSetupDialog(QWidget *parent = nullptr, 
                                bool isMissingPath = false, 
                                const QString &missingPath = QString());
    ~StorageSetupDialog() = default;

    QString getSelectedDatabasePath() const { return m_finalDatabasePath; }
    QString getSelectedFolderPath() const { return m_finalFolderPath; }
    StorageSetupMode getSetupMode() const { return m_mode; }

signals:
    void storageConfigured(const QString &folderPath, const QString &dbPath);

protected:
    void closeEvent(QCloseEvent *event) override;
    void keyPressEvent(QKeyEvent *event) override;

private slots:
    void onModeChanged(int id);
    void onBrowseClicked();
    void onUseRecommendedClicked();
    void onPathChanged(const QString &newPath);
    void onNetworkUnderstoodChanged(int state);
    void onContinueClicked();
    void onExitClicked();

private:
    void setupUi();
    void applyTheme();
    StorageValidationResult validateStorage(const QString &path, StorageSetupMode mode);
    void updateValidationUi();
    QString getRecommendedFolder() const;

    bool m_isMissingPath = false;
    QString m_missingPath;
    StorageSetupMode m_mode = StorageSetupMode::CreateNew;

    QString m_currentPath;
    QString m_finalFolderPath;
    QString m_finalDatabasePath;
    StorageValidationResult m_lastValidation;

    // UI Widgets
    QFrame *m_cardFrame = nullptr;
    QLabel *m_missingPathBanner = nullptr;

    QRadioButton *m_radioCreateNew = nullptr;
    QRadioButton *m_radioOpenExisting = nullptr;
    QFrame *m_cardCreateNew = nullptr;
    QFrame *m_cardOpenExisting = nullptr;
    QButtonGroup *m_modeGroup = nullptr;

    QLineEdit *m_pathEdit = nullptr;
    QPushButton *m_btnBrowse = nullptr;
    QPushButton *m_btnRecommended = nullptr;

    QLabel *m_previewDbLabel = nullptr;
    QLabel *m_previewBackupsLabel = nullptr;
    QLabel *m_statusLabel = nullptr;

    QFrame *m_networkWarningFrame = nullptr;
    QCheckBox *m_chkNetworkUnderstood = nullptr;

    QLabel *m_existingDbSummaryLabel = nullptr;

    QPushButton *m_btnExit = nullptr;
    QPushButton *m_btnContinue = nullptr;
};
