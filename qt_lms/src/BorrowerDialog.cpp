#include "BorrowerDialog.h"
#include "DatabaseManager.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGridLayout>
#include <QFormLayout>
#include <QGroupBox>
#include <QFileDialog>
#include <QMessageBox>
#include <QSettings>
#include <QRegularExpression>
#include <QKeyEvent>
#include <QCloseEvent>
#include <QScrollArea>
#include <QImageReader>

QString BorrowerDialog::s_lastRole = "Student";
QString BorrowerDialog::s_lastDepartment = "Computer Science";
QString BorrowerDialog::s_lastProgram = "BCS";
QString BorrowerDialog::s_lastSession = "FA23";
int BorrowerDialog::s_lastSemester = 1;
QString BorrowerDialog::s_lastValidUntil = "";
int BorrowerDialog::s_lastBorrowLimit = 3;

BorrowerDialog::BorrowerDialog(QWidget *parent, const Borrower *borrowerToEdit)
    : QDialog(parent)
{
    setFixedSize(640, 720);
    setStyleSheet("QDialog { background-color: #020617; }");

    if (borrowerToEdit) {
        m_isEdit = true;
        m_editId = borrowerToEdit->id;
        m_borrower = *borrowerToEdit;
        setWindowTitle(QString("Edit Borrower Profile - %1 (%2)").arg(m_borrower.name).arg(m_borrower.university_id));
    } else {
        m_isEdit = false;
        setWindowTitle("Add Person (Borrower Registration) - ULM Central Campus LMS");
    }

    setupUi();
    setupDepartmentCompleter();

    if (m_isEdit) {
        onRoleChanged(m_borrower.role);
        m_uidEdit->setText(m_borrower.university_id);
        m_nameEdit->setText(m_borrower.name);
        m_deptCombo->setCurrentText(m_borrower.department);
        m_phoneEdit->setText(m_borrower.phone);
        m_emailEdit->setText(m_borrower.email);
        m_addressEdit->setText(m_borrower.address);
        m_statusCombo->setCurrentText(m_borrower.status);
        m_notesEdit->setPlainText(m_borrower.notes);
        m_limitSpin->setValue(m_borrower.borrow_limit);

        if (!m_borrower.joined_date.isEmpty()) {
            m_joinedDateEdit->setDate(QDate::fromString(m_borrower.joined_date, Qt::ISODate));
        }
        if (!m_borrower.valid_until.isEmpty()) {
            m_validUntilEdit->setDate(QDate::fromString(m_borrower.valid_until, Qt::ISODate));
        }

        m_fatherNameEdit->setText(m_borrower.father_name);
        m_programEdit->setText(m_borrower.program);
        m_sessionEdit->setText(m_borrower.session);
        m_semesterSpin->setValue(m_borrower.semester > 0 ? m_borrower.semester : 1);
        m_designationCombo->setCurrentText(m_borrower.designation);

        if (!m_borrower.photo_path.isEmpty() && QFile::exists(m_borrower.photo_path)) {
            QPixmap pix(m_borrower.photo_path);
            m_photoPreview->setPixmap(pix.scaled(72, 72, Qt::KeepAspectRatio, Qt::SmoothTransformation));
            m_savedPhotoRelativePath = m_borrower.photo_path;
            m_btnClearPhoto->setEnabled(true);
        }

        m_btnSaveAndNext->setVisible(false);
    } else {
        loadDraft();
    }
}

BorrowerDialog::~BorrowerDialog() {
}

