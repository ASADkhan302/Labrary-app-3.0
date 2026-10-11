#include "Code128Barcode.h"
#include <QFont>
#include <cmath>

// Code 128 patterns: each symbol has 3 bars and 3 spaces (total width 11 modules).
// Stop symbol has 4 bars and 3 spaces (total width 13 modules).
const int Code128Barcode::CODE128_PATTERNS[107][6] = {
    {2, 1, 2, 2, 2, 2}, // 0: ' ' (Space)
    {2, 2, 2, 1, 2, 2}, // 1: '!'
    {2, 2, 2, 2, 2, 1}, // 2: '"'
    {1, 2, 1, 2, 2, 3}, // 3: '#'
    {1, 2, 1, 3, 2, 2}, // 4: '$'
    {1, 3, 1, 2, 2, 2}, // 5: '%'
    {1, 2, 2, 2, 1, 3}, // 6: '&'
    {1, 2, 2, 3, 1, 2}, // 7: '\''
    {1, 3, 2, 2, 1, 2}, // 8: '('
    {2, 2, 1, 2, 1, 3}, // 9: ')'
    {2, 2, 1, 3, 1, 2}, // 10: '*'
    {2, 3, 1, 2, 1, 2}, // 11: '+'
    {1, 1, 2, 2, 3, 2}, // 12: ','
    {1, 2, 2, 1, 3, 2}, // 13: '-'
    {1, 2, 2, 2, 3, 1}, // 14: '.'
    {1, 1, 3, 2, 2, 2}, // 15: '/'
    {1, 2, 3, 1, 2, 2}, // 16: '0'
    {1, 2, 3, 2, 2, 1}, // 17: '1'
    {2, 2, 3, 2, 1, 1}, // 18: '2'
    {2, 2, 1, 1, 3, 2}, // 19: '3'
    {2, 2, 1, 2, 3, 1}, // 20: '4'
    {2, 1, 3, 2, 1, 2}, // 21: '5'
    {2, 2, 3, 1, 1, 2}, // 22: '6'
    {3, 1, 2, 1, 3, 1}, // 23: '7'
    {3, 1, 1, 2, 2, 2}, // 24: '8'
    {3, 2, 1, 1, 2, 2}, // 25: '9'
    {3, 2, 1, 2, 2, 1}, // 26: ':'
    {3, 1, 2, 2, 1, 2}, // 27: ';'
    {3, 2, 2, 1, 1, 2}, // 28: '<'
    {3, 2, 2, 2, 1, 1}, // 29: '='
    {2, 1, 2, 1, 2, 3}, // 30: '>'
    {2, 1, 2, 3, 2, 1}, // 31: '?'
    {2, 3, 2, 1, 2, 1}, // 32: '@'
    {1, 1, 1, 3, 2, 3}, // 33: 'A'
    {1, 3, 1, 1, 2, 3}, // 34: 'B'
    {1, 3, 1, 3, 2, 1}, // 35: 'C'
    {1, 1, 2, 3, 1, 3}, // 36: 'D'
    {1, 3, 2, 1, 1, 3}, // 37: 'E'
    {1, 3, 2, 3, 1, 1}, // 38: 'F'
    {2, 1, 1, 3, 1, 3}, // 39: 'G'
    {2, 3, 1, 1, 1, 3}, // 40: 'H'
    {2, 3, 1, 3, 1, 1}, // 41: 'I'
    {1, 1, 2, 1, 3, 3}, // 42: 'J'
    {1, 1, 2, 3, 3, 1}, // 43: 'K'
    {1, 3, 2, 1, 3, 1}, // 44: 'L'
    {1, 1, 3, 1, 2, 3}, // 45: 'M'
    {1, 1, 3, 3, 2, 1}, // 46: 'N'
    {1, 3, 3, 1, 2, 1}, // 47: 'O'
    {3, 1, 3, 1, 2, 1}, // 48: 'P'
    {2, 1, 1, 3, 3, 1}, // 49: 'Q'
    {2, 3, 1, 1, 3, 1}, // 50: 'R'
    {2, 1, 3, 1, 1, 3}, // 51: 'S'
    {2, 1, 3, 3, 1, 1}, // 52: 'T'
    {2, 1, 3, 1, 3, 1}, // 53: 'U'
    {3, 1, 1, 1, 2, 3}, // 54: 'V'
    {3, 1, 1, 3, 2, 1}, // 55: 'W'
    {3, 3, 1, 1, 2, 1}, // 56: 'X'
    {3, 1, 2, 1, 1, 3}, // 57: 'Y'
    {3, 1, 2, 3, 1, 1}, // 58: 'Z'
    {3, 3, 2, 1, 1, 1}, // 59: '['
    {3, 1, 4, 1, 1, 1}, // 60: '\\'
    {2, 2, 1, 4, 1, 1}, // 61: ']'
    {4, 3, 1, 1, 1, 1}, // 62: '^'
    {1, 1, 1, 2, 2, 4}, // 63: '_'
    {1, 1, 1, 4, 2, 2}, // 64: '`'
    {1, 2, 1, 1, 2, 4}, // 65: 'a'
    {1, 2, 1, 4, 2, 1}, // 66: 'b'
    {1, 4, 1, 1, 2, 2}, // 67: 'c'
    {1, 4, 1, 2, 2, 1}, // 68: 'd'
    {1, 1, 2, 2, 1, 4}, // 69: 'e'
    {1, 1, 2, 4, 1, 2}, // 70: 'f'
    {1, 2, 2, 1, 1, 4}, // 71: 'g'
    {1, 2, 2, 4, 1, 1}, // 72: 'h'
    {1, 4, 2, 1, 1, 2}, // 73: 'i'
    {1, 4, 2, 2, 1, 1}, // 74: 'j'
    {2, 4, 1, 2, 1, 1}, // 75: 'k'
    {2, 2, 1, 1, 1, 4}, // 76: 'l'
    {4, 1, 3, 1, 1, 1}, // 77: 'm'
    {2, 4, 1, 1, 1, 2}, // 78: 'n'
    {1, 3, 4, 1, 1, 1}, // 79: 'o'
    {1, 1, 1, 2, 4, 2}, // 80: 'p'
    {1, 2, 1, 1, 4, 2}, // 81: 'q'
    {1, 2, 1, 2, 4, 1}, // 82: 'r'
    {1, 1, 4, 2, 1, 2}, // 83: 's'
    {1, 2, 4, 1, 1, 2}, // 84: 't'
    {1, 2, 4, 2, 1, 1}, // 85: 'u'
    {4, 1, 1, 2, 1, 2}, // 86: 'v'
    {4, 2, 1, 1, 1, 2}, // 87: 'w'
    {4, 2, 1, 2, 1, 1}, // 88: 'x'
    {2, 1, 2, 1, 4, 1}, // 89: 'y'
    {2, 1, 4, 1, 2, 1}, // 90: 'z'
    {4, 1, 2, 1, 2, 1}, // 91: '{'
    {1, 1, 1, 1, 4, 3}, // 92: '|'
    {1, 1, 1, 3, 4, 1}, // 93: '}'
    {1, 3, 1, 1, 4, 1}, // 94: '~'
    {1, 1, 4, 1, 1, 3}, // 95: DEL
    {1, 1, 4, 3, 1, 1}, // 96: FNC3
    {4, 1, 1, 1, 1, 3}, // 97: FNC2
    {4, 1, 1, 3, 1, 1}, // 98: SHIFT
    {1, 1, 3, 1, 4, 1}, // 99: CODE C
    {1, 1, 4, 1, 3, 1}, // 100: CODE B
    {3, 1, 1, 1, 4, 1}, // 101: FNC4
    {4, 1, 1, 1, 3, 1}, // 102: FNC1
    {2, 1, 1, 4, 1, 2}, // 103: START A
    {2, 1, 1, 2, 1, 4}, // 104: START B
    {2, 1, 1, 2, 3, 2}, // 105: START C
    {2, 3, 3, 1, 1, 1}  // 106: STOP (Plus a trailing bar of width 2)
};

