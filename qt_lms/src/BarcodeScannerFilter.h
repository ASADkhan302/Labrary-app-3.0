#pragma once

#include <QObject>
#include <QElapsedTimer>
#include <QTimer>
#include <QString>

class BarcodeScannerFilter : public QObject {
    Q_OBJECT
public:
    explicit BarcodeScannerFilter(QObject *parent = nullptr);
    ~BarcodeScannerFilter() = default;

    void setMaxInterKeyGapMs(qint64 ms) { m_maxInterKeyGapMs = ms; }
    void setIdleFlushTimeoutMs(int ms) { m_idleFlushTimeoutMs = ms; }

signals:
    void barcodeScanned(const QString &barcode);

protected:
    bool eventFilter(QObject *watched, QEvent *event) override;

private slots:
    void onIdleTimeout();

private:
    void flushBuffer();

    QString m_buffer;
    QElapsedTimer m_elapsedTimer;
    QTimer *m_idleTimer = nullptr;
    qint64 m_maxInterKeyGapMs = 50; // Scanner keys arrive < 50ms apart
    int m_idleFlushTimeoutMs = 100; // Flush after 100ms idle
    bool m_isScanningStream = false;
};
