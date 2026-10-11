#include "BorrowersPage.h"
#include "BorrowerDialog.h"
#include "MemberCardPrintDialog.h"
#include "DatabaseManager.h"
#include "AudioFeedback.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QHeaderView>
#include <QMessageBox>
#include <QFileDialog>
#include <QDialog>
#include <QTabWidget>
#include <QDate>
#include <QFile>
#include <QTextStream>

BorrowersPage::BorrowersPage(QWidget *parent)
    : QWidget(parent)
{
    setupUi();
    refreshData();
}

void BorrowersPage::setupUi() {
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(24, 20, 24, 20);
    mainLayout->setSpacing(14);

    // Title & Global Statistics Bar
    auto *topRow = new QHBoxLayout();
    auto *titleLabel = new QLabel("<h2>University Borrowers Directory (Students, Faculty & Staff)</h2>", this);
    titleLabel->setStyleSheet("color: #F1F5F9;");
    topRow->addWidget(titleLabel);
    topRow->addStretch(1);

    m_btnTemplate = new QPushButton("CSV Template", this);
    m_btnTemplate->setObjectName("btnSecondary");
    m_btnTemplate->setToolTip("Download official CSV template for importing students and faculty");
    connect(m_btnTemplate, &QPushButton::clicked, this, &BorrowersPage::onDownloadTemplate);
    topRow->addWidget(m_btnTemplate);

    m_btnImportCsv = new QPushButton("Import Class CSV...", this);
    m_btnImportCsv->setObjectName("btnSecondary");
    m_btnImportCsv->setToolTip("Bulk register whole classes or department personnel from CSV");
    connect(m_btnImportCsv, &QPushButton::clicked, this, &BorrowersPage::onImportCsv);
    topRow->addWidget(m_btnImportCsv);

    m_btnAdd = new QPushButton("+ Add Person", this);
    m_btnAdd->setObjectName("btnPrimary");
    connect(m_btnAdd, &QPushButton::clicked, this, &BorrowersPage::onAddBorrower);
    topRow->addWidget(m_btnAdd);

    mainLayout->addLayout(topRow);

    // Filter Chips & Search Bar Row
    auto *filterCard = new QFrame(this);
    filterCard->setObjectName("cardFrame");
    auto *filterLayout = new QHBoxLayout(filterCard);
    filterLayout->setContentsMargins(14, 10, 14, 10);
    filterLayout->setSpacing(12);

    // Search Input
    m_searchInput = new QLineEdit(filterCard);
    m_searchInput->setPlaceholderText("Search by name, University ID, phone, email, program...");
    m_searchInput->setClearButtonEnabled(true);
    connect(m_searchInput, &QLineEdit::textChanged, this, &BorrowersPage::onSearchChanged);
    filterLayout->addWidget(m_searchInput, 2);

    // Role Filter Chip
    filterLayout->addWidget(new QLabel("Role:", filterCard));
    m_roleCombo = new QComboBox(filterCard);
    m_roleCombo->addItems({"All", "Student", "Faculty", "Staff"});
    connect(m_roleCombo, &QComboBox::currentTextChanged, this, &BorrowersPage::onFilterChanged);
    filterLayout->addWidget(m_roleCombo, 1);

    // Status Filter Chip
    filterLayout->addWidget(new QLabel("Status:", filterCard));
    m_statusCombo = new QComboBox(filterCard);
    m_statusCombo->addItems({"All", "active", "suspended", "left"});
    connect(m_statusCombo, &QComboBox::currentTextChanged, this, &BorrowersPage::onFilterChanged);
    filterLayout->addWidget(m_statusCombo, 1);

    // Department Filter Chip
    filterLayout->addWidget(new QLabel("Dept:", filterCard));
    m_deptCombo = new QComboBox(filterCard);
    m_deptCombo->addItem("All");
    m_deptCombo->addItems(DatabaseManager::instance().getDistinctBorrowerDepartments());
    connect(m_deptCombo, &QComboBox::currentTextChanged, this, &BorrowersPage::onFilterChanged);
    filterLayout->addWidget(m_deptCombo, 1);

    mainLayout->addWidget(filterCard);

    // Action Toolbar
    auto *actionToolbar = new QHBoxLayout();
    actionToolbar->setSpacing(8);

    m_btnView = new QPushButton("View Profile", this);
    m_btnView->setEnabled(false);
    connect(m_btnView, &QPushButton::clicked, this, &BorrowersPage::onViewSelected);
    actionToolbar->addWidget(m_btnView);

    m_btnEdit = new QPushButton("Edit Profile", this);
    m_btnEdit->setEnabled(false);
    connect(m_btnEdit, &QPushButton::clicked, this, &BorrowersPage::onEditSelected);
    actionToolbar->addWidget(m_btnEdit);

    m_btnIssue = new QPushButton("Issue Book", this);
    m_btnIssue->setEnabled(false);
    connect(m_btnIssue, &QPushButton::clicked, [this]() {
        int r = m_table->currentRow();
        if (r >= 0 && r < m_currentBorrowers.size()) {
            emit issueBookRequested(m_currentBorrowers[r].id);
        }
    });
    actionToolbar->addWidget(m_btnIssue);

    m_btnSuspend = new QPushButton("Suspend / Reactivate", this);
    m_btnSuspend->setEnabled(false);
    connect(m_btnSuspend, &QPushButton::clicked, this, &BorrowersPage::onSuspendReactivateSelected);
    actionToolbar->addWidget(m_btnSuspend);

    m_btnPrintCard = new QPushButton("Print Member Card (CR80)", this);
    m_btnPrintCard->setEnabled(false);
    connect(m_btnPrintCard, &QPushButton::clicked, this, &BorrowersPage::onPrintMemberCard);
    actionToolbar->addWidget(m_btnPrintCard);

    m_btnDelete = new QPushButton("Deactivate / Remove", this);
    m_btnDelete->setObjectName("btnDanger");
    m_btnDelete->setEnabled(false);
    connect(m_btnDelete, &QPushButton::clicked, this, &BorrowersPage::onDeleteSelected);
    actionToolbar->addWidget(m_btnDelete);

    actionToolbar->addStretch(1);
    m_statusCountLabel = new QLabel(this);
    m_statusCountLabel->setStyleSheet("color: #94A3B8; font-size: 12px;");
    actionToolbar->addWidget(m_statusCountLabel);

    mainLayout->addLayout(actionToolbar);

    // Table
    m_table = new QTableWidget(this);
    m_table->setColumnCount(8);
    m_table->setHorizontalHeaderLabels({
        "University ID", "Name", "Role", "Department", "Program / Title", "Mobile Phone", "Status", "Loans / Limit"
    });
    m_table->horizontalHeader()->setSectionResizeMode(QHeaderView::Interactive);
    m_table->horizontalHeader()->setSectionResizeMode(1, QHeaderView::Stretch);
    m_table->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_table->setSelectionMode(QAbstractItemView::SingleSelection);
    m_table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_table->setAlternatingRowColors(true);
    m_table->verticalHeader()->setVisible(false);

    connect(m_table, &QTableWidget::itemSelectionChanged, this, &BorrowersPage::onTableSelectionChanged);
    connect(m_table, &QTableWidget::cellDoubleClicked, [this](int row, int) {
        if (row >= 0 && row < m_currentBorrowers.size()) {
            showBorrowerDetailDialog(m_currentBorrowers[row]);
        }
    });

    mainLayout->addWidget(m_table, 1);
}

