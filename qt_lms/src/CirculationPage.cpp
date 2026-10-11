#include "CirculationPage.h"
#include "AudioFeedback.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGroupBox>
#include <QHeaderView>
#include <QMessageBox>
#include <QInputDialog>
#include <QDate>

CirculationPage::CirculationPage(QWidget *parent)
    : QWidget(parent)
{
    setupUi();
    refreshLoans();
}

void CirculationPage::setupUi() {
    auto *mainLayout = new QHBoxLayout(this);
    mainLayout->setContentsMargins(24, 24, 24, 24);
    mainLayout->setSpacing(20);

    // =========================================================
    // Left Column: Issue Desk & Barcode Terminal (Width ~ 380px)
    // =========================================================
    auto *leftCol = new QVBoxLayout();
    leftCol->setSpacing(16);

    auto *issueGroup = new QGroupBox("Circulation Issue Desk", this);
    auto *issueLayout = new QVBoxLayout(issueGroup);
    issueLayout->setSpacing(12);

    // 1. Book Barcode Scan Input
    auto *bookLbl = new QLabel("<b>Step 1: Book Barcode / Accession No:</b>", this);
    issueLayout->addWidget(bookLbl);

    auto *bookInputRow = new QHBoxLayout();
    m_bookBarcodeEdit = new QLineEdit(this);
    m_bookBarcodeEdit->setPlaceholderText("Scan barcode (e.g. ULM-10001) or press Enter...");
    m_bookBarcodeEdit->setFont(QFont("JetBrains Mono", 11));
    m_bookBarcodeEdit->setMinimumHeight(38);
    connect(m_bookBarcodeEdit, &QLineEdit::returnPressed, this, &CirculationPage::onBookLookup);
    bookInputRow->addWidget(m_bookBarcodeEdit, 1);

    auto *btnLookupBook = new QPushButton("Verify", this);
    btnLookupBook->setObjectName("btnSecondary");
    connect(btnLookupBook, &QPushButton::clicked, this, &CirculationPage::onBookLookup);
    bookInputRow->addWidget(btnLookupBook);
    issueLayout->addLayout(bookInputRow);

    m_bookInfoLabel = new QLabel("No book verified yet.", this);
    m_bookInfoLabel->setStyleSheet("color: #A8B5C8; background-color: #0F172A; padding: 8px; border-radius: 6px; border: 1px solid #1E293B;");
    m_bookInfoLabel->setWordWrap(true);
    issueLayout->addWidget(m_bookInfoLabel);

    // 2. Borrower ID Input
    auto *borLbl = new QLabel("<b>Step 2: Borrower Card / University ID:</b>", this);
    issueLayout->addWidget(borLbl);

    auto *borInputRow = new QHBoxLayout();
    m_borrowerIdEdit = new QLineEdit(this);
    m_borrowerIdEdit->setPlaceholderText("Scan ID card or enter ULM-FA23-BCS-042...");
    m_borrowerIdEdit->setFont(QFont("JetBrains Mono", 11));
    m_borrowerIdEdit->setMinimumHeight(38);
    connect(m_borrowerIdEdit, &QLineEdit::returnPressed, this, &CirculationPage::onBorrowerLookup);
    borInputRow->addWidget(m_borrowerIdEdit, 1);

    auto *btnLookupBor = new QPushButton("Verify", this);
    btnLookupBor->setObjectName("btnSecondary");
    connect(btnLookupBor, &QPushButton::clicked, this, &CirculationPage::onBorrowerLookup);
    borInputRow->addWidget(btnLookupBor);
    issueLayout->addLayout(borInputRow);

    m_borrowerInfoLabel = new QLabel("No borrower verified yet.", this);
    m_borrowerInfoLabel->setStyleSheet("color: #A8B5C8; background-color: #0F172A; padding: 8px; border-radius: 6px; border: 1px solid #1E293B;");
    m_borrowerInfoLabel->setWordWrap(true);
    issueLayout->addWidget(m_borrowerInfoLabel);

    // 3. Due Date Presets
    auto *presetLbl = new QLabel("<b>Step 3: Loan Period Preset:</b>", this);
    issueLayout->addWidget(presetLbl);

    auto *presetRow = new QHBoxLayout();
    m_presetGroup = new QButtonGroup(this);
    m_radio7 = new QRadioButton("7 Days", this);
    m_radio14 = new QRadioButton("14 Days (Default)", this);
    m_radio30 = new QRadioButton("30 Days", this);
    m_radio14->setChecked(true);

    m_presetGroup->addButton(m_radio7, 7);
    m_presetGroup->addButton(m_radio14, 14);
    m_presetGroup->addButton(m_radio30, 30);

    presetRow->addWidget(m_radio7);
    presetRow->addWidget(m_radio14);
    presetRow->addWidget(m_radio30);
    issueLayout->addLayout(presetRow);

    // One-Click Issue Button
    m_btnIssue = new QPushButton("✓ Issue Book Copy", this);
    m_btnIssue->setObjectName("btnPrimary");
    m_btnIssue->setMinimumHeight(44);
    m_btnIssue->setEnabled(false);
    connect(m_btnIssue, &QPushButton::clicked, this, &CirculationPage::onIssueClicked);
    issueLayout->addWidget(m_btnIssue);

    leftCol->addWidget(issueGroup);

    // Hardware Scanner Live Test Box
    auto *scannerTestGroup = new QGroupBox("Hardware Scanner Live Test Buffer", this);
    auto *scannerTestLayout = new QVBoxLayout(scannerTestGroup);
    m_testScanInput = new QLineEdit(this);
    m_testScanInput->setPlaceholderText("Scan any barcode here to test scanner hardware...");
    m_testScanInput->setFont(QFont("JetBrains Mono", 10));
    scannerTestLayout->addWidget(m_testScanInput);

    auto *testDesc = new QLabel("Keystroke events arriving < 50ms apart are captured and decoded in real-time.", this);
    testDesc->setStyleSheet("color: #94A3B8; font-size: 10px;");
    scannerTestLayout->addWidget(testDesc);
    leftCol->addWidget(scannerTestGroup);

    leftCol->addStretch(1);
    mainLayout->addLayout(leftCol, 1);

    // =========================================================
    // Right Column: Active Loans & Returns Desk
    // =========================================================
    auto *rightCol = new QVBoxLayout();
    rightCol->setSpacing(14);

    auto *rightHeader = new QHBoxLayout();
    auto *loansTitle = new QLabel("<h3>Active Issued Loans & Overdue Fines</h3>", this);
    loansTitle->setStyleSheet("color: #F1F5F9;");
    rightHeader->addWidget(loansTitle, 1);

    auto *btnRefresh = new QPushButton("Refresh Loans", this);
    btnRefresh->setObjectName("btnSecondary");
    connect(btnRefresh, &QPushButton::clicked, this, &CirculationPage::refreshLoans);
    rightHeader->addWidget(btnRefresh);

    rightCol->addLayout(rightHeader);

    // Table of active loans
    m_loansTable = new QTableWidget(this);
    m_loansTable->setColumnCount(7);
    m_loansTable->setHorizontalHeaderLabels({
        "Barcode / Copy", "Title & Author", "Borrower", "Role",
        "Due Date", "Days Overdue", "Fine Accrued"
    });
    m_loansTable->horizontalHeader()->setStretchLastSection(true);
    m_loansTable->horizontalHeader()->setSectionResizeMode(0, QHeaderView::ResizeToContents);
    m_loansTable->horizontalHeader()->setSectionResizeMode(1, QHeaderView::Stretch);
    m_loansTable->horizontalHeader()->setSectionResizeMode(2, QHeaderView::ResizeToContents);
    m_loansTable->horizontalHeader()->setSectionResizeMode(3, QHeaderView::ResizeToContents);
    m_loansTable->horizontalHeader()->setSectionResizeMode(4, QHeaderView::ResizeToContents);
    m_loansTable->horizontalHeader()->setSectionResizeMode(5, QHeaderView::ResizeToContents);
    m_loansTable->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_loansTable->setSelectionMode(QAbstractItemView::SingleSelection);
    m_loansTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_loansTable->verticalHeader()->setVisible(false);
    connect(m_loansTable, &QTableWidget::itemSelectionChanged, this, &CirculationPage::onActiveLoanSelectionChanged);
    rightCol->addWidget(m_loansTable, 1);

    // Bottom Action Row
    auto *rightBottom = new QHBoxLayout();
    m_activeSummaryLabel = new QLabel(this);
    m_activeSummaryLabel->setStyleSheet("color: #A8B5C8;");
    rightBottom->addWidget(m_activeSummaryLabel, 1);

    m_btnReturn = new QPushButton("✓ Process Book Return", this);
    m_btnReturn->setObjectName("btnPrimary");
    m_btnReturn->setEnabled(false);
    m_btnReturn->setMinimumHeight(40);
    m_btnReturn->setMinimumWidth(200);
    connect(m_btnReturn, &QPushButton::clicked, this, &CirculationPage::onReturnClicked);
    rightBottom->addWidget(m_btnReturn);

    rightCol->addLayout(rightBottom);
    mainLayout->addLayout(rightCol, 2);
}

