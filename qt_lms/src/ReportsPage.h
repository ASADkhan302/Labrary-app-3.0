#pragma once

#include <QWidget>
#include <QLabel>
#include <QPushButton>
#include <QChartView>
#include <QBarSeries>
#include <QPieSeries>
#include <QPrinter>
#include "DatabaseManager.h"

class ReportsPage : public QWidget {
    Q_OBJECT
public:
    explicit ReportsPage(QWidget *parent = nullptr);
    ~ReportsPage() = default;

public slots:
    void refreshReports();

private slots:
    void onExportCsv();
    void onPrintAuditSheet();

private:
    void setupUi();
    QWidget* createCounterCard(const QString &title, const QString &val, const QString &sub, const QString &accentColor);
    void updateCharts(const LibraryStats &stats);
    void printA4AuditDocument(QPrinter *printer, const LibraryStats &stats);

    QLabel *m_lblTitles = nullptr;
    QLabel *m_lblCopies = nullptr;
    QLabel *m_lblActiveLoans = nullptr;
    QLabel *m_lblOverdue = nullptr;
    QLabel *m_lblOnTime = nullptr;

    QChartView *m_activityChartView = nullptr;
    QChartView *m_categoryChartView = nullptr;

    QPushButton *m_btnExportCsv = nullptr;
    QPushButton *m_btnPrintAudit = nullptr;
};