void BorrowerDialog::setupUi() {
    auto *rootLayout = new QVBoxLayout(this);
    rootLayout->setContentsMargins(18, 16, 18, 16);
    rootLayout->setSpacing(12);

    // Scrollable form container
    auto *scrollArea = new QScrollArea(this);
    scrollArea->setWidgetResizable(true);
    scrollArea->setFrameShape(QFrame::NoFrame);
    scrollArea->setStyleSheet("QScrollArea { background-color: transparent; }");

    auto *cardWidget = new QWidget(scrollArea);
    cardWidget->setStyleSheet(
        "QWidget {"
        "  background-color: #0B1220;"
        "  border: 1px solid #334155;"
        "  border-radius: 12px;"
        "}"
    );

    auto *formLayout = new QVBoxLayout(cardWidget);
    formLayout->setContentsMargins(20, 20, 20, 20);
    formLayout->setSpacing(14);

    // Header Title
    auto *titleRow = new QHBoxLayout();
    auto *titleLabel = new QLabel(m_isEdit ? "EDIT BORROWER RECORD" : "NEW BORROWER REGISTRATION", cardWidget);
    titleLabel->setFont(QFont("Cinzel", 14, QFont::Bold));
    titleLabel->setStyleSheet("color: #F59E0B; border: none; background: transparent;");
    titleRow->addWidget(titleLabel);
    titleRow->addStretch(1);
    formLayout->addLayout(titleRow);

    // Top Segmented Role Selector [Student | Faculty | Staff]
    auto *roleSelectorBox = new QFrame(cardWidget);
    roleSelectorBox->setStyleSheet(
        "QFrame {"
        "  background-color: #020617;"
        "  border: 1px solid #334155;"
        "  border-radius: 8px;"
        "  padding: 3px;"
        "}"
    );
    auto *roleLayout = new QHBoxLayout(roleSelectorBox);
    roleLayout->setContentsMargins(2, 2, 2, 2);
    roleLayout->setSpacing(4);

    m_roleGroup = new QButtonGroup(this);

    m_btnRoleStudent = new QPushButton("Student", roleSelectorBox);
    m_btnRoleStudent->setCheckable(true);
    m_btnRoleStudent->setChecked(true);
    m_btnRoleStudent->setCursor(Qt::PointingHandCursor);
    m_btnRoleStudent->setFont(QFont("Plus Jakarta Sans", 10, QFont::DemiBold));
    roleLayout->addWidget(m_btnRoleStudent);
    m_roleGroup->addButton(m_btnRoleStudent, 0);

    m_btnRoleFaculty = new QPushButton("Faculty", roleSelectorBox);
    m_btnRoleFaculty->setCheckable(true);
    m_btnRoleFaculty->setCursor(Qt::PointingHandCursor);
    m_btnRoleFaculty->setFont(QFont("Plus Jakarta Sans", 10, QFont::DemiBold));
    roleLayout->addWidget(m_btnRoleFaculty);
    m_roleGroup->addButton(m_btnRoleFaculty, 1);

    m_btnRoleStaff = new QPushButton("Staff", roleSelectorBox);
    m_btnRoleStaff->setCheckable(true);
    m_btnRoleStaff->setCursor(Qt::PointingHandCursor);
    m_btnRoleStaff->setFont(QFont("Plus Jakarta Sans", 10, QFont::DemiBold));
    roleLayout->addWidget(m_btnRoleStaff);
    m_roleGroup->addButton(m_btnRoleStaff, 2);

    formLayout->addWidget(roleSelectorBox);

    // Duplicate ID Alert Banner (hidden by default)
    m_duplicateBanner = new QFrame(cardWidget);
    m_duplicateBanner->setStyleSheet(
        "QFrame {"
        "  background-color: rgba(244, 63, 94, 0.15);"
        "  border: 1px solid rgba(244, 63, 94, 0.4);"
        "  border-radius: 8px;"
        "  padding: 8px 12px;"
        "}"
    );
    auto *dupLayout = new QHBoxLayout(m_duplicateBanner);
    dupLayout->setContentsMargins(6, 4, 6, 4);
    m_duplicateLabel = new QLabel(m_duplicateBanner);
    m_duplicateLabel->setFont(QFont("Plus Jakarta Sans", 9, QFont::DemiBold));
    m_duplicateLabel->setStyleSheet("color: #FDA4AF; border: none; background: transparent;");
    dupLayout->addWidget(m_duplicateLabel, 1);

    m_btnOpenDuplicate = new QPushButton("Open Record", m_duplicateBanner);
    m_btnOpenDuplicate->setStyleSheet(
        "QPushButton {"
        "  background-color: #BE123C;"
        "  color: white;"
        "  border: none;"
        "  border-radius: 4px;"
        "  padding: 4px 10px;"
        "  font-size: 11px;"
        "  font-weight: bold;"
        "}"
    );
    dupLayout->addWidget(m_btnOpenDuplicate);
    m_duplicateBanner->setVisible(false);
    formLayout->addWidget(m_duplicateBanner);

    // Main Form Grid
    auto *fieldsLayout = new QGridLayout();
    fieldsLayout->setSpacing(10);
    int row = 0;

    // 1. University ID (Required, Unique, pattern auto-fill)
    auto *lblUid = new QLabel("University ID: *", cardWidget);
    lblUid->setStyleSheet("color: #CBD5E1; font-weight: bold; border: none;");
    fieldsLayout->addWidget(lblUid, row, 0);

    m_uidEdit = new QLineEdit(cardWidget);
    m_uidEdit->setFont(QFont("JetBrains Mono", 10));
    m_uidEdit->setPlaceholderText("e.g. ULM-FA23-BCS-042 or ULM-FAC-CS-007");
    fieldsLayout->addWidget(m_uidEdit, row, 1);
    row++;

    m_uidWarningLabel = new QLabel(cardWidget);
    m_uidWarningLabel->setFont(QFont("Plus Jakarta Sans", 8));
    m_uidWarningLabel->setStyleSheet("color: #FBBF24; border: none;");
    m_uidWarningLabel->setVisible(false);
    fieldsLayout->addWidget(m_uidWarningLabel, row, 1);
    row++;

    // 2. Full Name (Required)
    auto *lblName = new QLabel("Full Name: *", cardWidget);
    lblName->setStyleSheet("color: #CBD5E1; font-weight: bold; border: none;");
    fieldsLayout->addWidget(lblName, row, 0);

    m_nameEdit = new QLineEdit(cardWidget);
    m_nameEdit->setPlaceholderText("Full registered academic name");
    fieldsLayout->addWidget(m_nameEdit, row, 1);
    row++;

    // 3. Department (Dropdown with autocomplete and add new)
    auto *lblDept = new QLabel("Department: *", cardWidget);
    lblDept->setStyleSheet("color: #CBD5E1; font-weight: bold; border: none;");
    fieldsLayout->addWidget(lblDept, row, 0);

    auto *deptBox = new QHBoxLayout();
    m_deptCombo = new QComboBox(cardWidget);
    m_deptCombo->setEditable(true);
    m_deptCombo->addItems({
        "Computer Science", "Law", "Education", "Physics", 
        "Mathematics", "Chemistry", "English", "Islamic Studies", 
        "Management Sciences", "Civil Engineering"
    });
    deptBox->addWidget(m_deptCombo, 1);

    auto *btnSameDept = new QPushButton("Same as above", cardWidget);
    btnSameDept->setCursor(Qt::PointingHandCursor);
    btnSameDept->setStyleSheet("QPushButton { font-size: 10px; color: #60A5FA; background: transparent; border: none; }");
    connect(btnSameDept, &QPushButton::clicked, [this]() { onSameAsAbove("department"); });
    deptBox->addWidget(btnSameDept);
    fieldsLayout->addLayout(deptBox, row, 1);
    row++;

    // Student Only Fields Frame
    m_studentFieldsFrame = new QFrame(cardWidget);
    m_studentFieldsFrame->setStyleSheet("QFrame { background-color: rgba(15, 23, 42, 0.6); border: 1px solid #1E293B; border-radius: 8px; padding: 6px; }");
    auto *studentGrid = new QGridLayout(m_studentFieldsFrame);
    studentGrid->setSpacing(8);

    studentGrid->addWidget(new QLabel("Father Name:", m_studentFieldsFrame), 0, 0);
    m_fatherNameEdit = new QLineEdit(m_studentFieldsFrame);
    m_fatherNameEdit->setPlaceholderText("Father's full name");
    studentGrid->addWidget(m_fatherNameEdit, 0, 1);

    studentGrid->addWidget(new QLabel("Program (Degree):", m_studentFieldsFrame), 1, 0);
    m_programEdit = new QLineEdit(m_studentFieldsFrame);
    m_programEdit->setPlaceholderText("e.g. BCS, BS Physics, LLB");
    studentGrid->addWidget(m_programEdit, 1, 1);

    studentGrid->addWidget(new QLabel("Session:", m_studentFieldsFrame), 2, 0);
    m_sessionEdit = new QLineEdit(m_studentFieldsFrame);
    m_sessionEdit->setPlaceholderText("e.g. FA23, SP24");
    studentGrid->addWidget(m_sessionEdit, 2, 1);

    studentGrid->addWidget(new QLabel("Semester:", m_studentFieldsFrame), 3, 0);
    m_semesterSpin = new QSpinBox(m_studentFieldsFrame);
    m_semesterSpin->setRange(1, 12);
    m_semesterSpin->setValue(1);
    studentGrid->addWidget(m_semesterSpin, 3, 1);

    fieldsLayout->addWidget(m_studentFieldsFrame, row, 0, 1, 2);
    row++;

    // Faculty / Staff Only Fields Frame
    m_facultyStaffFieldsFrame = new QFrame(cardWidget);
    m_facultyStaffFieldsFrame->setStyleSheet("QFrame { background-color: rgba(15, 23, 42, 0.6); border: 1px solid #1E293B; border-radius: 8px; padding: 6px; }");
    auto *facultyGrid = new QGridLayout(m_facultyStaffFieldsFrame);
    facultyGrid->setSpacing(8);

    facultyGrid->addWidget(new QLabel("Designation / Title:", m_facultyStaffFieldsFrame), 0, 0);
    m_designationCombo = new QComboBox(m_facultyStaffFieldsFrame);
    m_designationCombo->setEditable(true);
    m_designationCombo->addItems({
        "Professor", "Associate Professor", "Assistant Professor", "Lecturer",
        "Visiting Faculty", "Librarian", "Assistant Librarian", "Lab Engineer",
        "Clerk", "Accountant", "Superintendent", "Other"
    });
    facultyGrid->addWidget(m_designationCombo, 0, 1);

    fieldsLayout->addWidget(m_facultyStaffFieldsFrame, row, 0, 1, 2);
    row++;

    // 4. Phone (Pakistani format 03XX-XXXXXXX)
    auto *lblPhone = new QLabel("Mobile Phone: *", cardWidget);
    lblPhone->setStyleSheet("color: #CBD5E1; font-weight: bold; border: none;");
    fieldsLayout->addWidget(lblPhone, row, 0);

    m_phoneEdit = new QLineEdit(cardWidget);
    m_phoneEdit->setFont(QFont("JetBrains Mono", 10));
    m_phoneEdit->setPlaceholderText("03XX-XXXXXXX or +92 3XX XXXXXXX");
    fieldsLayout->addWidget(m_phoneEdit, row, 1);
    row++;

    // 5. Email (Optional, validated)
    auto *lblEmail = new QLabel("Email Address:", cardWidget);
    lblEmail->setStyleSheet("color: #94A3B8; border: none;");
    fieldsLayout->addWidget(lblEmail, row, 0);

    m_emailEdit = new QLineEdit(cardWidget);
    m_emailEdit->setFont(QFont("JetBrains Mono", 9));
    m_emailEdit->setPlaceholderText("user@ulm.edu.pk (optional)");
    fieldsLayout->addWidget(m_emailEdit, row, 1);
    row++;

    // 6. Address (Optional)
    auto *lblAddr = new QLabel("Residential Address:", cardWidget);
    lblAddr->setStyleSheet("color: #94A3B8; border: none;");
    fieldsLayout->addWidget(lblAddr, row, 0);

    m_addressEdit = new QLineEdit(cardWidget);
    m_addressEdit->setPlaceholderText("City, Tehsil, or Campus Hostel block");
    fieldsLayout->addWidget(m_addressEdit, row, 1);
    row++;

    // 7. Photo Row (Browse and 300px resize into Photos folder)
    auto *lblPhoto = new QLabel("Member Photo:", cardWidget);
    lblPhoto->setStyleSheet("color: #94A3B8; border: none;");
    fieldsLayout->addWidget(lblPhoto, row, 0);

    auto *photoRow = new QHBoxLayout();
    m_photoPreview = new QLabel(cardWidget);
    m_photoPreview->setFixedSize(72, 72);
    m_photoPreview->setStyleSheet("background-color: #020617; border: 1px dashed #475569; border-radius: 6px;");
    m_photoPreview->setAlignment(Qt::AlignCenter);
    m_photoPreview->setText("No Photo");
    photoRow->addWidget(m_photoPreview);

    auto *photoButtonsLayout = new QVBoxLayout();
    m_btnBrowsePhoto = new QPushButton("Browse Photo...", cardWidget);
    m_btnBrowsePhoto->setCursor(Qt::PointingHandCursor);
    m_btnBrowsePhoto->setStyleSheet("QPushButton { font-size: 11px; padding: 4px 10px; background-color: #1E293B; color: white; border: 1px solid #475569; border-radius: 4px; }");
    connect(m_btnBrowsePhoto, &QPushButton::clicked, this, &BorrowerDialog::onBrowsePhoto);
    photoButtonsLayout->addWidget(m_btnBrowsePhoto);

    m_btnClearPhoto = new QPushButton("Remove Photo", cardWidget);
    m_btnClearPhoto->setEnabled(false);
    m_btnClearPhoto->setCursor(Qt::PointingHandCursor);
    m_btnClearPhoto->setStyleSheet("QPushButton { font-size: 11px; padding: 4px 10px; background-color: transparent; color: #FB7185; border: 1px solid rgba(251, 113, 133, 0.4); border-radius: 4px; }");
    connect(m_btnClearPhoto, &QPushButton::clicked, this, &BorrowerDialog::onClearPhoto);
    photoButtonsLayout->addWidget(m_btnClearPhoto);

    photoRow->addLayout(photoButtonsLayout);
    photoRow->addStretch(1);
    fieldsLayout->addLayout(photoRow, row, 1);
    row++;

    // 8. Joined Date & 9. Valid Until
    auto *lblDates = new QLabel("Validity Window:", cardWidget);
    lblDates->setStyleSheet("color: #CBD5E1; font-weight: bold; border: none;");
    fieldsLayout->addWidget(lblDates, row, 0);

    auto *datesRow = new QHBoxLayout();
    datesRow->addWidget(new QLabel("Joined:", cardWidget));
    m_joinedDateEdit = new QDateEdit(QDate::currentDate(), cardWidget);
    m_joinedDateEdit->setCalendarPopup(true);
    datesRow->addWidget(m_joinedDateEdit);

    datesRow->addWidget(new QLabel("Valid Until:", cardWidget));
    m_validUntilEdit = new QDateEdit(QDate::currentDate().addYears(3), cardWidget);
    m_validUntilEdit->setCalendarPopup(true);
    datesRow->addWidget(m_validUntilEdit);
    fieldsLayout->addLayout(datesRow, row, 1);
    row++;

    // 10. Borrow Limit & 11. Status
    auto *lblStatus = new QLabel("Limit & Status:", cardWidget);
    lblStatus->setStyleSheet("color: #CBD5E1; font-weight: bold; border: none;");
    fieldsLayout->addWidget(lblStatus, row, 0);

    auto *limitStatusRow = new QHBoxLayout();
    limitStatusRow->addWidget(new QLabel("Borrow Limit:", cardWidget));
    m_limitSpin = new QSpinBox(cardWidget);
    m_limitSpin->setRange(1, 25);
    m_limitSpin->setValue(3);
    limitStatusRow->addWidget(m_limitSpin);

    limitStatusRow->addWidget(new QLabel("Account Status:", cardWidget));
    m_statusCombo = new QComboBox(cardWidget);
    m_statusCombo->addItems({"active", "suspended", "left"});
    limitStatusRow->addWidget(m_statusCombo);
    fieldsLayout->addLayout(limitStatusRow, row, 1);
    row++;

    // 12. Notes
    auto *lblNotes = new QLabel("Notes / Remarks:", cardWidget);
    lblNotes->setStyleSheet("color: #94A3B8; border: none;");
    fieldsLayout->addWidget(lblNotes, row, 0);

    m_notesEdit = new QPlainTextEdit(cardWidget);
    m_notesEdit->setFixedHeight(50);
    m_notesEdit->setPlaceholderText("Optional administrative notes...");
    fieldsLayout->addWidget(m_notesEdit, row, 1);
    row++;

    formLayout->addLayout(fieldsLayout);
    scrollArea->setWidget(cardWidget);
    rootLayout->addWidget(scrollArea, 1);

    // Bottom Action Buttons
    auto *bottomRow = new QHBoxLayout();
    bottomRow->setSpacing(10);

    m_btnCancel = new QPushButton("Cancel", this);
    m_btnCancel->setCursor(Qt::PointingHandCursor);
    m_btnCancel->setStyleSheet("QPushButton { background-color: #1E293B; color: #94A3B8; border: 1px solid #334155; border-radius: 6px; padding: 8px 16px; font-weight: 600; }");
    connect(m_btnCancel, &QPushButton::clicked, this, &QDialog::reject);
    bottomRow->addWidget(m_btnCancel);

    bottomRow->addStretch(1);

    m_btnSaveAndNext = new QPushButton("Save & Next", this);
    m_btnSaveAndNext->setCursor(Qt::PointingHandCursor);
    m_btnSaveAndNext->setStyleSheet("QPushButton { background-color: #2563EB; color: white; border: 1px solid #1D4ED8; border-radius: 6px; padding: 8px 20px; font-weight: bold; }");
    connect(m_btnSaveAndNext, &QPushButton::clicked, this, &BorrowerDialog::onSaveAndNext);
    bottomRow->addWidget(m_btnSaveAndNext);

    m_btnSaveAndClose = new QPushButton(m_isEdit ? "Save Changes" : "Save & Close", this);
    m_btnSaveAndClose->setCursor(Qt::PointingHandCursor);
    m_btnSaveAndClose->setStyleSheet("QPushButton { background-color: #F59E0B; color: #020617; border: 1px solid #D97706; border-radius: 6px; padding: 8px 22px; font-weight: bold; }");
    connect(m_btnSaveAndClose, &QPushButton::clicked, this, &BorrowerDialog::onSaveAndClose);
    bottomRow->addWidget(m_btnSaveAndClose);

    rootLayout->addLayout(bottomRow);

    // Signals & connections
    connect(m_roleGroup, &QButtonGroup::idClicked, [this](int id) {
        if (id == 0) onRoleChanged("Student");
        else if (id == 1) onRoleChanged("Faculty");
        else onRoleChanged("Staff");
    });

    connect(m_uidEdit, &QLineEdit::textChanged, this, &BorrowerDialog::onUniversityIdEdited);
    connect(m_btnOpenDuplicate, &QPushButton::clicked, this, &BorrowerDialog::onOpenExistingDuplicate);

    applyTheme();
    updateRoleFieldsVisibility();
}

