#pragma once

#include <QDialog>
#include <QLineEdit>
#include <QSpinBox>
#include <QComboBox>
#include <QLabel>
#include <QPushButton>
#include <QCompleter>
#include <QCheckBox>
#include "Models.h"

class BookFormDialog : public QDialog {
    Q_OBJECT
public:
    explicit BookFormDialog(QWidget *parent = nullptr, int editBookId = 0);
    ~BookFormDialog();

    bool isSaved() const { return m_saved; }
    Book getBook() const { return m_book; }

signals:
    void bookSaved(const Book &book);

protected:
    void closeEvent(QCloseEvent *event) override;

private slots:
    void onSaveAndClose();
    void onSaveAndNext();
    void onSameAsAboveClicked(const QString &field);
    void validateIsbn();

private:
    void setupUi();
    void setupCompleters();
    void loadDraft();
    void saveDraft();
    void clearDraft();
    bool collectAndValidate(Book &book);
    bool checkDuplicateIsbn(const QString &isbn);

    int m_editBookId = 0;
    bool m_saved = false;
    Book m_book;

    // Last saved values for "Same as above" and "Save & Next"
    static QString s_lastAuthor;
    static QString s_lastPlace;
    static QString s_lastPublisher;
    static int s_lastYear;
    static QString s_lastBinding;
    static QString s_lastBindingCode;
    static QString s_lastSource;
    static QString s_lastCategory;
    static QString s_lastShelf;

    // Register Fields
    QSpinBox *m_accNoSpin = nullptr;
    QLineEdit *m_authorEdit = nullptr;
    QLineEdit *m_titleEdit = nullptr;
    QLineEdit *m_editionEdit = nullptr;
    QLineEdit *m_placeEdit = nullptr;
    QLineEdit *m_publisherEdit = nullptr;
    QSpinBox *m_yearSpin = nullptr;
    QLineEdit *m_pagesEdit = nullptr;
    QSpinBox *m_priceRsSpin = nullptr;
    QSpinBox *m_pricePsSpin = nullptr;
    QComboBox *m_bindingCombo = nullptr;
    QLineEdit *m_bindingCodeEdit = nullptr;
    QLineEdit *m_isbnEdit = nullptr;
    QLabel *m_isbnWarningLabel = nullptr;
    QLineEdit *m_sourceRemarksEdit = nullptr;

    // Optional Extras
    QComboBox *m_categoryCombo = nullptr;
    QLineEdit *m_callNumberEdit = nullptr;
    QLineEdit *m_shelfEdit = nullptr;

    QPushButton *m_btnSaveAndNext = nullptr;
    QPushButton *m_btnSaveAndClose = nullptr;
    QPushButton *m_btnCancel = nullptr;
};