void CirculationPage::setScannedCode(const QString &barcode) {
    if (m_testScanInput && m_testScanInput->hasFocus()) {
        m_testScanInput->setText(barcode);
        return;
    }

    if (barcode.startsWith("ULM-") && barcode.contains(QRegularExpression(R"(\d{5}$)"))) {
        // Book barcode pattern
        m_bookBarcodeEdit->setText(barcode);
        onBookLookup();
    } else {
        // Assume borrower card
        m_borrowerIdEdit->setText(barcode);
        onBorrowerLookup();
    }
}

void CirculationPage::onBookLookup() {
    QString query = m_bookBarcodeEdit->text().trimmed();
    if (query.isEmpty()) return;

    auto &db = DatabaseManager::instance();
    std::optional<Book> bookOpt;

    if (query.startsWith("ULM-", Qt::CaseInsensitive)) {
        bookOpt = db.getBookByBarcode(query);
    } else {
        bool ok = false;
        int accNo = query.toInt(&ok);
        if (ok) {
            bookOpt = db.getBookByAccessionNo(accNo);
        }
    }

    if (!bookOpt) {
        AudioFeedback::instance().playErrorBuzz();
        m_selectedBookId = 0;
        m_bookInfoLabel->setText("<span style='color: #FB7185;'>Error: Book copy not found in accession register.</span>");
        m_btnIssue->setEnabled(false);
        return;
    }

    if (bookOpt->status != "available") {
        AudioFeedback::instance().playErrorBuzz();
        m_selectedBookId = 0;
        m_bookInfoLabel->setText(QString("<span style='color: #FB7185;'>Unavailable: Book is currently marked as '%1'</span>")
                                 .arg(bookOpt->status.toUpper()));
        m_btnIssue->setEnabled(false);
        return;
    }

    m_selectedBookId = bookOpt->id;
    m_bookInfoLabel->setText(QString("<b>%1</b><br>Author: %2<br>Barcode: %3 · Accession: #%4")
                             .arg(bookOpt->title)
                             .arg(bookOpt->author.isEmpty() ? "N/A" : bookOpt->author)
                             .arg(bookOpt->barcode)
                             .arg(bookOpt->accession_no));

    AudioFeedback::instance().playClick();

    if (m_selectedBorrowerId > 0) {
        m_btnIssue->setEnabled(true);
    } else {
        m_borrowerIdEdit->setFocus();
    }
}

