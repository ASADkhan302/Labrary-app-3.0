#include "MainWindow.h"
#include "BookFormDialog.h"
#include "CsvWizardDialog.h"
#include "LabelPrintDialog.h"
#include "DatabaseManager.h"
#include "AudioFeedback.h"

#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QHeaderView>
#include <QMessageBox>
#include <QApplication>
#include <QScrollArea>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
{
    setWindowTitle("University of Lakki Marwat | Central Campus LMS");
    resize(1400, 850);
    setMinimumSize(1100, 700);

    // Global Hardware Scanner Filter
    m_scannerFilter = new BarcodeScannerFilter(this);
    qApp->installEventFilter(m_scannerFilter);
    connect(m_scannerFilter, &BarcodeScannerFilter::barcodeScanned, this, &MainWindow::onBarcodeScanned);

    setupUi();
}

void MainWindow::setupUi() {
    auto *centralWidget = new QWidget(this);
    auto *rootLayout = new QVBoxLayout(centralWidget);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    // 1. Top Header Strip
    setupHeaderStrip();
    rootLayout->addWidget(centralWidget->findChild<QWidget*>("headerStrip"));

    // 2. Body: Left Nav Rail + Main Stacked Widget
    auto *bodyLayout = new QHBoxLayout();
    bodyLayout->setContentsMargins(0, 0, 0, 0);
    bodyLayout->setSpacing(0);

    // Left Navigation Rail
    setupNavigationRail();
    bodyLayout->addWidget(centralWidget->findChild<QWidget*>("navRail"));

    // Central Stacked View
    m_viewStack = new QStackedWidget(this);

    // Tab 0: Catalog
    m_viewStack->addWidget(createCatalogView());

    // Tab 1: Circulation Desk
    m_circulationPage = new CirculationPage(this);
    m_viewStack->addWidget(m_circulationPage);

    // Tab 2: Borrowers Directory
    m_borrowersPage = new BorrowersPage(this);
    m_viewStack->addWidget(m_borrowersPage);

    // Tab 3: Reports & Analytics
    m_reportsPage = new ReportsPage(this);
    m_viewStack->addWidget(m_reportsPage);

    // Tab 4: Settings & Maintenance
    m_settingsPage = new SettingsPage(this);
    connect(m_settingsPage, &SettingsPage::dataChanged, this, &MainWindow::refreshAllViews);
    m_viewStack->addWidget(m_settingsPage);

    bodyLayout->addWidget(m_viewStack, 1);
    rootLayout->addLayout(bodyLayout, 1);

    setCentralWidget(centralWidget);
    updateHoldingCount();
}

void MainWindow::setupHeaderStrip() {
    auto *header = new QWidget(this);
    header->setObjectName("headerStrip");
    header->setFixedHeight(50);
    header->setStyleSheet("background-color: #0B1220; border-bottom: 1px solid #1E293B;");

    auto *layout = new QHBoxLayout(header);
    layout->setContentsMargins(20, 0, 20, 0);

    // Left: Institution Brand
    auto *brandLabel = new QLabel("UNIVERSITY OF LAKKI MARWAT", header);
    brandLabel->setFont(QFont("Cinzel", 13, QFont::Bold));
    brandLabel->setStyleSheet("color: #F1F5F9;");
    layout->addWidget(brandLabel);

    auto *divider = new QLabel("|", header);
    divider->setStyleSheet("color: #64748B; font-size: 14px; margin: 0 4px;");
    layout->addWidget(divider);

    auto *subLabel = new QLabel("Central Campus LMS", header);
    subLabel->setStyleSheet("color: #60A5FA; font-weight: 600; font-size: 12px;");
    layout->addWidget(subLabel);

    layout->addStretch(1);

    // Right: Workstation ID Pill
    QString wsId = DatabaseManager::instance().getSetting("workstation_id", "WS-ULM-01");
    m_workstationLabel = new QLabel(QString("WORKSTATION: %1").arg(wsId), header);
    m_workstationLabel->setStyleSheet(
        "background-color: #0F172A; color: #10B981; border: 1px solid #1E293B; "
        "border-radius: 4px; padding: 4px 10px; font-family: 'JetBrains Mono'; font-size: 11px; font-weight: bold;"
    );
    layout->addWidget(m_workstationLabel);
}

