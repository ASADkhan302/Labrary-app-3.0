#include "MemberCardPrintDialog.h"
#include "Code128Barcode.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QPainter>
#include <QPainterPath>
#include <QPrintDialog>
#include <QMessageBox>
#include <QFile>

MemberCardPrintDialog::MemberCardPrintDialog(QWidget *parent, const Borrower &borrower)
    : QDialog(parent)
    , m_borrower(borrower)
{
    setWindowTitle(QString("Library Member Card - %1 (%2)").arg(m_borrower.name).arg(m_borrower.university_id));
    setFixedSize(680, 520);
    setStyleSheet("QDialog { background-color: #020617; }");

    setupUi();
}

void MemberCardPrintDialog::setupUi() {
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(24, 20, 24, 20);
    mainLayout->setSpacing(16);

    auto *headerLabel = new QLabel("OFFICIAL ULM LIBRARY MEMBER CARD (CR80: 85.6 × 54 MM)", this);
    headerLabel->setFont(QFont("Cinzel", 13, QFont::Bold));
    headerLabel->setStyleSheet("color: #F59E0B;");
    mainLayout->addWidget(headerLabel);

    // CR80 Aspect Ratio (85.6 mm / 54 mm = 1.585)
    // 540 px width x 340 px height
    m_previewLabel = new QLabel(this);
    m_previewLabel->setFixedSize(540, 340);
    m_previewLabel->setStyleSheet("background-color: white; border: 2px solid #64748B; border-radius: 12px;");
    m_previewLabel->setAlignment(Qt::AlignCenter);

    QPixmap cardPix(540, 340);
    cardPix.fill(Qt::white);
    {
        QPainter p(&cardPix);
        p.setRenderHint(QPainter::Antialiasing);
        p.setRenderHint(QPainter::TextAntialiasing);
        drawCard(&p, QRectF(0, 0, 540, 340), m_borrower);
    }
    m_previewLabel->setPixmap(cardPix);
    mainLayout->addWidget(m_previewLabel, 0, Qt::AlignCenter);

    auto *buttonsLayout = new QHBoxLayout();
    buttonsLayout->addStretch(1);

    m_btnClose = new QPushButton("Close", this);
    m_btnClose->setCursor(Qt::PointingHandCursor);
    m_btnClose->setStyleSheet("QPushButton { background-color: #1E293B; color: #94A3B8; border: 1px solid #334155; border-radius: 6px; padding: 8px 18px; font-weight: 600; }");
    connect(m_btnClose, &QPushButton::clicked, this, &QDialog::accept);
    buttonsLayout->addWidget(m_btnClose);

    m_btnPrint = new QPushButton("Print Member Card (CR80)...", this);
    m_btnPrint->setCursor(Qt::PointingHandCursor);
    m_btnPrint->setStyleSheet("QPushButton { background-color: #F59E0B; color: #020617; border: 1px solid #D97706; border-radius: 6px; padding: 8px 22px; font-weight: bold; }");
    connect(m_btnPrint, &QPushButton::clicked, this, &MemberCardPrintDialog::onPrintCard);
    buttonsLayout->addWidget(m_btnPrint);

    mainLayout->addLayout(buttonsLayout);
}

