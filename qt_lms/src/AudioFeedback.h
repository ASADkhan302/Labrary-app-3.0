#pragma once

#include <QObject>
#include <QByteArray>
#include <QAudioFormat>
#include <QAudioSink>
#include <QBuffer>
#include <memory>

class AudioFeedback : public QObject {
    Q_OBJECT
public:
    static AudioFeedback& instance();

    void playSuccessBeep();  // 1760 Hz then 2093 Hz double beep
    void playReturnChord();  // Ascending chord 523, 659, 784 Hz
    void playErrorBuzz();    // 180 Hz square-wave double buzz
    void playClick();        // 1200 Hz, 10 ms click

    void setEnabled(bool enabled) { m_enabled = enabled; }
    bool isEnabled() const { return m_enabled; }

private:
    explicit AudioFeedback(QObject *parent = nullptr);
    ~AudioFeedback() = default;

    void playPcmData(const QByteArray &pcmData);
    QByteArray generateSineTone(double freqHz, int durationMs, double volume = 0.4);
    QByteArray generateSquareTone(double freqHz, int durationMs, double volume = 0.3);
    QByteArray generateChord(const QVector<double> &freqs, int durationMs, double volume = 0.35);

    bool m_enabled = true;
    QAudioFormat m_format;
    std::unique_ptr<QAudioSink> m_audioSink;
    std::unique_ptr<QBuffer> m_audioBuffer;
};
