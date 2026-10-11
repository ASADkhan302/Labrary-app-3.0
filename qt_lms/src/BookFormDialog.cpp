#include "BookFormDialog.h"
#include "DatabaseManager.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGridLayout>
#include <QFormLayout>
#include <QGroupBox>
#include <QMessageBox>
#include <QSettings>
#include <QRegularExpression>
#include <QKeyEvent>
#include <QToolTip>

// Static values for "Same as above" and "Save & Next" continuity
QString BookFormDialog::s_lastAuthor = "";
QString BookFormDialog::s_lastPlace = "";
QString BookFormDialog::s_lastPublisher = "";
int BookFormDialog::s_lastYear = 0;
QString BookFormDialog::s_lastBinding = "HB";
QString BookFormDialog::s_lastBindingCode = "01";
QString BookFormDialog::s_lastSource = "Purchase";
QString BookFormDialog::s_lastCategory = "Computer Science";
QString BookFormDialog::s_lastShelf = "";

BookFormDialog::BookFormDialog(QWidget *parent, int editBookId)
    : QDialog(parent), m_editBookId(editBookId)
{
    setupUi();
    setupCompleters();

    if (m_editBookId > 0) {
        setWindowTitle("Edit Accession Record - ULM Central Campus Library");
        auto opt = DatabaseManager::instance().getBookById(m_editBookId);
        if (opt) {
            m_book = *opt;
            m_accNoSpin->setValue(m_book.accession_no);
            m_accNoSpin->setEnabled(false); // Can't change accession number once assigned
            m_authorEdit->setText(m_book.author);
            m_titleEdit->setText(m_book.title);
            m_editionEdit->setText(m_book.edition);
            m_placeEdit->setText(m_book.place);
            m_publisherEdit->setText(m_book.publisher);
            m_yearSpin->setValue(m_book.year);
            m_pagesEdit->setText(m_book.pages);
            m_priceRsSpin->setValue(m_book.price_paisa / 100);
            m_pricePsSpin->setValue(m_book.price_paisa % 100);
            m_bindingCombo->setCurrentText(m_book.binding);
            m_bindingCodeEdit->setText(m_book.binding_code);
            m_isbnEdit->setText(m_book.isbn);
            m_sourceRemarksEdit->setText(m_book.source_remarks);
            m_categoryCombo->setCurrentText(m_book.category);
            m_callNumberEdit->setText(m_book.dewey_call_number);
            m_shelfEdit->setText(m_book.shelf);
            m_btnSaveAndNext->setVisible(false); // Only "Save & Next" during new accessioning
        }
    } else {
        setWindowTitle("Accession Register Entry (Paper Form Order) - ULM LMS");
        m_accNoSpin->setValue(DatabaseManager::instance().getNextAccessionNumber());
        loadDraft();
        if (m_titleEdit->text().isEmpty()) {
            m_titleEdit->setFocus();
        }
    }
}

BookFormDialog::~BookFormDialog() {
}

