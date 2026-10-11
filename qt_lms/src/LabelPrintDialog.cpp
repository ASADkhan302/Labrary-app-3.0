#include "LabelPrintDialog.h"
#include "Code128Barcode.h"
#include "DatabaseManager.h"
#include "AudioFeedback.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFormLayout>
#include <QPrintDialog>
#include <QPainter>
#include <QPainterPath>
#include <QPixmap>
#include <QMessageBox>
#include <QFontDatabase>

LabelPrintDialog::LabelPrintDialog(QWidget *parent, int defaultAccNo)
    : QDialog(parent)
{
    setWindowTitle("Batch Accession Code-128 Label Printer - ULM LMS");
    setMinimumSize(680, 560);
    setupUi();

    if (defaultAccNo > 0) {
        m_startAccSpin->setValue(defaultAccNo);
        m_endAccSpin->setValue(defaultAccNo);
    } else {
        auto nextAcc = DatabaseManager::instance().getNextAccessionNumber() - 1;
        m_startAccSpin->setValue(qMax(10001, nextAcc));
        m_endAccSpin->setValue(qMax(10001, nextAcc));
    }
    updatePreview();
}

void LabelPrintDialog::setupUi() {
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(24, 24, 24, 24);
    mainLayout->setSpacing(16);

    auto *headerLabel = new QLabel("<h2>Print Physical Spine / Barcode Labels (2.5\" × 1.5\")</h2>", this);
    headerLabel->setStyleSheet("color: #F1F5F9;");
    mainLayout->addWidget(headerLabel);

    auto *descLabel = new QLabel(
        "Standard university specification: 63.5 × 38.1 mm adhesive labels, zero printer margins, "
        "pure black-on-white high contrast, vector ULM crest, Code-128 Subset B barcode with 10-module quiet zone, "
        "Dewey call number, shelf coordinates, and official property footer.",
        this
    );
    descLabel->setStyleSheet("color: #A8B5C8;");
    descLabel->setWordWrap(true);
    mainLayout->addWidget(descLabel);

    // Range Selection
    auto *rangeBox = new QHBoxLayout();
    rangeBox->addWidget(new QLabel("Start Accession #:", this));
    m_startAccSpin = new QSpinBox(this);
    m_startAccSpin->setRange(1, 999999);
    connect(m_startAccSpin, QOverload<int>::of(&QSpinBox::valueChanged), this, &LabelPrintDialog::onPreviewRangeChanged);
    rangeBox->addWidget(m_startAccSpin);

    rangeBox->addWidget(new QLabel("End Accession #:", this));
    m_endAccSpin = new QSpinBox(this);
    m_endAccSpin->setRange(1, 999999);
    connect(m_endAccSpin, QOverload<int>::of(&QSpinBox::valueChanged), this, &LabelPrintDialog::onPreviewRangeChanged);
    rangeBox->addWidget(m_endAccSpin);

    m_countLabel = new QLabel(this);
    m_countLabel->setStyleSheet("color: #F59E0B; font-weight: bold; margin-left: 10px;");
    rangeBox->addWidget(m_countLabel, 1);

    mainLayout->addLayout(rangeBox);

    // Live Visual Preview Frame (2.5in x 1.5in scaled up for crisp display)
    auto *prevContainer = new QVBoxLayout();
    auto *prevTitle = new QLabel("<b>High-Fidelity Thermal / Laser Label Preview:</b>", this);
    prevTitle->setStyleSheet("color: #F1F5F9;");
    prevContainer->addWidget(prevTitle);

    m_previewArea = new QLabel(this);
    m_previewArea->setAlignment(Qt::AlignCenter);
    m_previewArea->setMinimumSize(420, 252);
    m_previewArea->setStyleSheet("background-color: #0F172A; border: 1px solid #334155; border-radius: 8px; padding: 12px;");
    prevContainer->addWidget(m_previewArea, 1);

    mainLayout->addLayout(prevContainer);

    // Buttons
    auto *btnRow = new QHBoxLayout();
    btnRow->addStretch(1);

    m_btnCancel = new QPushButton("Close", this);
    m_btnCancel->setObjectName("btnSecondary");
    connect(m_btnCancel, &QPushButton::clicked, this, &QDialog::reject);
    btnRow->addWidget(m_btnCancel);

    m_btnPrint = new QPushButton("🖨 Print Labels to QPrinter...", this);
    m_btnPrint->setObjectName("btnPrimary");
    m_btnPrint->setMinimumHeight(40);
    connect(m_btnPrint, &QPushButton::clicked, this, &LabelPrintDialog::onPrintClicked);
    btnRow->addWidget(m_btnPrint);

    mainLayout->addLayout(btnRow);
}

