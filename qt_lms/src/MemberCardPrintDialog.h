#pragma once

#include <QDialog>
#include <QPushButton>
#include <QLabel>
#include <QPrinter>
#include "Models.h"

class MemberCardPrintDialog : public QDialog {
    Q_OBJECT
public:
    explicit MemberCardPrintDialog(QWidget *parent = nullptr, const Borrower &borrower = Borrower());
    ~MemberCardPrintDialog() = default;

private slots:
    void onPrintCard();

private:
    void setupUi();
    void drawCard(QPainter *painter, const QRectF &rect, const Borrower &borrower);

    Borrower m_borrower;
    QLabel *m_previewLabel = nullptr;
    QPushButton *m_btnPrint = nullptr;
    QPushButton *m_btnClose = nullptr;
};