void BorrowerDialog::setupDepartmentCompleter() {
    QStringList depts = DatabaseManager::instance().getDistinctBorrowerDepartments();
    auto *completer = new QCompleter(depts, this);
    completer->setCaseSensitivity(Qt::CaseInsensitive);
    completer->setFilterMode(Qt::MatchContains);
    m_deptCombo->setCompleter(completer);
}

void BorrowerDialog::applyTheme() {
    QString activeSegment = "QPushButton { background-color: #F59E0B; color: #020617; border: 1px solid #D97706; border-radius: 6px; padding: 6px 12px; font-weight: bold; }";
    QString inactiveSegment = "QPushButton { background-color: transparent; color: #94A3B8; border: none; padding: 6px 12px; font-weight: 600; } QPushButton:hover { color: white; background-color: rgba(255,255,255,0.05); }";

    m_btnRoleStudent->setStyleSheet(m_currentRole == "Student" ? activeSegment : inactiveSegment);
    m_btnRoleFaculty->setStyleSheet(m_currentRole == "Faculty" ? activeSegment : inactiveSegment);
    m_btnRoleStaff->setStyleSheet(m_currentRole == "Staff" ? activeSegment : inactiveSegment);
}

void BorrowerDialog::onRoleChanged(const QString &role) {
    m_currentRole = role;
    applyTheme();
    updateRoleFieldsVisibility();

    if (!m_isEdit) {
        m_limitSpin->setValue(Borrower::defaultLimitForRole(role));
    }
}