void BorrowersPage::refreshData() {
    updateTableData();
}

void BorrowersPage::onSearchChanged(const QString &) {
    updateTableData();
}

void BorrowersPage::onFilterChanged() {
    updateTableData();
}

void BorrowersPage::updateTableData() {
    QString search = m_searchInput->text().trimmed();
    QString role = m_roleCombo->currentText();
    QString status = m_statusCombo->currentText();
    QString dept = m_deptCombo->currentText();

    m_currentBorrowers = DatabaseManager::instance().getAllBorrowers(search, role, status, dept);

    m_table->setRowCount(m_currentBorrowers.size());
    for (int i = 0; i < m_currentBorrowers.size(); ++i) {
        const auto &b = m_currentBorrowers[i];
        int activeLoans = DatabaseManager::instance().getBorrowerActiveLoansCount(b.id);

        auto *itemUid = new QTableWidgetItem(b.university_id);
        itemUid->setFont(QFont("JetBrains Mono", 10, QFont::DemiBold));

        auto *itemName = new QTableWidgetItem(b.name);
        itemName->setFont(QFont("Plus Jakarta Sans", 10, QFont::Bold));

        auto *itemRole = new QTableWidgetItem(b.role);
        if (b.role == "Faculty") itemRole->setForeground(QColor("#60A5FA"));
        else if (b.role == "Staff") itemRole->setForeground(QColor("#2DD4BF"));
        else itemRole->setForeground(QColor("#F59E0B"));

        auto *itemDept = new QTableWidgetItem(b.department);
        QString subDetail = (b.role == "Student") ? b.program : b.designation;
        auto *itemDetail = new QTableWidgetItem(subDetail);

        auto *itemPhone = new QTableWidgetItem(b.phone);
        itemPhone->setFont(QFont("JetBrains Mono", 9));

        auto *itemStatus = new QTableWidgetItem(b.status.toUpper());
        if (b.status == "active") itemStatus->setForeground(QColor("#10B981"));
        else if (b.status == "suspended") itemStatus->setForeground(QColor("#F59E0B"));
        else itemStatus->setForeground(QColor("#FB7185"));

        auto *itemLoans = new QTableWidgetItem(QString("%1 / %2").arg(activeLoans).arg(b.borrow_limit));
        itemLoans->setTextAlignment(Qt::AlignCenter);

        m_table->setItem(i, 0, itemUid);
        m_table->setItem(i, 1, itemName);
        m_table->setItem(i, 2, itemRole);
        m_table->setItem(i, 3, itemDept);
        m_table->setItem(i, 4, itemDetail);
        m_table->setItem(i, 5, itemPhone);
        m_table->setItem(i, 6, itemStatus);
        m_table->setItem(i, 7, itemLoans);
    }

    m_statusCountLabel->setText(QString("Displaying %1 registered people").arg(m_currentBorrowers.size()));
    onTableSelectionChanged();
}