void BookFormDialog::setupUi() {
    setMinimumWidth(820);
    setMinimumHeight(640);
    setStyleSheet("QDialog { background-color: #020617; }");

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setSpacing(14);
    mainLayout->setContentsMargins(20, 18, 20, 18);

    // Title banner
    auto *headerLabel = new QLabel(m_editBookId > 0 ? "EDIT PHYSICAL COPY ACCESSION" : "NEW ACCESSION REGISTER ENTRY", this);
    headerLabel->setStyleSheet("font-family: 'Cinzel', Georgia; font-size: 16px; font-weight: bold; color: #F59E0B;");
    mainLayout->addWidget(headerLabel);

    auto *subLabel = new QLabel("Fields follow the official paper accession register order. Press Tab to advance through columns.", this);
    subLabel->setStyleSheet("color: #A8B5C8; font-size: 11px;");
    mainLayout->addWidget(subLabel);

    // Form Container Box
    auto *registerBox = new QGroupBox("Accession Register Columns", this);
    registerBox->setStyleSheet(
        "QGroupBox { font-weight: bold; color: #60A5FA; border: 1px solid #1E293B; border-radius: 8px; margin-top: 10px; padding-top: 15px; }"
        "QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 4px; }"
    );
    auto *formLayout = new QGridLayout(registerBox);
    formLayout->setHorizontalSpacing(14);
    formLayout->setVerticalSpacing(10);

    auto createSameBtn = [this](const QString &field) -> QPushButton* {
        auto *btn = new QPushButton("↑", this);
        btn->setToolTip("Same as above (Copy last entered value)");
        btn->setFixedSize(26, 26);
        btn->setStyleSheet("QPushButton { padding: 0; background: #0F172A; border: 1px solid #334155; border-radius: 4px; color: #60A5FA; font-weight: bold; } QPushButton:hover { background: #1E293B; border-color: #60A5FA; }");
        connect(btn, &QPushButton::clicked, this, [this, field]() {
            onSameAsAboveClicked(field);
        });
        return btn;
    };

    // 1. Accession Number (Required, Unique, Suggest next automatically)
    auto *lbl1 = new QLabel("1. Accession No *:", this);
    m_accNoSpin = new QSpinBox(this);
    m_accNoSpin->setRange(1, 99999999);
    m_accNoSpin->setProperty("class", "CodeInput");
    m_accNoSpin->setToolTip("Required unique accession sequence number from register");
    formLayout->addWidget(lbl1, 0, 0);
    formLayout->addWidget(m_accNoSpin, 0, 1);

    // Barcode preview
    auto *barLabel = new QLabel("Barcode: Auto 'ULM-XXXXX'", this);
    barLabel->setStyleSheet("color: #60A5FA; font-family: 'JetBrains Mono'; font-size: 11px;");
    formLayout->addWidget(barLabel, 0, 2);

    // 2. Author (Optional, allow organizations)
    auto *lbl2 = new QLabel("2. Author / Organization:", this);
    auto *authorRow = new QHBoxLayout();
    m_authorEdit = new QLineEdit(this);
    m_authorEdit->setPlaceholderText("Primary author, editor, or issuing body");
    authorRow->addWidget(m_authorEdit);
    authorRow->addWidget(createSameBtn("author"));
    formLayout->addWidget(lbl2, 1, 0);
    formLayout->addLayout(authorRow, 1, 1, 1, 2);

    // 3. Title of the Book (Required)
    auto *lbl3 = new QLabel("3. Title of the Book *:", this);
    m_titleEdit = new QLineEdit(this);
    m_titleEdit->setPlaceholderText("Exact full title as printed on title page");
    formLayout->addWidget(lbl3, 2, 0);
    formLayout->addWidget(m_titleEdit, 2, 1, 1, 2);

    // 4. Edition
    auto *lbl4 = new QLabel("4. Edition:", this);
    m_editionEdit = new QLineEdit(this);
    m_editionEdit->setPlaceholderText("e.g. 1st, 2nd, Revised, 13th");
    formLayout->addWidget(lbl4, 3, 0);
    formLayout->addWidget(m_editionEdit, 3, 1, 1, 2);

    // 5. Place
    auto *lbl5 = new QLabel("5. Place (City / Country):", this);
    auto *placeRow = new QHBoxLayout();
    m_placeEdit = new QLineEdit(this);
    m_placeEdit->setPlaceholderText("e.g. Cambridge, MA / Karachi");
    placeRow->addWidget(m_placeEdit);
    placeRow->addWidget(createSameBtn("place"));
    formLayout->addWidget(lbl5, 4, 0);
    formLayout->addLayout(placeRow, 4, 1, 1, 2);

    // 6. Publisher
    auto *lbl6 = new QLabel("6. Publisher:", this);
    auto *pubRow = new QHBoxLayout();
    m_publisherEdit = new QLineEdit(this);
    m_publisherEdit->setPlaceholderText("e.g. MIT Press, Pearson, Oxford University Press");
    pubRow->addWidget(m_publisherEdit);
    pubRow->addWidget(createSameBtn("publisher"));
    formLayout->addWidget(lbl6, 5, 0);
    formLayout->addLayout(pubRow, 5, 1, 1, 2);

    // 7. Year (4 digits)
    auto *lbl7 = new QLabel("7. Year (4 digits):", this);
    auto *yearRow = new QHBoxLayout();
    m_yearSpin = new QSpinBox(this);
    m_yearSpin->setRange(0, 2099);
    m_yearSpin->setValue(QDate::currentDate().year());
    m_yearSpin->setSpecialValueText("-");
    yearRow->addWidget(m_yearSpin);
    yearRow->addWidget(createSameBtn("year"));
    yearRow->addStretch();
    formLayout->addWidget(lbl7, 6, 0);
    formLayout->addLayout(yearRow, 6, 1, 1, 2);

    // 8. Pages (Number or roman numerals)
    auto *lbl8 = new QLabel("8. Pages:", this);
    m_pagesEdit = new QLineEdit(this);
    m_pagesEdit->setPlaceholderText("e.g. 464 or xxiv, 512");
    formLayout->addWidget(lbl8, 7, 0);
    formLayout->addWidget(m_pagesEdit, 7, 1, 1, 2);

    // 9. Price (Two boxes: Rs and Ps)
    auto *lbl9 = new QLabel("9. Price:", this);
    auto *priceRow = new QHBoxLayout();
    priceRow->addWidget(new QLabel("Rs.", this));
    m_priceRsSpin = new QSpinBox(this);
    m_priceRsSpin->setRange(0, 9999999);
    m_priceRsSpin->setValue(0);
    priceRow->addWidget(m_priceRsSpin);

    priceRow->addWidget(new QLabel("Ps.", this));
    m_pricePsSpin = new QSpinBox(this);
    m_pricePsSpin->setRange(0, 99);
    m_pricePsSpin->setValue(0);
    priceRow->addWidget(m_pricePsSpin);
    priceRow->addStretch();

    formLayout->addWidget(lbl9, 8, 0);
    formLayout->addLayout(priceRow, 8, 1, 1, 2);

    // 10. Binding & Binding Code
    auto *lbl10 = new QLabel("10. Binding & Code:", this);
    auto *bindRow = new QHBoxLayout();
    m_bindingCombo = new QComboBox(this);
    m_bindingCombo->addItems({"HB", "SB", "Other"});
    bindRow->addWidget(m_bindingCombo);

    bindRow->addWidget(new QLabel("Code:", this));
    m_bindingCodeEdit = new QLineEdit(this);
    m_bindingCodeEdit->setPlaceholderText("e.g. 01, 04");
    m_bindingCodeEdit->setMaximumWidth(80);
    bindRow->addWidget(m_bindingCodeEdit);
    bindRow->addWidget(createSameBtn("binding"));
    bindRow->addStretch();

    formLayout->addWidget(lbl10, 9, 0);
    formLayout->addLayout(bindRow, 9, 1, 1, 2);

    // 11. ISBN (ISBN-10 or 13, warning only, never blocks)
    auto *lbl11 = new QLabel("11. ISBN (10/13):", this);
    auto *isbnCol = new QVBoxLayout();
    m_isbnEdit = new QLineEdit(this);
    m_isbnEdit->setPlaceholderText("978-0-13-235088-4 (hyphens allowed)");
    connect(m_isbnEdit, &QLineEdit::textChanged, this, &BookFormDialog::validateIsbn);
    isbnCol->addWidget(m_isbnEdit);

    m_isbnWarningLabel = new QLabel(this);
    m_isbnWarningLabel->setStyleSheet("color: #F59E0B; font-size: 11px; font-weight: 600;");
    m_isbnWarningLabel->setVisible(false);
    isbnCol->addWidget(m_isbnWarningLabel);

    formLayout->addWidget(lbl11, 10, 0);
    formLayout->addLayout(isbnCol, 10, 1, 1, 2);

    // 12. Source / Remarks
    auto *lbl12 = new QLabel("12. Source / Remarks:", this);
    auto *sourceRow = new QHBoxLayout();
    m_sourceRemarksEdit = new QLineEdit(this);
    m_sourceRemarksEdit->setPlaceholderText("e.g. Purchase, Donation, HEC Grant");
    sourceRow->addWidget(m_sourceRemarksEdit);
    sourceRow->addWidget(createSameBtn("source"));
    formLayout->addWidget(lbl12, 11, 0);
    formLayout->addLayout(sourceRow, 11, 1, 1, 2);

    mainLayout->addWidget(registerBox);

    // Optional Extras Box (Classification & Shelf)
    auto *extrasBox = new QGroupBox("Library Classification & Physical Stacks", this);
    extrasBox->setStyleSheet(
        "QGroupBox { font-weight: bold; color: #60A5FA; border: 1px solid #1E293B; border-radius: 8px; margin-top: 5px; padding-top: 12px; }"
        "QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 4px; }"
    );
    auto *extrasLayout = new QGridLayout(extrasBox);
    extrasLayout->setHorizontalSpacing(14);
    extrasLayout->setVerticalSpacing(8);

    extrasLayout->addWidget(new QLabel("Academic Discipline:", this), 0, 0);
    m_categoryCombo = new QComboBox(this);
    m_categoryCombo->setEditable(true);
    m_categoryCombo->addItems({
        "Computer Science", "Physics", "Chemistry", "Mathematics", 
        "Law", "Islamic Studies", "English", "History", "General"
    });
    extrasLayout->addWidget(m_categoryCombo, 0, 1);

    extrasLayout->addWidget(new QLabel("Dewey Call No:", this), 0, 2);
    m_callNumberEdit = new QLineEdit(this);
    m_callNumberEdit->setPlaceholderText("e.g. 005.133 COR");
    m_callNumberEdit->setProperty("class", "CodeInput");
    extrasLayout->addWidget(m_callNumberEdit, 0, 3);

    extrasLayout->addWidget(new QLabel("Shelf Location:", this), 1, 0);
    m_shelfEdit = new QLineEdit(this);
    m_shelfEdit->setPlaceholderText("e.g. CS-01-A");
    m_shelfEdit->setProperty("class", "CodeInput");
    extrasLayout->addWidget(m_shelfEdit, 1, 1);

    mainLayout->addWidget(extrasBox);

    // Action Buttons
    auto *btnLayout = new QHBoxLayout();
    btnLayout->setSpacing(12);

    m_btnCancel = new QPushButton("Cancel", this);
    connect(m_btnCancel, &QPushButton::clicked, this, &QDialog::reject);
    btnLayout->addWidget(m_btnCancel);

    btnLayout->addStretch();

    m_btnSaveAndNext = new QPushButton("⚡ Save & Next Entry [Enter]", this);
    m_btnSaveAndNext->setObjectName("AccentButton");
    m_btnSaveAndNext->setToolTip("Commit current record and immediately prepare next accession entry");
    connect(m_btnSaveAndNext, &QPushButton::clicked, this, &BookFormDialog::onSaveAndNext);
    btnLayout->addWidget(m_btnSaveAndNext);

    m_btnSaveAndClose = new QPushButton("✓ Save & Close", this);
    m_btnSaveAndClose->setObjectName("PrimaryButton");
    m_btnSaveAndClose->setDefault(true);
    connect(m_btnSaveAndClose, &QPushButton::clicked, this, &BookFormDialog::onSaveAndClose);
    btnLayout->addWidget(m_btnSaveAndClose);

    mainLayout->addLayout(btnLayout);

    // Register Tab Navigation Chain
    setTabOrder(m_accNoSpin, m_authorEdit);
    setTabOrder(m_authorEdit, m_titleEdit);
    setTabOrder(m_titleEdit, m_editionEdit);
    setTabOrder(m_editionEdit, m_placeEdit);
    setTabOrder(m_placeEdit, m_publisherEdit);
    setTabOrder(m_publisherEdit, m_yearSpin);
    setTabOrder(m_yearSpin, m_pagesEdit);
    setTabOrder(m_pagesEdit, m_priceRsSpin);
    setTabOrder(m_priceRsSpin, m_pricePsSpin);
    setTabOrder(m_pricePsSpin, m_bindingCombo);
    setTabOrder(m_bindingCombo, m_bindingCodeEdit);
    setTabOrder(m_bindingCodeEdit, m_isbnEdit);
    setTabOrder(m_isbnEdit, m_sourceRemarksEdit);
    setTabOrder(m_sourceRemarksEdit, m_categoryCombo);
    setTabOrder(m_categoryCombo, m_callNumberEdit);
    setTabOrder(m_callNumberEdit, m_shelfEdit);
    setTabOrder(m_shelfEdit, m_btnSaveAndClose);
}