void MainWindow::setupNavigationRail() {
    auto *rail = new QWidget(this);
    rail->setObjectName("navRail");
    rail->setFixedWidth(200);
    rail->setStyleSheet("background-color: #0B1220; border-right: 1px solid #1E293B;");

    auto *layout = new QVBoxLayout(rail);
    layout->setContentsMargins(10, 16, 10, 16);
    layout->setSpacing(6);

    m_navButtonGroup = new QButtonGroup(this);
    m_navButtonGroup->setExclusive(true);

    struct NavItem { int id; const char* text; };
    NavItem items[] = {
        {0, "  Catalog"},
        {1, "  Circulation"},
        {2, "  Borrowers"},
        {3, "  Reports"},
        {4, "  Settings"}
    };

    for (const auto &item : items) {
        auto *btn = new QPushButton(item.text, rail);
        btn->setCheckable(true);
        btn->setFixedHeight(42);
        btn->setStyleSheet(
            "QPushButton { text-align: left; padding-left: 16px; border: 1px solid transparent; border-radius: 6px; color: #A8B5C8; font-weight: 600; font-size: 13px; }"
            "QPushButton:hover { background-color: #0F172A; color: #F1F5F9; }"
            "QPushButton:checked { background-color: #0F172A; color: #F59E0B; border: 1px solid #F59E0B; font-weight: bold; }"
        );
        m_navButtonGroup->addButton(btn, item.id);
        layout->addWidget(btn);
    }

    m_navButtonGroup->button(0)->setChecked(true);
    connect(m_navButtonGroup, &QButtonGroup::idClicked, this, &MainWindow::onNavButtonClicked);

    layout->addStretch(1);

    // Quick Action in Rail: Add Book
    auto *btnAdd = new QPushButton("+ Add Book", rail);
    btnAdd->setObjectName("btnPrimary");
    btnAdd->setFixedHeight(40);
    connect(btnAdd, &QPushButton::clicked, this, &MainWindow::onAddBookClicked);
    layout->addWidget(btnAdd);
}

void MainWindow::onNavButtonClicked(int id) {
    m_viewStack->setCurrentIndex(id);
    AudioFeedback::instance().playClick();

    if (id == 0) {
        if (m_catalogModel) m_catalogModel->reload();
        updateHoldingCount();
    } else if (id == 1 && m_circulationPage) {
        m_circulationPage->refreshLoans();
    } else if (id == 2 && m_borrowersPage) {
        m_borrowersPage->refreshData();
    } else if (id == 3 && m_reportsPage) {
        m_reportsPage->refreshReports();
    }
}