void BorrowersPage::onTableSelectionChanged() {
    bool hasSel = m_table->currentRow() >= 0 && m_table->currentRow() < m_currentBorrowers.size();
    m_btnView->setEnabled(hasSel);
    m_btnEdit->setEnabled(hasSel);
    m_btnIssue->setEnabled(hasSel);
    m_btnSuspend->setEnabled(hasSel);
    m_btnPrintCard->setEnabled(hasSel);
    m_btnDelete->setEnabled(hasSel);

    if (hasSel) {
        const auto &b = m_currentBorrowers[m_table->currentRow()];
        m_btnSuspend->setText(b.status == "suspended" ? "Reactivate Person" : "Suspend Person");
    }
}

void BorrowersPage::onAddBorrower() {
    BorrowerDialog dlg(this);
    connect(&dlg, &BorrowerDialog::openExistingRequested, this, &BorrowersPage::openBorrowerDetailsById);
    if (dlg.exec() == QDialog::Accepted) {
        AudioFeedback::instance().playSuccessBeep();
        refreshData();
    }
}

void BorrowersPage::openBorrowerDetailsById(int borrowerId) {
    auto opt = DatabaseManager::instance().getBorrowerById(borrowerId);
    if (opt) {
        showBorrowerDetailDialog(*opt);
    }
}

void BorrowersPage::onEditSelected() {
    int r = m_table->currentRow();
    if (r < 0 || r >= m_currentBorrowers.size()) return;

    BorrowerDialog dlg(this, &m_currentBorrowers[r]);
    if (dlg.exec() == QDialog::Accepted) {
        AudioFeedback::instance().playSuccessBeep();
        refreshData();
    }
}

void BorrowersPage::onViewSelected() {
    int r = m_table->currentRow();
    if (r < 0 || r >= m_currentBorrowers.size()) return;
    showBorrowerDetailDialog(m_currentBorrowers[r]);
}

void BorrowersPage::onSuspendReactivateSelected() {
    int r = m_table->currentRow();
    if (r < 0 || r >= m_currentBorrowers.size()) return;

    const auto &b = m_currentBorrowers[r];
    QString newStatus = (b.status == "suspended") ? "active" : "suspended";
    if (DatabaseManager::instance().setBorrowerStatus(b.id, newStatus)) {
        AudioFeedback::instance().playClick();
        refreshData();
    }
}