void BorrowerDialog::updateRoleFieldsVisibility() {
    bool isStudent = (m_currentRole == "Student");
    m_studentFieldsFrame->setVisible(isStudent);
    m_facultyStaffFieldsFrame->setVisible(!isStudent);
}

void BorrowerDialog::onUniversityIdEdited(const QString &text) {
    QString uid = text.trimmed();
    m_duplicateBanner->setVisible(false);
    m_duplicateExistingId = 0;

    if (uid.isEmpty()) {
        m_uidWarningLabel->setVisible(false);
        return;
    }

    // 1. Check duplicate University ID
    QString existingName;
    int existingId = 0;
    if (DatabaseManager::instance().hasDuplicateUniversityId(uid, m_isEdit ? m_editId : 0, existingName, existingId)) {
        m_duplicateLabel->setText(QString("Already exists: %1 (ID %2)").arg(existingName).arg(uid));
        m_duplicateExistingId = existingId;
        m_duplicateBanner->setVisible(true);
        m_btnSaveAndClose->setEnabled(false);
        m_btnSaveAndNext->setEnabled(false);
        return;
    } else {
        m_btnSaveAndClose->setEnabled(true);
        m_btnSaveAndNext->setEnabled(true);
    }

    // 2. Pattern auto-fill for students: ^ULM-([A-Z]{2}\d{2})-([A-Z]+)-(\d{3})$
    QString session, program, roll;
    if (Borrower::parseUniversityId(uid, session, program, roll)) {
        m_uidWarningLabel->setText(QString("✓ ULM ID Pattern recognized: Session %1, Program %2").arg(session).arg(program));
        m_uidWarningLabel->setStyleSheet("color: #34D399; font-size: 11px;");
        m_uidWarningLabel->setVisible(true);

        if (m_currentRole == "Student" && !m_isEdit) {
            if (m_sessionEdit->text().isEmpty() || m_sessionEdit->text() == s_lastSession) {
                m_sessionEdit->setText(session);
            }
            if (m_programEdit->text().isEmpty() || m_programEdit->text() == s_lastProgram) {
                m_programEdit->setText(program);
            }
        }
    } else {
        if (m_currentRole == "Student") {
            m_uidWarningLabel->setText("⚠️ Non-standard student ID format (expected e.g. ULM-FA23-BCS-042). Allowed.");
            m_uidWarningLabel->setStyleSheet("color: #FBBF24; font-size: 11px;");
            m_uidWarningLabel->setVisible(true);
        } else {
            m_uidWarningLabel->setVisible(false);
        }
    }
}