void BookFormDialog::setupCompleters() {
    auto &db = DatabaseManager::instance();

    auto *authorComp = new QCompleter(db.getDistinctAuthors(), this);
    authorComp->setCaseSensitivity(Qt::CaseInsensitive);
    authorComp->setFilterMode(Qt::MatchContains);
    m_authorEdit->setCompleter(authorComp);

    auto *pubComp = new QCompleter(db.getDistinctPublishers(), this);
    pubComp->setCaseSensitivity(Qt::CaseInsensitive);
    pubComp->setFilterMode(Qt::MatchContains);
    m_publisherEdit->setCompleter(pubComp);

    auto *placeComp = new QCompleter(db.getDistinctPlaces(), this);
    placeComp->setCaseSensitivity(Qt::CaseInsensitive);
    placeComp->setFilterMode(Qt::MatchContains);
    m_placeEdit->setCompleter(placeComp);
}

void BookFormDialog::onSameAsAboveClicked(const QString &field) {
    if (field == "author" && !s_lastAuthor.isEmpty()) m_authorEdit->setText(s_lastAuthor);
    else if (field == "place" && !s_lastPlace.isEmpty()) m_placeEdit->setText(s_lastPlace);
    else if (field == "publisher" && !s_lastPublisher.isEmpty()) m_publisherEdit->setText(s_lastPublisher);
    else if (field == "year" && s_lastYear > 0) m_yearSpin->setValue(s_lastYear);
    else if (field == "binding") {
        m_bindingCombo->setCurrentText(s_lastBinding);
        m_bindingCodeEdit->setText(s_lastBindingCode);
    }
    else if (field == "source" && !s_lastSource.isEmpty()) m_sourceRemarksEdit->setText(s_lastSource);
}

