#pragma once

#include <QWidget>
#include <QTableWidget>
#include <QLineEdit>
#include <QComboBox>
#include <QPushButton>
#include <QLabel>
#include "Models.h"

class BorrowersPage : public QWidget {
    Q_OBJECT
public:
    explicit BorrowersPage(QWidget *parent = nullptr);
    ~BorrowersPage() = default;

signals:
    void issueBookRequested(int borrowerId);

public slots:
    void refreshData();
    void openBorrowerDetailsById(int borrowerId);

private slots:
    void onSearchChanged(const QString &text);
    void onFilterChanged();
    void onAddBorrower();
    void onEditSelected();
    void onViewSelected();
    void onSuspendReactivateSelected();
    void onDeleteSelected();
    void onPrintMemberCard();
    void onImportCsv();
    void onDownloadTemplate();
    void onTableSelectionChanged();

private:
    void setupUi();
    void updateTableData();
    void showBorrowerDetailDialog(const Borrower &b);

    QLineEdit *m_searchInput = nullptr;
    QComboBox *m_roleCombo = nullptr;
    QComboBox *m_statusCombo = nullptr;
    QComboBox *m_deptCombo = nullptr;

    QPushButton *m_btnAdd = nullptr;
    QPushButton *m_btnImportCsv = nullptr;
    QPushButton *m_btnTemplate = nullptr;

    QPushButton *m_btnView = nullptr;
    QPushButton *m_btnEdit = nullptr;
    QPushButton *m_btnIssue = nullptr;
    QPushButton *m_btnSuspend = nullptr;
    QPushButton *m_btnPrintCard = nullptr;
    QPushButton *m_btnDelete = nullptr;

    QTableWidget *m_table = nullptr;
    QLabel *m_statusCountLabel = nullptr;

    QVector<Borrower> m_currentBorrowers;
};
