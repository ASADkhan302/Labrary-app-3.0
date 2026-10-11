#include "BarcodeScannerFilter.h"
#include "AudioFeedback.h"
#include <QKeyEvent>
#include <QDebug>

BarcodeScannerFilter::BarcodeScannerFilter(QObject *parent)
    : QObject(parent)
{
    m_idleTimer = new QTimer(this);
    m_idleTimer->setSingleShot(true);
    connect(m_idleTimer, &QTimer::timeout, this, &BarcodeScannerFilter::onIdleTimeout);
}

bool BarcodeScannerFilter::eventFilter(QObject *watched, QEvent *event) {
    if (event->type() != QEvent::KeyPress) {
        return QObject::eventFilter(watched, event);
    }

    auto *keyEvent = static_cast<QKeyEvent*>(event);
    int key = keyEvent->key();

    // Check for Enter / Return flush trigger
    if (key == Qt::Key_Return || key == Qt::Key_Enter) {
        if (!m_buffer.isEmpty() && m_isScanningStream) {
            m_idleTimer->stop();
            flushBuffer();
            return true; // Eat Enter event from barcode hardware
        }
        return QObject::eventFilter(watched, event);
    }

    QString text = keyEvent->text();
    if (text.isEmpty() || !text.at(0).isPrint()) {
        return QObject::eventFilter(watched, event);
    }

    qint64 elapsed = m_elapsedTimer.isValid() ? m_elapsedTimer.restart() : 999999;
    if (!m_elapsedTimer.isValid()) {
        m_elapsedTimer.start();
    }

    if (elapsed < m_maxInterKeyGapMs) {
        // High speed typing characteristic of hardware barcode scanner
        m_isScanningStream = true;
        m_buffer.append(text);
        m_idleTimer->start(m_idleFlushTimeoutMs);
        return true; // Intercept keypress
    } else {
        // Human typing or starting new sequence
        if (m_buffer.size() >= 3 && m_isScanningStream) {
            // Buffer already has previous barcode data
            flushBuffer();
        }
        m_buffer.clear();
        m_buffer.append(text);
        m_isScanningStream = false;
        m_idleTimer->start(m_idleFlushTimeoutMs);
    }

    return QObject::eventFilter(watched, event);
}

void BarcodeScannerFilter::onIdleTimeout() {
    if (m_isScanningStream && m_buffer.length() >= 3) {
        flushBuffer();
    } else {
        m_buffer.clear();
        m_isScanningStream = false;
    }
}

void BarcodeScannerFilter::flushBuffer() {
    QString code = m_buffer.trimmed();
    m_buffer.clear();
    m_isScanningStream = false;

    if (!code.isEmpty()) {
        AudioFeedback::instance().playClick();
        emit barcodeScanned(code);
    }
}