void BookFormDialog::validateIsbn() {
    QString raw = m_isbnEdit->text().trimmed();
    QString cleaned = raw;
    cleaned.remove('-').remove(' ').remove('.');

    if (cleaned.isEmpty()) {
        m_isbnWarningLabel->setVisible(false);
        return;
    }

    if (cleaned.length() != 10 && cleaned.length() != 13) {
        m_isbnWarningLabel->setText("⚠ Note: ISBN length is not standard 10 or 13 digits (warning only)");
        m_isbnWarningLabel->setVisible(true);
        return;
    }

    // Check ISBN-13 checksum
    if (cleaned.length() == 13) {
        int sum = 0;
        for (int i = 0; i < 12; ++i) {
            int digit = cleaned[i].digitValue();
            sum += (i % 2 == 0) ? digit : digit * 3;
        }
        int check = (10 - (sum % 10)) % 10;
        if (check != cleaned[12].digitValue()) {
            m_isbnWarningLabel->setText("⚠ Note: ISBN-13 checksum does not match algorithm (warning only)");
            m_isbnWarningLabel->setVisible(true);
            return;
        }
    }

    m_isbnWarningLabel->setVisible(false);
}

bool BookFormDialog::checkDuplicateIsbn(const QString &isbn) {
    if (isbn.trimmed().isEmpty()) return true;
    if (DatabaseManager::instance().hasDuplicateIsbn(isbn, m_editBookId)) {
        auto res = QMessageBox::question(
            this,
            "Duplicate ISBN Detected",
            QString("A copy with ISBN '%1' already exists in the catalog.\n\n"
                    "Would you like to register this as an additional physical copy?").arg(isbn),
            QMessageBox::Yes | QMessageBox::No,
            QMessageBox::Yes
        );
        return (res == QMessageBox::Yes);
    }
    return true;
}

