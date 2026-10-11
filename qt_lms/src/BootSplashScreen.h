#pragma once

#include <QWidget>
#include <QTimer>
#include <QVector>
#include <QString>

class BootSplashScreen : public QWidget {
    Q_OBJECT
public:
    explicit BootSplashScreen(QWidget *parent = nullptr);
    ~BootSplashScreen() = default;

signals:
    void bootCompleted();

protected:
    void paintEvent(QPaintEvent *event) override;
    void keyPressEvent(QKeyEvent *event) override;
    void mousePressEvent(QMouseEvent *event) override;

private slots:
    void onTick();

private:
    void finishBoot();

    QTimer *m_timer = nullptr;
    int m_step = 0;
    QVector<QString> m_diagnosticLines;
    QString m_visibleText;
};