void BorrowerDialog::onOpenExistingDuplicate() {
    if (m_duplicateExistingId > 0) {
        emit openExistingRequested(m_duplicateExistingId);
        reject();
    }
}

void BorrowerDialog::onBrowsePhoto() {
    QString file = QFileDialog::getOpenFileName(
        this,
        "Select Member Photograph",
        "",
        "Images (*.png *.jpg *.jpeg *.bmp *.webp);;All Files (*.*)"
    );
    if (!file.isEmpty()) {
        m_selectedPhotoSourcePath = file;
        QPixmap pix(file);
        m_photoPreview->setPixmap(pix.scaled(72, 72, Qt::KeepAspectRatio, Qt::SmoothTransformation));
        m_btnClearPhoto->setEnabled(true);
    }
}

void BorrowerDialog::onClearPhoto() {
    m_selectedPhotoSourcePath.clear();
    m_savedPhotoRelativePath.clear();
    m_photoPreview->clear();
    m_photoPreview->setText("No Photo");
    m_btnClearPhoto->setEnabled(false);
}

void BorrowerDialog::onSameAsAbove(const QString &fieldName) {
    if (fieldName == "department") {
        m_deptCombo->setCurrentText(s_lastDepartment);
    }
}

bool BorrowerDialog::collectAndValidate(Borrower &outBorrower) {
    QString uid = m_uidEdit->text().trimmed();
    QString name = m_nameEdit->text().trimmed();
    QString phone = m_phoneEdit->text().trimmed();

    if (uid.isEmpty()) {
        QMessageBox::warning(this, "Missing Field", "University ID is required.");
        m_uidEdit->setFocus();
        return false;
    }

    if (name.isEmpty()) {
        QMessageBox::warning(this, "Missing Field", "Full Name is required.");
        m_nameEdit->setFocus();
        return false;
    }

    // Check duplicate ID
    QString existingName;
    int existingId = 0;
    if (DatabaseManager::instance().hasDuplicateUniversityId(uid, m_isEdit ? m_editId : 0, existingName, existingId)) {
        QMessageBox::critical(this, "Duplicate ID",
            QString("University ID '%1' is already assigned to '%2'.").arg(uid).arg(existingName));
        return false;
    }

    // Check duplicate Name + Phone warning
    auto samePerson = DatabaseManager::instance().getBorrowerByNameAndPhone(name, phone, m_isEdit ? m_editId : 0);
    if (samePerson) {
        auto reply = QMessageBox::warning(
            this,
            "Possible Duplicate Person",
            QString("A borrower with identical name '%1' and phone '%2' is already registered (ID: %3).\n\n"
                    "Do you wish to proceed anyway?").arg(name).arg(phone).arg(samePerson->university_id),
            QMessageBox::Yes | QMessageBox::No,
            QMessageBox::No
        );
        if (reply == QMessageBox::No) {
            return false;
        }
    }

    outBorrower.id = m_isEdit ? m_editId : 0;
    outBorrower.role = m_currentRole;
    outBorrower.university_id = uid;
    outBorrower.barcode = uid;
    outBorrower.name = name;
    outBorrower.department = m_deptCombo->currentText().trimmed();
    outBorrower.phone = Borrower::normalizePhone(phone);
    outBorrower.email = m_emailEdit->text().trimmed();
    outBorrower.address = m_addressEdit->text().trimmed();
    outBorrower.joined_date = m_joinedDateEdit->date().toString(Qt::ISODate);
    outBorrower.valid_until = m_validUntilEdit->date().toString(Qt::ISODate);
    outBorrower.borrow_limit = m_limitSpin->value();
    outBorrower.status = m_statusCombo->currentText();
    outBorrower.notes = m_notesEdit->toPlainText().trimmed();

    if (m_currentRole == "Student") {
        outBorrower.father_name = m_fatherNameEdit->text().trimmed();
        outBorrower.program = m_programEdit->text().trimmed();
        outBorrower.session = m_sessionEdit->text().trimmed();
        outBorrower.semester = m_semesterSpin->value();
    } else {
        outBorrower.designation = m_designationCombo->currentText().trimmed();
    }

    // Save photo if selected
    if (!m_selectedPhotoSourcePath.isEmpty()) {
        QString savedPath = DatabaseManager::instance().saveBorrowerPhoto(m_selectedPhotoSourcePath, uid);
        outBorrower.photo_path = savedPath;
    } else {
        outBorrower.photo_path = m_savedPhotoRelativePath;
    }

    // Update static memory for fast entry
    s_lastRole = outBorrower.role;
    s_lastDepartment = outBorrower.department;
    s_lastProgram = outBorrower.program;
    s_lastSession = outBorrower.session;
    s_lastSemester = outBorrower.semester;
    s_lastValidUntil = outBorrower.valid_until;
    s_lastBorrowLimit = outBorrower.borrow_limit;

    return true;
}