bool BookFormDialog::collectAndValidate(Book &book) {
    QString title = m_titleEdit->text().trimmed();
    if (title.isEmpty()) {
        QMessageBox::warning(this, "Title Required", "Accession register requires a book title.");
        m_titleEdit->setFocus();
        return false;
    }

    QString isbn = m_isbnEdit->text().trimmed();
    isbn.remove('-').remove(' ').remove('.');

    if (!checkDuplicateIsbn(isbn)) {
        return false;
    }

    book.id = m_editBookId;
    book.accession_no = m_accNoSpin->value();
    book.barcode = Book::formatBarcode(book.accession_no);
    book.author = m_authorEdit->text().trimmed();
    book.title = title;
    book.edition = m_editionEdit->text().trimmed();
    book.place = m_placeEdit->text().trimmed();
    book.publisher = m_publisherEdit->text().trimmed();
    book.year = m_yearSpin->value();
    book.pages = m_pagesEdit->text().trimmed();
    book.price_paisa = (m_priceRsSpin->value() * 100) + m_pricePsSpin->value();
    book.binding = m_bindingCombo->currentText();
    book.binding_code = m_bindingCodeEdit->text().trimmed();
    book.isbn = isbn;
    book.source_remarks = m_sourceRemarksEdit->text().trimmed();
    book.category = m_categoryCombo->currentText().trimmed();
    book.dewey_call_number = m_callNumberEdit->text().trimmed();
    book.shelf = m_shelfEdit->text().trimmed();
    book.status = (m_editBookId > 0 && !m_book.status.isEmpty()) ? m_book.status : "available";
    book.is_active = true;

    // Cache static last values
    s_lastAuthor = book.author;
    s_lastPlace = book.place;
    s_lastPublisher = book.publisher;
    s_lastYear = book.year;
    s_lastBinding = book.binding;
    s_lastBindingCode = book.binding_code;
    s_lastSource = book.source_remarks;
    s_lastCategory = book.category;
    s_lastShelf = book.shelf;

    return true;
}