int Code128Barcode::calculateChecksum(const QVector<int> &codeValues) {
    if (codeValues.isEmpty()) return 0;
    qint64 sum = codeValues[0]; // Start character has weight 1
    for (int i = 1; i < codeValues.size(); ++i) {
        sum += static_cast<qint64>(codeValues[i]) * i;
    }
    return static_cast<int>(sum % 103);
}

bool Code128Barcode::encodeSubsetB(const QString &text, QVector<int> &outModules) {
    outModules.clear();
    QVector<int> values;

    // Start B is symbol 104
    values.append(104);

    for (QChar c : text) {
        int ascii = c.toLatin1();
        if (ascii < 32 || ascii > 126) {
            ascii = '?';
        }
        values.append(ascii - 32);
    }

    // Calculate modulo 103 checksum
    int checksum = calculateChecksum(values);
    values.append(checksum);

    // Stop character is symbol 106
    values.append(106);

    // 10-module quiet zone at start
    for (int i = 0; i < 10; ++i) outModules.append(0);

    // Convert symbols to binary modules (1 = bar, 0 = space)
    for (int val : values) {
        const int *pattern = CODE128_PATTERNS[val];
        for (int p = 0; p < 6; ++p) {
            int width = pattern[p];
            int isBar = (p % 2 == 0) ? 1 : 0;
            for (int w = 0; w < width; ++w) {
                outModules.append(isBar);
            }
        }
    }

    // Trailing bar of 2 modules for STOP symbol
    outModules.append(1);
    outModules.append(1);

    // 10-module quiet zone at end
    for (int i = 0; i < 10; ++i) outModules.append(0);

    return true;
}

void Code128Barcode::drawBarcode(QPainter *painter, const QRectF &targetRect, const QString &text) {
    QVector<int> modules;
    if (!encodeSubsetB(text, modules) || modules.isEmpty()) return;

    painter->save();
    painter->setPen(Qt::NoPen);
    painter->setBrush(Qt::black);

    // Calculate module width to fit within targetRect
    double moduleWidth = std::floor(targetRect.width() / modules.size());
    if (moduleWidth < 1.0) moduleWidth = 1.0;

    double totalBarcodeWidth = moduleWidth * modules.size();
    double startX = targetRect.left() + (targetRect.width() - totalBarcodeWidth) / 2.0;
    double barHeight = targetRect.height() - 14.0; // Reserve bottom for text

    // Draw bars
    for (int i = 0; i < modules.size(); ++i) {
        if (modules[i] == 1) {
            QRectF barRect(startX + (i * moduleWidth), targetRect.top(), moduleWidth, barHeight);
            painter->drawRect(barRect);
        }
    }

    // Draw Human-Readable Text Centered Below Bars
    painter->setPen(Qt::black);
    QFont monoFont("JetBrains Mono", 9, QFont::Bold);
    painter->setFont(monoFont);

    QRectF textRect(targetRect.left(), targetRect.top() + barHeight + 1.0, targetRect.width(), 13.0);
    painter->drawText(textRect, Qt::AlignCenter, text);

    painter->restore();
}
