#include "BootSplashScreen.h"
#include <QPainter>
#include <QKeyEvent>

BootSplashScreen::BootSplashScreen(QWidget *parent)
    : QWidget(parent, Qt::FramelessWindowHint | Qt::WindowStaysOnTopHint)
{
    setFixedSize(720, 440);
    setStyleSheet("background-color: #020617;");
    setFocusPolicy(Qt::StrongFocus);

    m_diagnosticLines = {
        ">> ULM BIOS v2.4 (x86_64 UEFI) ... OK",
        ">> Initializing University of Lakki Marwat Hardware Core ... OK",
        ">> Memory check: 64MB Cache Allocated (PRAGMA cache_size = -64000) ... PASSED",
        ">> SQLite Database Engine Mounted: WAL Mode, Synchronous NORMAL ... OK",
        ">> FTS5 Full-Text Search Virtual Triggers Registered ... OK",
        ">> High-DPI Windows 11 Vector Subsystem Initialized ... OK",
        ">> Code-128 (Subset B) Hardware Barcode Scanner Engine ... READY",
        ">> Plus Jakarta Sans & JetBrains Mono Typography Mounted ... OK",
        ">> Launching ULM Central Campus LMS Desktop Workstation ... [PRESS ANY KEY TO SKIP]"
    };

    // 2.5 seconds total / 9 steps approx 270 ms per step
    m_timer = new QTimer(this);
    connect(m_timer, &QTimer::timeout, this, &BootSplashScreen::onTick);
    m_timer->start(270);
}

void BootSplashScreen::onTick() {
    if (m_step < m_diagnosticLines.size()) {
        if (!m_visibleText.isEmpty()) m_visibleText += "\n";
        m_visibleText += m_diagnosticLines[m_step];
        m_step++;
        update();
    } else {
        m_timer->stop();
        finishBoot();
    }
}

void BootSplashScreen::keyPressEvent(QKeyEvent *event) {
    Q_UNUSED(event);
    finishBoot();
}

void BootSplashScreen::mousePressEvent(QMouseEvent *event) {
    Q_UNUSED(event);
    finishBoot();
}

void BootSplashScreen::finishBoot() {
    if (m_timer) {
        m_timer->stop();
    }
    emit bootCompleted();
    close();
}

void BootSplashScreen::paintEvent(QPaintEvent *) {
    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);

    // Dark canvas
    painter.fillRect(rect(), QColor("#020617"));

    // Amber border
    painter.setPen(QPen(QColor("#F59E0B"), 2.0));
    painter.drawRect(rect().adjusted(1, 1, -1, -1));

    // Institution Title Header
    painter.setPen(QColor("#F59E0B"));
    painter.setFont(QFont("Cinzel", 14, QFont::Bold));
    painter.drawText(QRect(24, 20, width() - 48, 24), Qt::AlignLeft, "UNIVERSITY OF LAKKI MARWAT");

    painter.setPen(QColor("#A8B5C8"));
    painter.setFont(QFont("Plus Jakarta Sans", 9));
    painter.drawText(QRect(24, 46, width() - 48, 18), Qt::AlignLeft, "CENTRAL CAMPUS LIBRARY MANAGEMENT SYSTEM · BOOT DIAGNOSTICS");

    painter.setPen(QPen(QColor("#1E293B"), 1.0));
    painter.drawLine(24, 70, width() - 24, 70);

    // Diagnostics terminal box
    painter.setPen(QColor("#10B981"));
    painter.setFont(QFont("JetBrains Mono", 10));
    QRect textRect(28, 80, width() - 56, height() - 110);
    painter.drawText(textRect, Qt::AlignLeft | Qt::AlignTop, m_visibleText);

    // Bottom blinking prompt
    painter.setPen(QColor("#64748B"));
    painter.setFont(QFont("JetBrains Mono", 8));
    painter.drawText(QRect(28, height() - 28, width() - 56, 18), Qt::AlignRight, "Press ANY key or click to skip (2.5s)");
}