void BookFormDialog::onSaveAndClose() {
    Book b;
    if (!collectAndValidate(b)) return;

    bool ok = false;
    if (m_editBookId > 0) {
        ok = DatabaseManager::instance().updateBook(b);
    } else {
        ok = DatabaseManager::instance().addBook(b);
    }

    if (ok) {
        m_book = b;
        m_saved = true;
        clearDraft();
        emit bookSaved(m_book);
        accept();
    } else {
        QMessageBox::critical(this, "Save Failed", "Could not write accession record to SQLite database.");
    }
}

void BookFormDialog::onSaveAndNext() {
    Book b;
    if (!collectAndValidate(b)) return;

    if (DatabaseManager::instance().addBook(b)) {
        m_saved = true;
        emit bookSaved(b);

        // Advance to next accession number
        m_accNoSpin->setValue(DatabaseManager::instance().getNextAccessionNumber());

        // Keep Place, Publisher, Year, Binding, Source, Category, Shelf
        // Clear Title, Pages, ISBN, Price
        m_titleEdit->clear();
        m_pagesEdit->clear();
        m_isbnEdit->clear();
        m_isbnWarningLabel->setVisible(false);

        m_titleEdit->setFocus();
        clearDraft();
    } else {
        QMessageBox::critical(this, "Save Failed", "Could not commit accession record.");
    }
}

void BookFormDialog::saveDraft() {
    if (m_editBookId > 0) return;
    QSettings settings("University of Lakki Marwat", "ULM-LMS");
    settings.setValue("draft/hasDraft", true);
    settings.setValue("draft/title", m_titleEdit->text());
    settings.setValue("draft/author", m_authorEdit->text());
    settings.setValue("draft/edition", m_editionEdit->text());
    settings.setValue("draft/place", m_placeEdit->text());
    settings.setValue("draft/publisher", m_publisherEdit->text());
    settings.setValue("draft/year", m_yearSpin->value());
    settings.setValue("draft/pages", m_pagesEdit->text());
    settings.setValue("draft/rs", m_priceRsSpin->value());
    settings.setValue("draft/ps", m_pricePsSpin->value());
    settings.setValue("draft/isbn", m_isbnEdit->text());
    settings.setValue("draft/source", m_sourceRemarksEdit->text());
    settings.setValue("draft/category", m_categoryCombo->currentText());
    settings.setValue("draft/dewey", m_callNumberEdit->text());
    settings.setValue("draft/shelf", m_shelfEdit->text());
}

void BookFormDialog::loadDraft() {
    QSettings settings("University of Lakki Marwat", "ULM-LMS");
    if (!settings.value("draft/hasDraft", false).toBool()) return;

    m_titleEdit->setText(settings.value("draft/title").toString());
    m_authorEdit->setText(settings.value("draft/author").toString());
    m_editionEdit->setText(settings.value("draft/edition").toString());
    m_placeEdit->setText(settings.value("draft/place").toString());
    m_publisherEdit->setText(settings.value("draft/publisher").toString());
    m_yearSpin->setValue(settings.value("draft/year", QDate::currentDate().year()).toInt());
    m_pagesEdit->setText(settings.value("draft/pages").toString());
    m_priceRsSpin->setValue(settings.value("draft/rs", 0).toInt());
    m_pricePsSpin->setValue(settings.value("draft/ps", 0).toInt());
    m_isbnEdit->setText(settings.value("draft/isbn").toString());
    m_sourceRemarksEdit->setText(settings.value("draft/source").toString());
    m_categoryCombo->setCurrentText(settings.value("draft/category", "Computer Science").toString());
    m_callNumberEdit->setText(settings.value("draft/dewey").toString());
    m_shelfEdit->setText(settings.value("draft/shelf").toString());
}

void BookFormDialog::clearDraft() {
    QSettings settings("University of Lakki Marwat", "ULM-LMS");
    settings.remove("draft");
}

void BookFormDialog::closeEvent(QCloseEvent *event) {
    if (!m_saved && !m_titleEdit->text().trimmed().isEmpty()) {
        saveDraft();
    }
    QDialog::closeEvent(event);
}
