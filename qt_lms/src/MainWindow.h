#pragma once

#include <QMainWindow>
#include <QTableView>
#include <QLineEdit>
#include <QPushButton>
#include <QLabel>
#include <QTimer>
#include <QButtonGroup>
#include <QStackedWidget>
#include "CatalogModel.h"
#include "CirculationPage.h"
#include "BorrowersPage.h"
#include "ReportsPage.h"
#include "SettingsPage.h"
#include "BarcodeScannerFilter.h"

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow() = default;

private slots:
    void onNavButtonClicked(int id);
    void onSearchTextChanged(const QString &text);
    void onSearchDebounceTimeout();
    void onCategoryChipClicked(int id);
    void onAddBookClicked();
    void onEditSelectedBook();
    void onWithdrawSelectedBook();
    void onPrintLabelSelected();
    void onIssueSelectedFromCatalog();
    void onImportCsvClicked();
    void onTableDoubleClicked(const QModelIndex &index);
    void onBarcodeScanned(const QString &barcode);
    void updateHoldingCount();
    void refreshAllViews();

private:
    void setupUi();
    void setupNavigationRail();
    void setupHeaderStrip();
    QWidget* createCatalogView();

    // Navigation Stack
    QStackedWidget *m_viewStack = nullptr;
    QButtonGroup *m_navButtonGroup = nullptr;

    // View Pages
    CatalogModel *m_catalogModel = nullptr;
    QTableView *m_catalogTable = nullptr;
    QLineEdit *m_searchInput = nullptr;
    QTimer *m_searchDebounceTimer = nullptr;
    QButtonGroup *m_categoryChipsGroup = nullptr;
    QLabel *m_holdingsCounterLabel = nullptr;
    QLabel *m_workstationLabel = nullptr;

    CirculationPage *m_circulationPage = nullptr;
    BorrowersPage *m_borrowersPage = nullptr;
    ReportsPage *m_reportsPage = nullptr;
    SettingsPage *m_settingsPage = nullptr;

    // Catalog Row Action Buttons
    QPushButton *m_btnEdit = nullptr;
    QPushButton *m_btnPrintLabel = nullptr;
    QPushButton *m_btnIssue = nullptr;
    QPushButton *m_btnWithdraw = nullptr;

    // Barcode scanner global filter
    BarcodeScannerFilter *m_scannerFilter = nullptr;
};