void LabelPrintDialog::onPreviewRangeChanged() {
    updatePreview();
}

void LabelPrintDialog::updatePreview() {
    int startAcc = m_startAccSpin->value();
    int endAcc = m_endAccSpin->value();
    if (endAcc < startAcc) endAcc = startAcc;

    m_booksToPrint.clear();
    auto &db = DatabaseManager::instance();

    for (int acc = startAcc; acc <= endAcc; ++acc) {
        auto bOpt = db.getBookByAccessionNo(acc);
        if (bOpt) {
            m_booksToPrint.append(*bOpt);
        }
    }

    m_countLabel->setText(QString("Found %1 valid registered copies in range").arg(m_booksToPrint.size()));
    m_btnPrint->setEnabled(!m_booksToPrint.isEmpty());

    if (m_booksToPrint.isEmpty()) {
        m_previewArea->setText("No book copies found for selected accession range.");
        return;
    }

    // Render Preview Pixmap (2.5in x 1.5in @ 200 DPI = 500 x 300 px)
    QPixmap pixmap(500, 300);
    pixmap.fill(Qt::white);

    QPainter painter(&pixmap);
    painter.setRenderHint(QPainter::Antialiasing, true);
    painter.setRenderHint(QPainter::TextAntialiasing, true);

    drawLabel(&painter, QRectF(0, 0, 500, 300), m_booksToPrint[0]);
    painter.end();

    m_previewArea->setPixmap(pixmap.scaled(420, 252, Qt::KeepAspectRatio, Qt::SmoothTransformation));
}