void CirculationPage::onBorrowerLookup() {
    QString query = m_borrowerIdEdit->text().trimmed();
    if (query.isEmpty()) return;

    auto &db = DatabaseManager::instance();
    auto borOpt = db.getBorrowerByUniversityId(query);

    if (!borOpt) {
        AudioFeedback::instance().playErrorBuzz();
        m_selectedBorrowerId = 0;
        m_borrowerInfoLabel->setText("<span style='color: #FB7185;'>Error: Borrower not registered in campus directory.</span>");
        m_btnIssue->setEnabled(false);
        return;
    }

    int activeLoans = db.getBorrowerActiveLoansCount(borOpt->id);
    if (activeLoans >= borOpt->borrow_limit) {
        AudioFeedback::instance().playErrorBuzz();
        m_selectedBorrowerId = 0;
        m_borrowerInfoLabel->setText(QString("<span style='color: #FB7185;'>Limit Reached: %1 has %2 / %3 active books.</span>")
                                     .arg(borOpt->name).arg(activeLoans).arg(borOpt->borrow_limit));
        m_btnIssue->setEnabled(false);
        return;
    }

    m_selectedBorrowerId = borOpt->id;
    m_borrowerInfoLabel->setText(QString("<b>%1</b> (%2)<br>Role: %3 · Dept: %4<br>Active Loans: %5 / %6 Limit")
                                 .arg(borOpt->name)
                                 .arg(borOpt->university_id)
                                 .arg(borOpt->role)
                                 .arg(borOpt->department)
                                 .arg(activeLoans)
                                 .arg(borOpt->borrow_limit));

    AudioFeedback::instance().playClick();

    if (m_selectedBookId > 0) {
        m_btnIssue->setEnabled(true);
        m_btnIssue->setFocus();
    }
}

void CirculationPage::onIssueClicked() {
    if (m_selectedBookId <= 0 || m_selectedBorrowerId <= 0) return;

    int days = m_presetGroup->checkedId();
    if (days <= 0) days = 14;

    if (DatabaseManager::instance().issueBook(m_selectedBookId, m_selectedBorrowerId, days)) {
        AudioFeedback::instance().playSuccessBeep();
        clearIssueForm();
        refreshLoans();
    } else {
        AudioFeedback::instance().playErrorBuzz();
        QMessageBox::critical(this, "Issue Transaction Failed",
                             "The database transaction failed. Verify the book is available and borrower has remaining capacity.");
    }
}