QWidget* MainWindow::createCatalogView() {
    auto *widget = new QWidget(this);
    auto *layout = new QVBoxLayout(widget);
    layout->setContentsMargins(24, 20, 24, 20);
    layout->setSpacing(14);

    // Search and Action Bar
    auto *topRow = new QHBoxLayout();
    topRow->setSpacing(10);

    m_searchInput = new QLineEdit(widget);
    m_searchInput->setPlaceholderText("Search across Title, Author, ISBN, Barcode, Accession No, Call No, Shelf...");
    m_searchInput->setFixedHeight(40);
    connect(m_searchInput, &QLineEdit::textChanged, this, &MainWindow::onSearchTextChanged);
    topRow->addWidget(m_searchInput, 1);

    // Debounce timer (250 ms)
    m_searchDebounceTimer = new QTimer(this);
    m_searchDebounceTimer->setSingleShot(true);
    m_searchDebounceTimer->setInterval(250);
    connect(m_searchDebounceTimer, &QTimer::timeout, this, &MainWindow::onSearchDebounceTimeout);

    // Import CSV Button
    auto *btnImportCsv = new QPushButton("Import CSV", widget);
    btnImportCsv->setObjectName("btnSecondary");
    btnImportCsv->setFixedHeight(40);
    connect(btnImportCsv, &QPushButton::clicked, this, &MainWindow::onImportCsvClicked);
    topRow->addWidget(btnImportCsv);

    // Add Book Button
    auto *btnAddBook = new QPushButton("+ Add Book", widget);
    btnAddBook->setObjectName("btnPrimary");
    btnAddBook->setFixedHeight(40);
    connect(btnAddBook, &QPushButton::clicked, this, &MainWindow::onAddBookClicked);
    topRow->addWidget(btnAddBook);

    layout->addLayout(topRow);

    // Category Filter Chips
    auto *chipScroll = new QScrollArea(widget);
    chipScroll->setFixedHeight(40);
    chipScroll->setWidgetResizable(true);
    chipScroll->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    chipScroll->setVerticalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    chipScroll->setStyleSheet("background: transparent; border: none;");

    auto *chipsWidget = new QWidget(chipScroll);
    auto *chipsLayout = new QHBoxLayout(chipsWidget);
    chipsLayout->setContentsMargins(0, 0, 0, 0);
    chipsLayout->setSpacing(8);

    m_categoryChipsGroup = new QButtonGroup(this);
    m_categoryChipsGroup->setExclusive(true);

    QStringList categories = {"All", "Computer Science", "Physics", "Mathematics", "Chemistry", "Law", "Islamic Studies", "English", "History"};
    for (int i = 0; i < categories.size(); ++i) {
        auto *chip = new QPushButton(categories[i], chipsWidget);
        chip->setCheckable(true);
        chip->setFixedHeight(32);
        chip->setStyleSheet(
            "QPushButton { background-color: #0F172A; border: 1px solid #1E293B; border-radius: 16px; padding: 0 14px; color: #A8B5C8; font-size: 11px; font-weight: 600; }"
            "QPushButton:hover { border-color: #64748B; color: #F1F5F9; }"
            "QPushButton:checked { background-color: #2563EB; border-color: #2563EB; color: #FFFFFF; font-weight: bold; }"
        );
        m_categoryChipsGroup->addButton(chip, i);
        chipsLayout->addWidget(chip);
    }
    m_categoryChipsGroup->button(0)->setChecked(true);
    connect(m_categoryChipsGroup, &QButtonGroup::idClicked, this, &MainWindow::onCategoryChipClicked);

    chipsLayout->addStretch(1);
    chipScroll->setWidget(chipsWidget);
    layout->addWidget(chipScroll);

    // Catalog Table View
    m_catalogModel = new CatalogModel(this);
    m_catalogTable = new QTableView(widget);
    m_catalogTable->setModel(m_catalogModel);
    m_catalogTable->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_catalogTable->setSelectionMode(QAbstractItemView::SingleSelection);
    m_catalogTable->setAlternatingRowColors(true);
    m_catalogTable->verticalHeader()->setVisible(false);
    m_catalogTable->setSortingEnabled(true);
    m_catalogTable->horizontalHeader()->setStretchLastSection(true);
    m_catalogTable->horizontalHeader()->setSectionResizeMode(CatalogModel::ColTitle, QHeaderView::Stretch);
    m_catalogTable->horizontalHeader()->setSectionResizeMode(CatalogModel::ColAuthor, QHeaderView::Interactive);
    m_catalogTable->resizeColumnsToContents();

    connect(m_catalogTable->selectionModel(), &QItemSelectionModel::selectionChanged, [this]() {
        bool hasSelection = m_catalogTable->selectionModel()->hasSelection();
        m_btnEdit->setEnabled(hasSelection);
        m_btnPrintLabel->setEnabled(hasSelection);
        m_btnIssue->setEnabled(hasSelection);
        m_btnWithdraw->setEnabled(hasSelection);
    });
    connect(m_catalogTable, &QTableView::doubleClicked, this, &MainWindow::onTableDoubleClicked);

    layout->addWidget(m_catalogTable, 1);

    // Bottom Action Row
    auto *bottomRow = new QHBoxLayout();
    m_holdingsCounterLabel = new QLabel(widget);
    m_holdingsCounterLabel->setStyleSheet("color: #A8B5C8; font-size: 12px;");
    bottomRow->addWidget(m_holdingsCounterLabel, 1);

    m_btnEdit = new QPushButton("Edit Details", widget);
    m_btnEdit->setObjectName("btnSecondary");
    m_btnEdit->setEnabled(false);
    connect(m_btnEdit, &QPushButton::clicked, this, &MainWindow::onEditSelectedBook);
    bottomRow->addWidget(m_btnEdit);

    m_btnPrintLabel = new QPushButton("Print Label (Code-128)", widget);
    m_btnPrintLabel->setObjectName("btnSecondary");
    m_btnPrintLabel->setEnabled(false);
    connect(m_btnPrintLabel, &QPushButton::clicked, this, &MainWindow::onPrintLabelSelected);
    bottomRow->addWidget(m_btnPrintLabel);

    m_btnIssue = new QPushButton("Issue to Borrower", widget);
    m_btnIssue->setObjectName("btnPrimary");
    m_btnIssue->setEnabled(false);
    connect(m_btnIssue, &QPushButton::clicked, this, &MainWindow::onIssueSelectedFromCatalog);
    bottomRow->addWidget(m_btnIssue);

    m_btnWithdraw = new QPushButton("Withdraw", widget);
    m_btnWithdraw->setObjectName("btnDanger");
    m_btnWithdraw->setEnabled(false);
    connect(m_btnWithdraw, &QPushButton::clicked, this, &MainWindow::onWithdrawSelectedBook);
    bottomRow->addWidget(m_btnWithdraw);

    layout->addLayout(bottomRow);

    return widget;
}

void MainWindow::onSearchTextChanged(const QString &) {
    m_searchDebounceTimer->start();
}

void MainWindow::onSearchDebounceTimeout() {
    if (m_catalogModel) {
        m_catalogModel->setSearchFilter(m_searchInput->text().trimmed());
        updateHoldingCount();
    }
}

void MainWindow::onCategoryChipClicked(int id) {
    auto *btn = m_categoryChipsGroup->button(id);
    if (!btn || !m_catalogModel) return;

    QString cat = btn->text();
    m_catalogModel->setCategoryFilter(cat == "All" ? "" : cat);
    updateHoldingCount();
}