void BorrowersPage::onDeleteSelected() {
    int r = m_table->currentRow();
    if (r < 0 || r >= m_currentBorrowers.size()) return;

    const auto &b = m_currentBorrowers[r];
    bool hasHistory = DatabaseManager::instance().hasBorrowerLoanHistory(b.id);

    if (hasHistory) {
        auto reply = QMessageBox::question(
            this,
            "Person Has Loan History",
            QString("Member '%1' (%2) has existing circulation loan history and CANNOT be deleted.\n\n"
                    "Do you wish to set their status to 'left' and deactivate their account instead?")
            .arg(b.name).arg(b.university_id),
            QMessageBox::Yes | QMessageBox::No,
            QMessageBox::Yes
        );
        if (reply == QMessageBox::Yes) {
            DatabaseManager::instance().deleteBorrower(b.id);
            refreshData();
        }
    } else {
        auto reply = QMessageBox::question(
            this,
            "Confirm Person Deletion",
            QString("Are you sure you want to permanently delete borrower record '%1' (%2)?\n\n"
                    "This member has no loan history.").arg(b.name).arg(b.university_id),
            QMessageBox::Yes | QMessageBox::No,
            QMessageBox::No
        );
        if (reply == QMessageBox::Yes) {
            DatabaseManager::instance().deleteBorrower(b.id);
            refreshData();
        }
    }
}

void BorrowersPage::onPrintMemberCard() {
    int r = m_table->currentRow();
    if (r < 0 || r >= m_currentBorrowers.size()) return;

    MemberCardPrintDialog cardDlg(this, m_currentBorrowers[r]);
    cardDlg.exec();
}

void BorrowersPage::onDownloadTemplate() {
    QString savePath = QFileDialog::getSaveFileName(
        this,
        "Save Borrowers CSV Import Template",
        "ULM_Borrowers_Register_Template.csv",
        "CSV Files (*.csv)"
    );
    if (savePath.isEmpty()) return;

    QFile file(savePath);
    if (file.open(QIODevice::WriteOnly | QIODevice::Text)) {
        QTextStream out(&file);
        out << DatabaseManager::instance().getBorrowersCsvTemplate();
        file.close();
        QMessageBox::information(this, "Template Saved", "Official ULM borrowers CSV template saved successfully.");
    }
}

void BorrowersPage::onImportCsv() {
    QString file = QFileDialog::getOpenFileName(
        this,
        "Import Students / Faculty from CSV",
        "",
        "CSV Files (*.csv);;All Files (*.*)"
    );
    if (file.isEmpty()) return;

    QMap<int, QString> map;
    map[0] = "university_id";
    map[1] = "name";
    map[2] = "role";
    map[3] = "department";
    map[4] = "father_name";
    map[5] = "program";
    map[6] = "session";
    map[7] = "semester";
    map[8] = "designation";
    map[9] = "phone";
    map[10] = "email";
    map[11] = "address";
    map[12] = "borrow_limit";
    map[13] = "valid_until";
    map[14] = "status";
    map[15] = "notes";

    QStringList errors;
    int imported = 0, skipped = 0;

    bool ok = DatabaseManager::instance().importBorrowersFromCsv(file, map, errors, imported, skipped);
    if (ok) {
        QMessageBox::information(
            this,
            "Import Finished",
            QString("Successfully imported %1 people into university directory.\n%2 rows skipped.\n%3")
            .arg(imported).arg(skipped).arg(errors.isEmpty() ? "" : "\nErrors:\n" + errors.join("\n"))
        );
        refreshData();
    } else {
        QMessageBox::critical(this, "Import Failed", "Failed to process CSV file.");
    }
}