void BorrowerDialog::onSaveAndClose() {
    Borrower b;
    if (!collectAndValidate(b)) return;

    bool ok = m_isEdit 
        ? DatabaseManager::instance().updateBorrower(b)
        : DatabaseManager::instance().addBorrower(b);

    if (ok) {
        clearDraft();
        m_saved = true;
        m_borrower = b;
        emit borrowerSaved(b);
        accept();
    } else {
        QMessageBox::critical(this, "Save Error", "Failed to persist borrower record to SQLite database.");
    }
}

void BorrowerDialog::onSaveAndNext() {
    Borrower b;
    if (!collectAndValidate(b)) return;

    bool ok = DatabaseManager::instance().addBorrower(b);
    if (ok) {
        clearDraft();
        emit borrowerSaved(b);

        // Reset for Next Person, carrying forward repeat values
        m_uidEdit->clear();
        m_nameEdit->clear();
        m_phoneEdit->clear();
        m_emailEdit->clear();
        m_addressEdit->clear();
        m_fatherNameEdit->clear();
        m_notesEdit->clear();
        onClearPhoto();

        // Carry forward
        m_deptCombo->setCurrentText(s_lastDepartment);
        m_programEdit->setText(s_lastProgram);
        m_sessionEdit->setText(s_lastSession);
        m_semesterSpin->setValue(s_lastSemester);
        m_limitSpin->setValue(s_lastBorrowLimit);

        m_uidEdit->setFocus();
    } else {
        QMessageBox::critical(this, "Save Error", "Failed to persist borrower record to SQLite database.");
    }
}