void MainWindow::onAddBookClicked() {
    BookFormDialog dlg(this);
    if (dlg.exec() == QDialog::Accepted) {
        AudioFeedback::instance().playSuccessBeep();
        m_catalogModel->reload();
        updateHoldingCount();
    }
}

void MainWindow::onEditSelectedBook() {
    auto indexes = m_catalogTable->selectionModel()->selectedRows();
    if (indexes.isEmpty()) return;

    int bookId = m_catalogModel->getBookIdAt(indexes.first().row());
    if (bookId <= 0) return;

    BookFormDialog dlg(this, bookId);
    if (dlg.exec() == QDialog::Accepted) {
        AudioFeedback::instance().playSuccessBeep();
        m_catalogModel->reload();
        updateHoldingCount();
    }
}

void MainWindow::onPrintLabelSelected() {
    auto indexes = m_catalogTable->selectionModel()->selectedRows();
    if (indexes.isEmpty()) return;

    int bookId = m_catalogModel->getBookIdAt(indexes.first().row());
    auto bookOpt = DatabaseManager::instance().getBookById(bookId);
    if (!bookOpt) return;

    LabelPrintDialog dlg(this, bookOpt->accession_no);
    dlg.exec();
}

void MainWindow::onIssueSelectedFromCatalog() {
    auto indexes = m_catalogTable->selectionModel()->selectedRows();
    if (indexes.isEmpty()) return;

    int bookId = m_catalogModel->getBookIdAt(indexes.first().row());
    auto bookOpt = DatabaseManager::instance().getBookById(bookId);
    if (!bookOpt) return;

    // Switch to Circulation Desk tab and populate barcode
    m_navButtonGroup->button(1)->setChecked(true);
    onNavButtonClicked(1);
    if (m_circulationPage) {
        m_circulationPage->setScannedCode(bookOpt->barcode);
    }
}

void MainWindow::onWithdrawSelectedBook() {
    auto indexes = m_catalogTable->selectionModel()->selectedRows();
    if (indexes.isEmpty()) return;

    int row = indexes.first().row();
    int bookId = m_catalogModel->getBookIdAt(row);
    if (bookId <= 0) return;

    if (DatabaseManager::instance().hasLoanHistory(bookId)) {
        AudioFeedback::instance().playErrorBuzz();
        QMessageBox::warning(this, "Cannot Delete",
            "This book copy has an active or past loan history.\n"
            "Under library regulations, copies with loan records must be marked as 'Withdrawn' rather than deleted."
        );
        return;
    }

    auto confirm = QMessageBox::question(
        this,
        "Confirm Withdrawal",
        "Are you sure you want to withdraw this copy from circulation?",
        QMessageBox::Yes | QMessageBox::No,
        QMessageBox::No
    );

    if (confirm == QMessageBox::Yes) {
        if (DatabaseManager::instance().withdrawBook(bookId)) {
            m_catalogModel->reload();
            updateHoldingCount();
        }
    }
}

void MainWindow::onImportCsvClicked() {
    CsvWizardDialog dlg(this);
    if (dlg.exec() == QDialog::Accepted) {
        AudioFeedback::instance().playSuccessBeep();
        m_catalogModel->reload();
        updateHoldingCount();
    }
}

void MainWindow::onTableDoubleClicked(const QModelIndex &index) {
    Q_UNUSED(index);
    onEditSelectedBook();
}

void MainWindow::onBarcodeScanned(const QString &barcode) {
    // If currently on Circulation tab, dispatch to circulation
    if (m_viewStack->currentIndex() == 1 && m_circulationPage) {
        m_circulationPage->setScannedCode(barcode);
    } else {
        // Search in catalog
        m_navButtonGroup->button(0)->setChecked(true);
        onNavButtonClicked(0);
        m_searchInput->setText(barcode);
        m_catalogModel->setSearchFilter(barcode);
        updateHoldingCount();
    }
}

void MainWindow::updateHoldingCount() {
    int count = m_catalogModel ? m_catalogModel->getTotalCount() : 0;
    m_holdingsCounterLabel->setText(QString("Displaying %1 accessions in catalog").arg(count));
}

void MainWindow::refreshAllViews() {
    if (m_catalogModel) m_catalogModel->reload();
    if (m_circulationPage) m_circulationPage->refreshLoans();
    if (m_borrowersPage) m_borrowersPage->refreshData();
    if (m_reportsPage) m_reportsPage->refreshReports();

    QString wsId = DatabaseManager::instance().getSetting("workstation_id", "WS-ULM-01");
    if (m_workstationLabel) m_workstationLabel->setText(QString("WORKSTATION: %1").arg(wsId));
    updateHoldingCount();
}
