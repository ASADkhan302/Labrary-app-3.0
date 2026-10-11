#pragma once

#include <QWidget>
#include <QLineEdit>
#include <QSpinBox>
#include <QCheckBox>
#include <QPushButton>
#include <QLabel>

class SettingsPage : public QWidget {
    Q_OBJECT
public:
    explicit SettingsPage(QWidget *parent = nullptr);
    ~SettingsPage() = default;

signals:
    void dataChanged();

private slots:
    void onSaveSettings();
    void onBackupNow();
    void onRestoreDatabase();
    void onClearDemoData();

    // Storage Management (Phase 1 Extension)
    void onOpenStorageFolder();
    void onCopyStoragePath();
    void onMoveDataToNewFolder();
    void onSwitchToExistingDatabase();

private:
    void setupUi();
    void loadSettings();
    void updateStorageDisplay();

    // System parameters
    QLineEdit *m_instNameInput = nullptr;
    QLineEdit *m_libNameInput = nullptr;
    QLineEdit *m_workstationInput = nullptr;
    QSpinBox *m_loanDaysSpin = nullptr;
    QSpinBox *m_fineRateSpin = nullptr;
    QSpinBox *m_graceDaysSpin = nullptr;
    QCheckBox *m_audioToggle = nullptr;

    // Storage Section Widgets
    QLineEdit *m_storagePathDisplay = nullptr;
    QPushButton *m_btnOpenFolder = nullptr;
    QPushButton *m_btnCopyPath = nullptr;
    QPushButton *m_btnMoveData = nullptr;
    QPushButton *m_btnSwitchDb = nullptr;
    QLabel *m_storageStatus = nullptr;

    // Maintenance buttons
    QPushButton *m_btnSave = nullptr;
    QPushButton *m_btnBackup = nullptr;
    QPushButton *m_btnRestore = nullptr;
    QPushButton *m_btnClearDemo = nullptr;
    QLabel *m_statusMessage = nullptr;
};