void CirculationPage::clearIssueForm() {
    m_selectedBookId = 0;
    m_selectedBorrowerId = 0;
    m_bookBarcodeEdit->clear();
    m_borrowerIdEdit->clear();
    m_bookInfoLabel->setText("No book verified yet.");
    m_borrowerInfoLabel->setText("No borrower verified yet.");
    m_btnIssue->setEnabled(false);
    m_bookBarcodeEdit->setFocus();
}

void CirculationPage::refreshLoans() {
    m_currentLoans = DatabaseManager::instance().getActiveLoans();
    m_loansTable->setRowCount(m_currentLoans.size());

    int overdueCount = 0;
    int totalFinePaisa = 0;

    for (int i = 0; i < m_currentLoans.size(); ++i) {
        const auto &loan = m_currentLoans[i];

        auto *itemBarcode = new QTableWidgetItem(loan.barcode);
        itemBarcode->setFont(QFont("JetBrains Mono", 10));
        m_loansTable->setItem(i, 0, itemBarcode);

        m_loansTable->setItem(i, 1, new QTableWidgetItem(QString("%1 — %2").arg(loan.title).arg(loan.author)));
        m_loansTable->setItem(i, 2, new QTableWidgetItem(QString("%1 (%2)").arg(loan.borrower_name).arg(loan.university_id)));
        m_loansTable->setItem(i, 3, new QTableWidgetItem(loan.role));

        auto *itemDue = new QTableWidgetItem(loan.due_date);
        itemDue->setFont(QFont("JetBrains Mono", 10));
        m_loansTable->setItem(i, 4, itemDue);

        auto *itemOverdue = new QTableWidgetItem(loan.days_overdue > 0 ? QString("%1 Days").arg(loan.days_overdue) : "On Time");
        if (loan.days_overdue > 0) {
            itemOverdue->setForeground(QBrush(QColor("#FB7185")));
            overdueCount++;
            totalFinePaisa += loan.fine_paisa;
        } else {
            itemOverdue->setForeground(QBrush(QColor("#10B981")));
        }
        m_loansTable->setItem(i, 5, itemOverdue);

        auto *itemFine = new QTableWidgetItem(loan.fine_paisa > 0 ? Book::formatPaisa(loan.fine_paisa) : "-");
        if (loan.fine_paisa > 0) {
            itemFine->setForeground(QBrush(QColor("#F59E0B")));
        }
        m_loansTable->setItem(i, 6, itemFine);
    }

    m_activeSummaryLabel->setText(QString("Active Loans: %1  |  Overdue: %2  |  Accrued Fines: %3")
                                  .arg(m_currentLoans.size())
                                  .arg(overdueCount)
                                  .arg(Book::formatPaisa(totalFinePaisa)));
    onActiveLoanSelectionChanged();
}

void CirculationPage::onActiveLoanSelectionChanged() {
    bool hasSelection = m_loansTable->currentRow() >= 0 && m_loansTable->currentRow() < m_currentLoans.size();
    m_btnReturn->setEnabled(hasSelection);
}

void CirculationPage::onReturnClicked() {
    int row = m_loansTable->currentRow();
    if (row < 0 || row >= m_currentLoans.size()) return;

    ActiveLoanInfo loan = m_currentLoans[row];
    int finePaidPaisa = 0;

    if (loan.days_overdue > 0 && loan.fine_paisa > 0) {
        double fineRupees = loan.fine_paisa / 100.0;
        bool ok = false;
        double paidRupees = QInputDialog::getDouble(
            this,
            "Record Overdue Fine Payment",
            QString("Book is overdue by %1 days.\nCalculated fine: %2\n\nEnter amount collected in Rupees:")
                .arg(loan.days_overdue)
                .arg(Book::formatPaisa(loan.fine_paisa)),
            fineRupees,
            0.0,
            10000.0,
            2,
            &ok
        );

        if (!ok) return; // User cancelled return dialog
        finePaidPaisa = static_cast<int>(std::round(paidRupees * 100.0));
    }

    if (DatabaseManager::instance().returnBook(loan.transaction_id, finePaidPaisa)) {
        AudioFeedback::instance().playReturnChord();
        refreshLoans();
    } else {
        AudioFeedback::instance().playErrorBuzz();
        QMessageBox::critical(this, "Return Failed", "Could not complete return transaction in database.");
    }
}