void BorrowersPage::showBorrowerDetailDialog(const Borrower &b) {
    QDialog detailDlg(this);
    detailDlg.setWindowTitle(QString("Member Profile - %1 (%2)").arg(b.name).arg(b.university_id));
    detailDlg.setFixedSize(620, 600);
    detailDlg.setStyleSheet("QDialog { background-color: #020617; }");

    auto *mainLayout = new QVBoxLayout(&detailDlg);
    mainLayout->setContentsMargins(20, 20, 20, 20);
    mainLayout->setSpacing(14);

    // Profile Header Card: Photo, Name, Role Badge, ID
    auto *headerCard = new QFrame(&detailDlg);
    headerCard->setStyleSheet("QFrame { background-color: #0B1220; border: 1px solid #334155; border-radius: 10px; padding: 12px; }");
    auto *headerLayout = new QHBoxLayout(headerCard);

    auto *photoLabel = new QLabel(headerCard);
    photoLabel->setFixedSize(70, 70);
    photoLabel->setStyleSheet("background-color: #020617; border: 1px solid #475569; border-radius: 6px;");
    photoLabel->setAlignment(Qt::AlignCenter);

    if (!b.photo_path.isEmpty() && QFile::exists(b.photo_path)) {
        QPixmap p(b.photo_path);
        photoLabel->setPixmap(p.scaled(70, 70, Qt::KeepAspectRatio, Qt::SmoothTransformation));
    } else {
        photoLabel->setText("PHOTO");
        photoLabel->setStyleSheet("color: #64748B; font-size: 10px;");
    }
    headerLayout->addWidget(photoLabel);

    auto *infoLayout = new QVBoxLayout();
    auto *nameLbl = new QLabel(b.name, headerCard);
    nameLbl->setFont(QFont("Plus Jakarta Sans", 13, QFont::Bold));
    nameLbl->setStyleSheet("color: #F1F5F9; border: none;");
    infoLayout->addWidget(nameLbl);

    auto *subLine = new QHBoxLayout();
    auto *roleBadge = new QLabel(b.role.toUpper(), headerCard);
    roleBadge->setStyleSheet(QString("background-color: %1; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px;")
        .arg(b.role == "Faculty" ? "#2563EB" : b.role == "Staff" ? "#0D9488" : "#D97706"));
    subLine->addWidget(roleBadge);

    auto *uidLbl = new QLabel(b.university_id, headerCard);
    uidLbl->setFont(QFont("JetBrains Mono", 10, QFont::Bold));
    uidLbl->setStyleSheet("color: #38BDF8; border: none;");
    subLine->addWidget(uidLbl);
    subLine->addStretch(1);
    infoLayout->addLayout(subLine);

    auto *deptLbl = new QLabel(QString("Dept: %1 · %2 · Status: %3")
        .arg(b.department)
        .arg(b.role == "Student" ? b.program : b.designation)
        .arg(b.status.toUpper()), headerCard);
    deptLbl->setStyleSheet("color: #94A3B8; font-size: 11px; border: none;");
    infoLayout->addWidget(deptLbl);

    headerLayout->addLayout(infoLayout, 1);
    mainLayout->addWidget(headerCard);

    // Tabs: Current Loans, History, Fines, Notes
    auto *tabs = new QTabWidget(&detailDlg);
    tabs->setStyleSheet("QTabWidget::pane { border: 1px solid #334155; border-radius: 8px; background-color: #0B1220; }");

    // Tab 1: Current Loans
    auto *loansWidget = new QWidget();
    auto *loansLayout = new QVBoxLayout(loansWidget);
    auto *loansTable = new QTableWidget(loansWidget);
    loansTable->setColumnCount(4);
    loansTable->setHorizontalHeaderLabels({"Book Title", "Barcode", "Due Date", "Days / Fine"});
    loansTable->horizontalHeader()->setSectionResizeMode(0, QHeaderView::Stretch);
    loansTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    loansTable->verticalHeader()->setVisible(false);

    QVector<Transaction> allTrans = DatabaseManager::instance().getBorrowerTransactions(b.id);
    int activeCount = 0;
    QDate today = QDate::currentDate();
    int fineRatePaisa = DatabaseManager::instance().getSetting("fine_rate_paisa", "5000").toInt();

    for (const auto &t : allTrans) {
        if (t.return_date.isEmpty()) {
            activeCount++;
            int rowIdx = loansTable->rowCount();
            loansTable->insertRow(rowIdx);

            auto optBook = DatabaseManager::instance().getBookById(t.book_id);
            QString title = optBook ? optBook->title : "Unknown Title";
            QString code = optBook ? optBook->barcode : QString::number(t.book_id);

            QDate due = QDate::fromString(t.due_date, Qt::ISODate);
            QString statusStr;
            if (due < today) {
                int overdue = due.daysTo(today);
                double fine = static_cast<double>(overdue * fineRatePaisa) / 100.0;
                statusStr = QString("%1 days OVERDUE (Rs %2)").arg(overdue).arg(fine, 0, 'f', 2);
            } else {
                statusStr = QString("%1 days left").arg(today.daysTo(due));
            }

            loansTable->setItem(rowIdx, 0, new QTableWidgetItem(title));
            loansTable->setItem(rowIdx, 1, new QTableWidgetItem(code));
            loansTable->setItem(rowIdx, 2, new QTableWidgetItem(t.due_date));
            auto *itemStatus = new QTableWidgetItem(statusStr);
            if (due < today) itemStatus->setForeground(QColor("#FB7185"));
            loansTable->setItem(rowIdx, 3, itemStatus);
        }
    }
    loansLayout->addWidget(loansTable);
    tabs->addTab(loansWidget, QString("Current Loans (%1)").arg(activeCount));

    // Tab 2: Loan History
    auto *histWidget = new QWidget();
    auto *histLayout = new QVBoxLayout(histWidget);
    auto *histTable = new QTableWidget(histWidget);
    histTable->setColumnCount(4);
    histTable->setHorizontalHeaderLabels({"Book Title", "Issue Date", "Return Date", "Fine Paid"});
    histTable->horizontalHeader()->setSectionResizeMode(0, QHeaderView::Stretch);
    histTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    histTable->verticalHeader()->setVisible(false);

    for (const auto &t : allTrans) {
        if (!t.return_date.isEmpty()) {
            int rowIdx = histTable->rowCount();
            histTable->insertRow(rowIdx);
            auto optBook = DatabaseManager::instance().getBookById(t.book_id);
            histTable->setItem(rowIdx, 0, new QTableWidgetItem(optBook ? optBook->title : "Book"));
            histTable->setItem(rowIdx, 1, new QTableWidgetItem(t.issue_date));
            histTable->setItem(rowIdx, 2, new QTableWidgetItem(t.return_date));
            histTable->setItem(rowIdx, 3, new QTableWidgetItem(Book::formatPaisa(t.fine_paid_paisa)));
        }
    }
    histLayout->addWidget(histTable);
    tabs->addTab(histWidget, "Circulation History");

    // Tab 3: Fines
    auto *finesWidget = new QWidget();
    auto *finesLayout = new QVBoxLayout(finesWidget);
    int unpaidFine = DatabaseManager::instance().getBorrowerUnpaidFinesPaisa(b.id);
    int paidFine = DatabaseManager::instance().getBorrowerTotalPaidFinesPaisa(b.id);

    auto *fineSummaryBox = new QFrame(finesWidget);
    fineSummaryBox->setStyleSheet("background-color: #0F172A; border-radius: 8px; padding: 14px;");
    auto *fBox = new QVBoxLayout(fineSummaryBox);

    auto *lblUnpaid = new QLabel(QString("Current Overdue Unpaid Fines: <b>Rs %1</b>")
        .arg(static_cast<double>(unpaidFine) / 100.0, 0, 'f', 2), fineSummaryBox);
    lblUnpaid->setStyleSheet(unpaidFine > 0 ? "color: #FB7185; font-size: 13px;" : "color: #10B981; font-size: 13px;");
    fBox->addWidget(lblUnpaid);

    auto *lblPaid = new QLabel(QString("Total Lifetime Fines Paid: <b>Rs %1</b>")
        .arg(static_cast<double>(paidFine) / 100.0, 0, 'f', 2), fineSummaryBox);
    lblPaid->setStyleSheet("color: #94A3B8; font-size: 12px; margin-top: 6px;");
    fBox->addWidget(lblPaid);

    finesLayout->addWidget(fineSummaryBox);
    finesLayout->addStretch(1);
    tabs->addTab(finesWidget, "Fines Balance");

    // Tab 4: Notes
    auto *notesWidget = new QWidget();
    auto *notesLayout = new QVBoxLayout(notesWidget);
    auto *notesBox = new QTextEdit(notesWidget);
    notesBox->setReadOnly(true);
    notesBox->setPlainText(b.notes.isEmpty() ? "No administrative notes recorded for this member." : b.notes);
    notesLayout->addWidget(notesBox);
    tabs->addTab(notesWidget, "Administrative Notes");

    mainLayout->addWidget(tabs, 1);

    // Dialog Action Buttons: Edit, Issue Book, Print Card, Close
    auto *btnRow = new QHBoxLayout();
    auto *btnEdit = new QPushButton("Edit Profile", &detailDlg);
    connect(btnEdit, &QPushButton::clicked, [&]() {
        detailDlg.accept();
        onEditSelected();
    });
    btnRow->addWidget(btnEdit);

    auto *btnIssue = new QPushButton("Issue Book", &detailDlg);
    connect(btnIssue, &QPushButton::clicked, [&]() {
        detailDlg.accept();
        emit issueBookRequested(b.id);
    });
    btnRow->addWidget(btnIssue);

    auto *btnPrint = new QPushButton("Print Card", &detailDlg);
    connect(btnPrint, &QPushButton::clicked, [&]() {
        MemberCardPrintDialog cardDlg(this, b);
        cardDlg.exec();
    });
    btnRow->addWidget(btnPrint);

    btnRow->addStretch(1);
    auto *btnClose = new QPushButton("Close", &detailDlg);
    connect(btnClose, &QPushButton::clicked, &detailDlg, &QDialog::accept);
    btnRow->addWidget(btnClose);

    mainLayout->addLayout(btnRow);
    detailDlg.exec();
}
