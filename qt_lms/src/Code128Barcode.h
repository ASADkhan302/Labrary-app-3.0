#pragma once

#include <QString>
#include <QVector>
#include <QPainter>
#include <QRectF>

class Code128Barcode {
public:
    // Subset B encoding table
    static bool encodeSubsetB(const QString &text, QVector<int> &outModules);
    static int calculateChecksum(const QVector<int> &codeValues);
    
    // Draw directly to QPainter with exact integer module width and 10-module quiet zone
    static void drawBarcode(QPainter *painter, const QRectF &targetRect, const QString &text);

private:
    static const int CODE128_PATTERNS[107][6];
};