void MemberCardPrintDialog::drawCard(QPainter *painter, const QRectF &rect, const Borrower &borrower) {
    painter->save();
    double w = rect.width();
    double h = rect.height();

    // 1. Card Background & Header Stripe
    painter->fillRect(rect, Qt::white);

    // Deep Navy Header Banner
    QRectF bannerRect(0, 0, w, 68);
    painter->fillRect(bannerRect, QColor("#0B1220"));

    // Amber border accent line under banner
    painter->setPen(QPen(QColor("#F59E0B"), 3));
    painter->drawLine(QPointF(0, 68), QPointF(w, 68));

    // Vector Crest in header
    {
        QPainterPath shield;
        shield.moveTo(28, 14);
        shield.lineTo(44, 20);
        shield.quadTo(45, 36, 28, 48);
        shield.quadTo(11, 36, 12, 20);
        shield.closeSubpath();
        painter->setPen(QPen(QColor("#F59E0B"), 1.8));
        painter->setBrush(QColor(245, 158, 11, 40));
        painter->drawPath(shield);
    }

    // Institution Name
    painter->setFont(QFont("Cinzel", 12, QFont::Bold));
    painter->setPen(Qt::white);
    painter->drawText(QRectF(54, 12, w - 60, 20), Qt::AlignLeft | Qt::AlignVCenter, "UNIVERSITY OF LAKKI MARWAT");

    painter->setFont(QFont("Plus Jakarta Sans", 8, QFont::DemiBold));
    painter->setPen(QColor("#94A3B8"));
    painter->drawText(QRectF(54, 34, w - 60, 16), Qt::AlignLeft | Qt::AlignVCenter, "CENTRAL CAMPUS LIBRARY · OFFICIAL MEMBER CARD");

    // Role Badge (Top right corner of banner)
    QString roleUpper = borrower.role.toUpper();
    QRectF badgeRect(w - 95, 20, 80, 24);
    QColor badgeBg = (borrower.role == "Faculty") ? QColor("#2563EB") : (borrower.role == "Staff") ? QColor("#0D9488") : QColor("#D97706");
    painter->setPen(Qt::NoPen);
    painter->setBrush(badgeBg);
    painter->drawRoundedRect(badgeRect, 4, 4);
    painter->setFont(QFont("Plus Jakarta Sans", 8, QFont::Bold));
    painter->setPen(Qt::white);
    painter->drawText(badgeRect, Qt::AlignCenter, roleUpper);

    // 2. Member Photograph (or avatar placeholder)
    QRectF photoRect(20, 84, 90, 110);
    painter->setPen(QPen(QColor("#CBD5E1"), 1.5));
    painter->setBrush(QColor("#F8FAFC"));
    painter->drawRoundedRect(photoRect, 6, 6);

    bool photoDrawn = false;
    if (!borrower.photo_path.isEmpty() && QFile::exists(borrower.photo_path)) {
        QPixmap photoPix(borrower.photo_path);
        if (!photoPix.isNull()) {
            painter->drawPixmap(photoRect.toRect(), photoPix.scaled(photoRect.size().toSize(), Qt::KeepAspectRatioByExpanding, Qt::SmoothTransformation));
            photoDrawn = true;
        }
    }
    if (!photoDrawn) {
        painter->setFont(QFont("Plus Jakarta Sans", 8));
        painter->setPen(QColor("#64748B"));
        painter->drawText(photoRect, Qt::AlignCenter, "PHOTO");
    }

    // 3. Member Information (Right of photo)
    double infoX = 124;
    painter->setFont(QFont("Plus Jakarta Sans", 13, QFont::Bold));
    painter->setPen(QColor("#0F172A"));
    painter->drawText(QRectF(infoX, 82, w - infoX - 20, 24), Qt::AlignLeft | Qt::AlignVCenter, borrower.name);

    painter->setFont(QFont("JetBrains Mono", 10, QFont::Bold));
    painter->setPen(QColor("#2563EB"));
    painter->drawText(QRectF(infoX, 108, w - infoX - 20, 18), Qt::AlignLeft | Qt::AlignVCenter, QString("ID: %1").arg(borrower.university_id));

    painter->setFont(QFont("Plus Jakarta Sans", 9, QFont::Normal));
    painter->setPen(QColor("#334155"));
    QString deptText = QString("Dept: %1").arg(borrower.department);
    painter->drawText(QRectF(infoX, 128, w - infoX - 20, 16), Qt::AlignLeft | Qt::AlignVCenter, deptText);

    if (borrower.role == "Student" && !borrower.program.isEmpty()) {
        QString progText = QString("Program: %1 (%2)").arg(borrower.program).arg(borrower.session);
        painter->drawText(QRectF(infoX, 146, w - infoX - 20, 16), Qt::AlignLeft | Qt::AlignVCenter, progText);
    } else if (!borrower.designation.isEmpty()) {
        QString desigText = QString("Designation: %1").arg(borrower.designation);
        painter->drawText(QRectF(infoX, 146, w - infoX - 20, 16), Qt::AlignLeft | Qt::AlignVCenter, desigText);
    }

    painter->setFont(QFont("Plus Jakarta Sans", 8));
    painter->setPen(QColor("#64748B"));
    QString validText = QString("Valid Until: %1   |   Limit: %2 Books")
        .arg(borrower.valid_until.isEmpty() ? "Permanent" : borrower.valid_until)
        .arg(borrower.borrow_limit);
    painter->drawText(QRectF(infoX, 166, w - infoX - 20, 16), Qt::AlignLeft | Qt::AlignVCenter, validText);

    // 4. Code-128 Barcode with 10-module Quiet Zone
    QRectF barcodeRect(20, 206, w - 40, 78);
    Code128Barcode::drawBarcode(painter, barcodeRect, borrower.university_id);

    // 5. Card Footer Strip
    QRectF footerRect(0, h - 30, w, 30);
    painter->fillRect(footerRect, QColor("#0B1220"));
    painter->setFont(QFont("Plus Jakarta Sans", 7.5, QFont::Bold));
    painter->setPen(QColor("#94A3B8"));
    painter->drawText(footerRect, Qt::AlignCenter, "PROPERTY OF UNIVERSITY OF LAKKI MARWAT · IF FOUND RETURN TO CENTRAL LIBRARY");

    // Outer card boundary
    painter->setPen(QPen(QColor("#334155"), 1.5));
    painter->setBrush(Qt::NoBrush);
    painter->drawRect(rect.adjusted(0.5, 0.5, -0.5, -0.5));

    painter->restore();
}

void MemberCardPrintDialog::onPrintCard() {
    QPrinter printer(QPrinter::HighResolution);
    printer.setDocName(QString("MemberCard_%1").arg(m_borrower.university_id));

    // Standard CR80 Card: 85.6 x 54 mm
    QPageSize cr80(QSizeF(85.6, 54.0), QPageSize::Millimeter, "CR80");
    printer.setPageSize(cr80);
    printer.setPageMargins(QMarginsF(0, 0, 0, 0));

    QPrintDialog printDialog(&printer, this);
    printDialog.setWindowTitle("Print Library Member Card (CR80)");
    if (printDialog.exec() != QDialog::Accepted) {
        return;
    }

    QPainter painter(&printer);
    QRectF pageRect = printer.pageLayout().paintRectPixels(printer.resolution());
    drawCard(&painter, pageRect, m_borrower);
    painter.end();

    QMessageBox::information(this, "Print Sent", "Library member card print job dispatched successfully.");
}