void BorrowerDialog::loadDraft() {
    QSettings s("ULM", "LibraryManagementSystem");
    s.beginGroup("BorrowerDraft");
    QString draftUid = s.value("uid").toString();
    if (!draftUid.isEmpty()) {
        m_uidEdit->setText(draftUid);
        m_nameEdit->setText(s.value("name").toString());
        onRoleChanged(s.value("role", "Student").toString());
        m_deptCombo->setCurrentText(s.value("department", s_lastDepartment).toString());
        m_phoneEdit->setText(s.value("phone").toString());
        m_emailEdit->setText(s.value("email").toString());
        m_addressEdit->setText(s.value("address").toString());
        m_fatherNameEdit->setText(s.value("father_name").toString());
        m_programEdit->setText(s.value("program", s_lastProgram).toString());
        m_sessionEdit->setText(s.value("session", s_lastSession).toString());
        m_semesterSpin->setValue(s.value("semester", s_lastSemester).toInt());
        m_designationCombo->setCurrentText(s.value("designation").toString());
        m_notesEdit->setPlainText(s.value("notes").toString());
    } else {
        m_deptCombo->setCurrentText(s_lastDepartment);
        m_programEdit->setText(s_lastProgram);
        m_sessionEdit->setText(s_lastSession);
        m_semesterSpin->setValue(s_lastSemester);
        m_limitSpin->setValue(s_lastBorrowLimit);
    }
    s.endGroup();
}

