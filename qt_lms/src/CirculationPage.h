#pragma once

#include <QWidget>
#include <QLineEdit>
#include <QPushButton>
#include <QRadioButton>
#include <QButtonGroup>
#include <QTableWidget>
#include <QLabel>
#include "Models.h"
#include "DatabaseManager.h"

class CirculationPage : public QWidget {
    Q_OBJECT
public:
    explicit CirculationPage(QWidget *parent = nullptr);
    ~CirculationPage() = default;

public slots:
    void refreshLoans();
    void setScannedCode(const QString &barcode);

private slots:
    void onBookLookup();
    void onBorrowerLookup();
    void onIssueClicked();
    void onReturnClicked();
    void onActiveLoanSelectionChanged();

private:
    void setupUi();
    void clearIssueForm();

    // Left Panel: Issue Form
    QLineEdit *m_bookBarcodeEdit = nullptr;
    QLabel *m_bookInfoLabel = nullptr;
    QLineEdit *m_borrowerIdEdit = nullptr;
    QLabel *m_borrowerInfoLabel = nullptr;

    QButtonGroup *m_presetGroup = nullptr;
    QRadioButton *m_radio7 = nullptr;
    QRadioButton *m_radio14 = nullptr;
    QRadioButton *m_radio30 = nullptr;

    QPushButton *m_btnIssue = nullptr;

    // Test Scan Tool
    QLineEdit *m_testScanInput = nullptr;

    // Right Panel: Active Loans Table
    QTableWidget *m_loansTable = nullptr;
    QPushButton *m_btnReturn = nullptr;
    QLabel *m_activeSummaryLabel = nullptr;

    int m_selectedBookId = 0;
    int m_selectedBorrowerId = 0;
    QVector<ActiveLoanInfo> m_currentLoans;
};
