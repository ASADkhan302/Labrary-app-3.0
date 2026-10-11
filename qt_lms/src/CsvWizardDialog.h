#pragma once

#include <QDialog>
#include <QLineEdit>
#include <QPushButton>
#include <QTableWidget>
#include <QComboBox>
#include <QProgressBar>
#include <QTextEdit>
#include <QLabel>
#include <QMap>
#include <QStringList>

class CsvWizardDialog : public QDialog {
    Q_OBJECT
public:
    explicit CsvWizardDialog(QWidget *parent = nullptr);
    ~CsvWizardDialog() = default;

private slots:
    void onBrowseFile();
    void onDownloadTemplate();
    void onStartImport();

private:
    void setupUi();
    void parsePreview(const QString &filePath);

    QLineEdit *m_filePathInput = nullptr;
    QPushButton *m_btnBrowse = nullptr;
    QPushButton *m_btnDownloadTemplate = nullptr;

    QTableWidget *m_mappingTable = nullptr;
    QTableWidget *m_previewTable = nullptr;

    QPushButton *m_btnImport = nullptr;
    QProgressBar *m_progressBar = nullptr;
    QTextEdit *m_reportArea = nullptr;
    QLabel *m_statusLabel = nullptr;

    QString m_selectedFilePath;
    QStringList m_csvHeaders;
    QVector<QStringList> m_previewRows;
};
