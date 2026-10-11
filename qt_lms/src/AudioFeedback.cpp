#include "AudioFeedback.h"
#include "DatabaseManager.h"
#include <QMediaDevices>
#include <QAudioDevice>
#include <QtMath>
#include <QTimer>

AudioFeedback& AudioFeedback::instance() {
    static AudioFeedback inst;
    return inst;
}

AudioFeedback::AudioFeedback(QObject *parent)
    : QObject(parent)
{
    m_format.setSampleRate(44100);
    m_format.setChannelCount(1);
    m_format.setSampleFormat(QAudioFormat::Int16);

    QAudioDevice defaultDevice = QMediaDevices::defaultAudioOutput();
    if (!defaultDevice.isNull()) {
        m_audioSink = std::make_unique<QAudioSink>(defaultDevice, m_format, this);
        m_audioSink->setVolume(0.6f); // Cap volume
    }

    // Read initial setting from DB
    m_enabled = DatabaseManager::instance().getSetting("audio_enabled", "true") == "true";
}

void AudioFeedback::playPcmData(const QByteArray &pcmData) {
    if (!m_enabled || !m_audioSink) return;

    // Reset buffer
    m_audioBuffer = std::make_unique<QBuffer>();
    m_audioBuffer->setData(pcmData);
    m_audioBuffer->open(QIODevice::ReadOnly);

    m_audioSink->stop();
    m_audioSink->start(m_audioBuffer.get());
}

QByteArray AudioFeedback::generateSineTone(double freqHz, int durationMs, double volume) {
    int sampleRate = 44100;
    int numSamples = (sampleRate * durationMs) / 1000;
    QByteArray data;
    data.resize(numSamples * sizeof(qint16));
    auto *samples = reinterpret_cast<qint16*>(data.data());

    for (int i = 0; i < numSamples; ++i) {
        double t = static_cast<double>(i) / sampleRate;
        double envelope = 1.0;
        // Fade in/out to eliminate speaker clicks
        if (i < 200) envelope = static_cast<double>(i) / 200.0;
        else if (i > numSamples - 200) envelope = static_cast<double>(numSamples - i) / 200.0;

        double sample = volume * envelope * qSin(2.0 * M_PI * freqHz * t);
        samples[i] = static_cast<qint16>(qBound(-32767.0, sample * 32767.0, 32767.0));
    }
    return data;
}

QByteArray AudioFeedback::generateSquareTone(double freqHz, int durationMs, double volume) {
    int sampleRate = 44100;
    int numSamples = (sampleRate * durationMs) / 1000;
    QByteArray data;
    data.resize(numSamples * sizeof(qint16));
    auto *samples = reinterpret_cast<qint16*>(data.data());

    for (int i = 0; i < numSamples; ++i) {
        double t = static_cast<double>(i) / sampleRate;
        double phase = qFmod(t * freqHz, 1.0);
        double val = (phase < 0.5) ? 1.0 : -1.0;

        double envelope = 1.0;
        if (i < 150) envelope = static_cast<double>(i) / 150.0;
        else if (i > numSamples - 150) envelope = static_cast<double>(numSamples - i) / 150.0;

        double sample = volume * envelope * val;
        samples[i] = static_cast<qint16>(qBound(-32767.0, sample * 32767.0, 32767.0));
    }
    return data;
}

QByteArray AudioFeedback::generateChord(const QVector<double> &freqs, int durationMs, double volume) {
    int sampleRate = 44100;
    int numSamples = (sampleRate * durationMs) / 1000;
    QByteArray data;
    data.resize(numSamples * sizeof(qint16));
    auto *samples = reinterpret_cast<qint16*>(data.data());

    double weight = volume / freqs.size();

    for (int i = 0; i < numSamples; ++i) {
        double t = static_cast<double>(i) / sampleRate;
        double sum = 0.0;
        for (double f : freqs) {
            sum += qSin(2.0 * M_PI * f * t);
        }

        double envelope = 1.0;
        if (i < 300) envelope = static_cast<double>(i) / 300.0;
        else if (i > numSamples - 300) envelope = static_cast<double>(numSamples - i) / 300.0;

        double sample = weight * envelope * sum;
        samples[i] = static_cast<qint16>(qBound(-32767.0, sample * 32767.0, 32767.0));
    }
    return data;
}

// 1. Success: 1760 Hz then 2093 Hz double beep
void AudioFeedback::playSuccessBeep() {
    QByteArray tone1 = generateSineTone(1760.0, 70, 0.45);
    QByteArray pause(44100 * 25 / 1000 * sizeof(qint16), 0);
    QByteArray tone2 = generateSineTone(2093.0, 90, 0.45);

    QByteArray combined = tone1 + pause + tone2;
    playPcmData(combined);
}

// 2. Return: Ascending chord 523 / 659 / 784 Hz (C5, E5, G5)
void AudioFeedback::playReturnChord() {
    QByteArray c5 = generateSineTone(523.25, 70, 0.35);
    QByteArray e5 = generateSineTone(659.25, 70, 0.35);
    QByteArray chord = generateChord({523.25, 659.25, 783.99}, 140, 0.4);

    QByteArray combined = c5 + e5 + chord;
    playPcmData(combined);
}

// 3. Error: 180 Hz square-wave double buzz
void AudioFeedback::playErrorBuzz() {
    QByteArray buzz1 = generateSquareTone(180.0, 100, 0.35);
    QByteArray pause(44100 * 40 / 1000 * sizeof(qint16), 0);
    QByteArray buzz2 = generateSquareTone(180.0, 120, 0.35);

    QByteArray combined = buzz1 + pause + buzz2;
    playPcmData(combined);
}

// 4. Click: 1200 Hz, 10 ms click
void AudioFeedback::playClick() {
    QByteArray click = generateSineTone(1200.0, 10, 0.25);
    playPcmData(click);
}