void BorrowerDialog::saveDraft() {
    if (m_isEdit || m_saved) return;
    if (m_nameEdit->text().trimmed().isEmpty() && m_uidEdit->text().trimmed().isEmpty()) return;

    QSettings s("ULM", "LibraryManagementSystem");
    s.beginGroup("BorrowerDraft");
    s.setValue("uid", m_uidEdit->text());
    s.setValue("name", m_nameEdit->text());
    s.setValue("role", m_currentRole);
    s.setValue("department", m_deptCombo->currentText());
    s.setValue("phone", m_phoneEdit->text());
    s.setValue("email", m_emailEdit->text());
    s.setValue("address", m_addressEdit->text());
    s.setValue("father_name", m_fatherNameEdit->text());
    s.setValue("program", m_programEdit->text());
    s.setValue("session", m_sessionEdit->text());
    s.setValue("semester", m_semesterSpin->value());
    s.setValue("designation", m_designationCombo->currentText());
    s.setValue("notes", m_notesEdit->toPlainText());
    s.endGroup();
}

void BorrowerDialog::clearDraft() {
    QSettings s("ULM", "LibraryManagementSystem");
    s.remove("BorrowerDraft");
}

void BorrowerDialog::closeEvent(QCloseEvent *event) {
    saveDraft();
    event->accept();
}

void BorrowerDialog::keyPressEvent(QKeyEvent *event) {
    if (event->key() == Qt::Key_Return || event->key() == Qt::Key_Enter) {
        if (!m_notesEdit->hasFocus()) {
            if (m_btnSaveAndNext->isVisible() && m_btnSaveAndNext->isEnabled()) {
                onSaveAndNext();
                return;
            } else if (m_btnSaveAndClose->isEnabled()) {
                onSaveAndClose();
                return;
            }
        }
    }
    QDialog::keyPressEvent(event);
}
