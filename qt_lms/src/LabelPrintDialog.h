#pragma once

#include <QDialog>
#include <QSpinBox>
#include <QPushButton>
#include <QLabel>
#include <QPrinter>
#include "Models.h"

class LabelPrintDialog : public QDialog {
    Q_OBJECT
public:
    explicit LabelPrintDialog(QWidget *parent = nullptr, int defaultAccNo = 0);
    ~LabelPrintDialog() = default;

    // Draw single 2.5 x 1.5 in label onto QPainter
    static void drawLabel(QPainter *painter, const QRectF &rectMm, const Book &book);

private slots:
    void onPreviewRangeChanged();
    void onPrintClicked();

private:
    void setupUi();
    void updatePreview();

    QSpinBox *m_startAccSpin = nullptr;
    QSpinBox *m_endAccSpin = nullptr;
    QLabel *m_countLabel = nullptr;
    QLabel *m_previewArea = nullptr;
    QPushButton *m_btnPrint = nullptr;
    QPushButton *m_btnCancel = nullptr;

    QVector<Book> m_booksToPrint;
};
