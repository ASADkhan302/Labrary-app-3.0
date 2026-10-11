#pragma once

#include <QDialog>
#include <QLineEdit>
#include <QComboBox>
#include <QSpinBox>
#include <QDateEdit>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QLabel>
#include <QButtonGroup>
#include <QFrame>
#include <QCompleter>
#include "Models.h"

class BorrowerDialog : public QDialog {
    Q_OBJECT
public:
    explicit BorrowerDialog(QWidget *parent = nullptr, const Borrower *borrowerToEdit = nullptr);
    ~BorrowerDialog();

    Borrower getBorrower() const { return m_borrower; }
    bool isSaved() const { return m_saved; }

signals:
    void borrowerSaved(const Borrower &borrower);
    void openExistingRequested(int existingBorrowerId);

protected:
    void closeEvent(QCloseEvent *event) override;
    void keyPressEvent(QKeyEvent *event) override;

private slots:
    void onRoleChanged(const QString &role);
    void onUniversityIdEdited(const QString &text);
    void onBrowsePhoto();
    void onClearPhoto();
    void onSameAsAbove(const QString &fieldName);
    void onSaveAndClose();
    void onSaveAndNext();
    void onOpenExistingDuplicate();

private:
    void setupUi();
    void setupDepartmentCompleter();
    void updateRoleFieldsVisibility();
    void loadDraft();
    void saveDraft();
    void clearDraft();
    bool collectAndValidate(Borrower &outBorrower);
    void applyTheme();

    bool m_isEdit = false;
    int m_editId = 0;
    bool m_saved = false;
    Borrower m_borrower;
    QString m_selectedPhotoSourcePath;
    QString m_savedPhotoRelativePath;
    int m_duplicateExistingId = 0;

    // Static memory for Fast Entry ("Save & Next" / "Same as above")
    static QString s_lastRole;
    static QString s_lastDepartment;
    static QString s_lastProgram;
    static QString s_lastSession;
    static int s_lastSemester;
    static QString s_lastValidUntil;
    static int s_lastBorrowLimit;

    // Top Segmented Role Selector
    QButtonGroup *m_roleGroup = nullptr;
    QPushButton *m_btnRoleStudent = nullptr;
    QPushButton *m_btnRoleFaculty = nullptr;
    QPushButton *m_btnRoleStaff = nullptr;
    QString m_currentRole = "Student";

    // Common Fields
    QLineEdit *m_uidEdit = nullptr;
    QLabel *m_uidWarningLabel = nullptr;
    QFrame *m_duplicateBanner = nullptr;
    QLabel *m_duplicateLabel = nullptr;
    QPushButton *m_btnOpenDuplicate = nullptr;

    QLineEdit *m_nameEdit = nullptr;
    QComboBox *m_deptCombo = nullptr;
    QLineEdit *m_phoneEdit = nullptr;
    QLineEdit *m_emailEdit = nullptr;
    QLineEdit *m_addressEdit = nullptr;
    
    // Photo Row
    QLabel *m_photoPreview = nullptr;
    QPushButton *m_btnBrowsePhoto = nullptr;
    QPushButton *m_btnClearPhoto = nullptr;

    QDateEdit *m_joinedDateEdit = nullptr;
    QDateEdit *m_validUntilEdit = nullptr;
    QSpinBox *m_limitSpin = nullptr;
    QComboBox *m_statusCombo = nullptr;
    QPlainTextEdit *m_notesEdit = nullptr;

    // Student Only Fields Container
    QFrame *m_studentFieldsFrame = nullptr;
    QLineEdit *m_fatherNameEdit = nullptr;
    QLineEdit *m_programEdit = nullptr;
    QLineEdit *m_sessionEdit = nullptr;
    QSpinBox *m_semesterSpin = nullptr;

    // Faculty/Staff Only Fields Container
    QFrame *m_facultyStaffFieldsFrame = nullptr;
    QComboBox *m_designationCombo = nullptr;

    // Action Buttons
    QPushButton *m_btnSaveAndNext = nullptr;
    QPushButton *m_btnSaveAndClose = nullptr;
    QPushButton *m_btnCancel = nullptr;
};