void LabelPrintDialog::drawLabel(QPainter *painter, const QRectF &rect, const Book &book) {
    painter->save();

    // 1. Pure White Background & Crisp Black Boundary
    painter->fillRect(rect, Qt::white);
    painter->setPen(QPen(Qt::black, 1.5));
    painter->drawRect(rect.adjusted(2, 2, -2, -2));

    double w = rect.width();
    double h = rect.height();

    // 2. Header: Vector Crest and University Name
    // Draw vector crest (Academic Shield)
    painter->setPen(QPen(Qt::black, 1.5));
    painter->setBrush(Qt::NoBrush);

    double crestX = 14.0;
    double crestY = 12.0;
    double crestW = 20.0;
    double crestH = 24.0;

    QPainterPath shield;
    shield.moveTo(crestX, crestY);
    shield.lineTo(crestX + crestW, crestY);
    shield.lineTo(crestX + crestW, crestY + crestH * 0.6);
    shield.quadTo(crestX + crestW * 0.5, crestY + crestH, crestX + crestW * 0.5, crestY + crestH);
    shield.quadTo(crestX, crestY + crestH * 0.6, crestX, crestY + crestH * 0.6);
    shield.closeSubpath();
    painter->drawPath(shield);

    // Open book lines inside shield
    painter->drawLine(QPointF(crestX + 4, crestY + 12), QPointF(crestX + 10, crestY + 15));
    painter->drawLine(QPointF(crestX + 10, crestY + 15), QPointF(crestX + 16, crestY + 12));

    // Institution Title
    painter->setFont(QFont("Cinzel", 11, QFont::Bold));
    QRectF titleBox(40.0, 10.0, w - 50.0, 16.0);
    painter->drawText(titleBox, Qt::AlignLeft | Qt::AlignVCenter, "UNIVERSITY OF LAKKI MARWAT");

    painter->setFont(QFont("Plus Jakarta Sans", 8, QFont::DemiBold));
    QRectF subTitleBox(40.0, 26.0, w - 50.0, 14.0);
    painter->drawText(subTitleBox, Qt::AlignLeft | Qt::AlignVCenter, "CENTRAL CAMPUS LIBRARY · ACCESSION REGISTRY");

    // Divider Line
    painter->drawLine(QPointF(10.0, 42.0), QPointF(w - 10.0, 42.0));

    // 3. Center Info: Title, Call Number, Shelf
    painter->setFont(QFont("Plus Jakarta Sans", 10, QFont::Bold));
    QRectF bookTitleRect(12.0, 46.0, w - 24.0, 20.0);
    QFontMetrics fm(painter->font());
    QString elidedTitle = fm.elidedText(book.title, Qt::ElideRight, static_cast<int>(bookTitleRect.width()));
    painter->drawText(bookTitleRect, Qt::AlignLeft | Qt::AlignVCenter, elidedTitle);

    painter->setFont(QFont("JetBrains Mono", 9, QFont::Bold));
    QString callAndShelf = QString("CALL: %1  |  SHELF: %2")
                               .arg(book.dewey_call_number.isEmpty() ? "GENERAL" : book.dewey_call_number)
                               .arg(book.shelf.isEmpty() ? "UNASSIGNED" : book.shelf);
    QRectF callRect(12.0, 68.0, w - 24.0, 16.0);
    painter->drawText(callRect, Qt::AlignLeft | Qt::AlignVCenter, callAndShelf);

    // 4. Code-128 Barcode with 10-module Quiet Zone
    QRectF barcodeRect(12.0, 92.0, w - 24.0, h - 134.0);
    Code128Barcode::drawBarcode(painter, barcodeRect, book.barcode);

    // 5. Footer: Mandatory Property String
    painter->setFont(QFont("Plus Jakarta Sans", 8, QFont::Bold));
    QRectF footerRect(10.0, h - 22.0, w - 20.0, 16.0);
    painter->drawText(footerRect, Qt::AlignCenter, "CENTRAL CAMPUS LIBRARY - PROPERTY OF ULM");

    painter->restore();
}

void LabelPrintDialog::onPrintClicked() {
    if (m_booksToPrint.isEmpty()) return;

    QPrinter printer(QPrinter::HighResolution);
    // 2.5 in x 1.5 in = 63.5 x 38.1 mm
    printer.setPageSize(QPageSize(QSizeF(63.5, 38.1), QPageSize::Millimeter));
    printer.setPageMargins(QMarginsF(0, 0, 0, 0), QPageLayout::Millimeter);
    printer.setFullPage(true);

    QPrintDialog printDialog(&printer, this);
    printDialog.setWindowTitle("Print ULM Accession Labels");
    if (printDialog.exec() != QDialog::Accepted) return;

    QPainter painter(&printer);
    painter.setRenderHint(QPainter::Antialiasing, true);
    painter.setRenderHint(QPainter::TextAntialiasing, true);

    QRectF pageRect = printer.pageLayout().paintRectPixels(printer.resolution());

    for (int i = 0; i < m_booksToPrint.size(); ++i) {
        if (i > 0) {
            printer.newPage();
        }
        drawLabel(&painter, pageRect, m_booksToPrint[i]);
    }

    painter.end();
    AudioFeedback::instance().playSuccessBeep();
    QMessageBox::information(this, "Printing Completed",
                             QString("Successfully sent %1 accession labels to printer.")
                             .arg(m_booksToPrint.size()));
    accept();
}
