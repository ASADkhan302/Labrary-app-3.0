#include "ReportsPage.h"
#include "AudioFeedback.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGridLayout>
#include <QFileDialog>
#include <QMessageBox>
#include <QPrintDialog>
#include <QPainter>
#include <QDateTime>
#include <QBarSet>
#include <QBarCategoryAxis>
#include <QValueAxis>
#include <QPieSlice>

ReportsPage::ReportsPage(QWidget *parent)
    : QWidget(parent)
{
    setupUi();
    refreshReports();
}

void ReportsPage::setupUi() {
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(24, 24, 24, 24);
    mainLayout->setSpacing(20);

    // Header & Actions
    auto *topRow = new QHBoxLayout();
    auto *title = new QLabel("<h2>University Library Analytics & Audit Reports</h2>", this);
    title->setStyleSheet("color: #F1F5F9;");
    topRow->addWidget(title, 1);

    m_btnExportCsv = new QPushButton("Export Catalog CSV", this);
    m_btnExportCsv->setObjectName("btnSecondary");
    connect(m_btnExportCsv, &QPushButton::clicked, this, &ReportsPage::onExportCsv);
    topRow->addWidget(m_btnExportCsv);

    m_btnPrintAudit = new QPushButton("🖨 Print A4 Audit Sheet", this);
    m_btnPrintAudit->setObjectName("btnPrimary");
    connect(m_btnPrintAudit, &QPushButton::clicked, this, &ReportsPage::onPrintAuditSheet);
    topRow->addWidget(m_btnPrintAudit);

    mainLayout->addLayout(topRow);

    // 5 Metric Counters Row
    auto *countersLayout = new QHBoxLayout();
    countersLayout->setSpacing(14);

    countersLayout->addWidget(createCounterCard("TOTAL DISTINCT TITLES", "0", "Cataloged bibliographic records", "#60A5FA"));
    countersLayout->addWidget(createCounterCard("PHYSICAL COPIES", "0", "Accession items in inventory", "#10B981"));
    countersLayout->addWidget(createCounterCard("ACTIVE LOANS", "0", "Currently held by borrowers", "#F59E0B"));
    countersLayout->addWidget(createCounterCard("OVERDUE COPIES", "0", "Past prescribed loan period", "#FB7185"));
    countersLayout->addWidget(createCounterCard("ON-TIME RETURN RATE", "100%", "Compliance audit benchmark", "#38BDF8"));

    mainLayout->addLayout(countersLayout);

    // Charts Area: Left = Monthly Circulation (Bar Chart), Right = Category Distribution (Pie Chart)
    auto *chartsRow = new QHBoxLayout();
    chartsRow->setSpacing(16);

    // 1. Monthly Circulation Activity
    m_activityChartView = new QChartView(this);
    m_activityChartView->setRenderHint(QPainter::Antialiasing);
    m_activityChartView->setStyleSheet("background-color: #0B1220; border: 1px solid #1E293B; border-radius: 10px;");
    chartsRow->addWidget(m_activityChartView, 3);

    // 2. Copies per Category
    m_categoryChartView = new QChartView(this);
    m_categoryChartView->setRenderHint(QPainter::Antialiasing);
    m_categoryChartView->setStyleSheet("background-color: #0B1220; border: 1px solid #1E293B; border-radius: 10px;");
    chartsRow->addWidget(m_categoryChartView, 2);

    mainLayout->addLayout(chartsRow, 1);
}

QWidget* ReportsPage::createCounterCard(const QString &title, const QString &val, const QString &sub, const QString &accentColor) {
    auto *card = new QWidget(this);
    card->setStyleSheet("background-color: #0B1220; border: 1px solid #1E293B; border-radius: 10px; padding: 14px;");

    auto *layout = new QVBoxLayout(card);
    layout->setContentsMargins(12, 12, 12, 12);
    layout->setSpacing(4);

    auto *lblTitle = new QLabel(title, card);
    lblTitle->setStyleSheet("color: #94A3B8; font-size: 11px; font-weight: bold; letter-spacing: 0.5px;");
    layout->addWidget(lblTitle);

    auto *lblVal = new QLabel(val, card);
    lblVal->setStyleSheet(QString("color: %1; font-size: 24px; font-weight: bold; font-family: 'JetBrains Mono';").arg(accentColor));
    layout->addWidget(lblVal);

    auto *lblSub = new QLabel(sub, card);
    lblSub->setStyleSheet("color: #64748B; font-size: 10px;");
    layout->addWidget(lblSub);

    if (title.contains("TITLES")) m_lblTitles = lblVal;
    else if (title.contains("COPIES")) m_lblCopies = lblVal;
    else if (title.contains("ACTIVE")) m_lblActiveLoans = lblVal;
    else if (title.contains("OVERDUE")) m_lblOverdue = lblVal;
    else if (title.contains("ON-TIME")) m_lblOnTime = lblVal;

    return card;
}

void ReportsPage::refreshReports() {
    auto stats = DatabaseManager::instance().getLibraryStatistics();

    if (m_lblTitles) m_lblTitles->setText(QString::number(stats.total_titles));
    if (m_lblCopies) m_lblCopies->setText(QString::number(stats.total_copies));
    if (m_lblActiveLoans) m_lblActiveLoans->setText(QString::number(stats.active_loans));
    if (m_lblOverdue) m_lblOverdue->setText(QString::number(stats.overdue_loans));
    if (m_lblOnTime) m_lblOnTime->setText(QString("%1%").arg(QString::number(stats.on_time_rate, 'f', 1)));

    updateCharts(stats);
}

void ReportsPage::updateCharts(const LibraryStats &stats) {
    // -------------------------------------------------------------
    // Chart 1: Monthly Issued vs Returned Activity
    // -------------------------------------------------------------
    auto *barSetIssued = new QBarSet("Books Issued");
    barSetIssued->setColor(QColor("#2563EB"));

    auto *barSetReturned = new QBarSet("Books Returned");
    barSetReturned->setColor(QColor("#10B981"));

    QStringList categories;
    for (const auto &item : stats.monthly_activity) {
        categories << item.first;
        *barSetIssued << item.second.first;
        *barSetReturned << item.second.second;
    }

    auto *series = new QBarSeries();
    series->append(barSetIssued);
    series->append(barSetReturned);

    auto *chart = new QChart();
    chart->addSeries(series);
    chart->setTitle("Monthly Circulation Activity: Issued vs. Returned");
    chart->setTitleFont(QFont("Plus Jakarta Sans", 11, QFont::Bold));
    chart->setTitleBrush(QBrush(QColor("#F1F5F9")));
    chart->setBackgroundBrush(QBrush(QColor("#0B1220")));
    chart->setTheme(QChart::ChartThemeDark);

    auto *axisX = new QBarCategoryAxis();
    axisX->append(categories);
    axisX->setLabelsColor(QColor("#A8B5C8"));
    chart->addAxis(axisX, Qt::AlignBottom);
    series->attachAxis(axisX);

    auto *axisY = new QValueAxis();
    axisY->setLabelsColor(QColor("#A8B5C8"));
    chart->addAxis(axisY, Qt::AlignLeft);
    series->attachAxis(axisY);

    chart->legend()->setVisible(true);
    chart->legend()->setAlignment(Qt::AlignTop);
    chart->legend()->setLabelColor(QColor("#F1F5F9"));

    m_activityChartView->setChart(chart);

    // -------------------------------------------------------------
    // Chart 2: Copies per Category Distribution
    // -------------------------------------------------------------
    auto *pieSeries = new QPieSeries();
    QStringList palette = {"#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#64748B"};
    int colorIdx = 0;

    for (auto it = stats.copies_by_category.begin(); it != stats.copies_by_category.end(); ++it) {
        auto *slice = pieSeries->append(it.key(), it.value());
        slice->setColor(QColor(palette[colorIdx % palette.size()]));
        slice->setLabelVisible(true);
        slice->setLabelColor(QColor("#F1F5F9"));
        slice->setLabelFont(QFont("Plus Jakarta Sans", 8));
        colorIdx++;
    }

    auto *pieChart = new QChart();
    pieChart->addSeries(pieSeries);
    pieChart->setTitle("Catalog Holdings by Category");
    pieChart->setTitleFont(QFont("Plus Jakarta Sans", 11, QFont::Bold));
    pieChart->setTitleBrush(QBrush(QColor("#F1F5F9")));
    pieChart->setBackgroundBrush(QBrush(QColor("#0B1220")));
    pieChart->legend()->setVisible(false);

    m_categoryChartView->setChart(pieChart);
}

void ReportsPage::onExportCsv() {
    QString defName = QString("ULM_Catalog_Export_%1.csv")
                          .arg(QDateTime::currentDateTime().toString("yyyyMMdd"));
    QString path = QFileDialog::getSaveFileName(this, "Export Catalog to UTF-8 CSV", defName, "CSV Files (*.csv)");
    if (path.isEmpty()) return;

    if (DatabaseManager::instance().exportCatalogToCsv(path)) {
        AudioFeedback::instance().playSuccessBeep();
        QMessageBox::information(this, "Export Complete", QString("Catalog records successfully saved to:\n%1").arg(path));
    } else {
        AudioFeedback::instance().playErrorBuzz();
        QMessageBox::critical(this, "Export Failed", "Could not export catalog records to CSV.");
    }
}

void ReportsPage::onPrintAuditSheet() {
    auto stats = DatabaseManager::instance().getLibraryStatistics();

    QPrinter printer(QPrinter::HighResolution);
    printer.setPageSize(QPageSize(QPageSize::A4));
    printer.setPageMargins(QMarginsF(15, 15, 15, 15), QPageLayout::Millimeter);

    QPrintDialog printDialog(&printer, this);
    printDialog.setWindowTitle("Print Official University Library Audit Sheet");
    if (printDialog.exec() != QDialog::Accepted) return;

    printA4AuditDocument(&printer, stats);
}

void ReportsPage::printA4AuditDocument(QPrinter *printer, const LibraryStats &stats) {
    QPainter painter(printer);
    painter.setRenderHint(QPainter::Antialiasing, true);
    painter.setRenderHint(QPainter::TextAntialiasing, true);

    QRectF page = printer->pageLayout().paintRectPixels(printer->resolution());
    double w = page.width();
    double y = 40.0;

    // Header
    painter.setFont(QFont("Cinzel", 16, QFont::Bold));
    painter.drawText(QRectF(0, y, w, 28), Qt::AlignCenter, "UNIVERSITY OF LAKKI MARWAT");
    y += 30.0;

    painter.setFont(QFont("Plus Jakarta Sans", 12, QFont::DemiBold));
    painter.drawText(QRectF(0, y, w, 22), Qt::AlignCenter, "CENTRAL CAMPUS LIBRARY · OFFICIAL AUDIT SHEET");
    y += 24.0;

    painter.setFont(QFont("JetBrains Mono", 9));
    QString auditMeta = QString("Report Date: %1  |  Workstation: %2  |  Auditor: Library Administrator")
                            .arg(QDateTime::currentDateTime().toString("yyyy-MM-dd hh:mm"))
                            .arg(DatabaseManager::instance().getSetting("workstation_id", "WS-ULM-01"));
    painter.drawText(QRectF(0, y, w, 18), Qt::AlignCenter, auditMeta);
    y += 24.0;

    painter.setPen(QPen(Qt::black, 2.0));
    painter.drawLine(QPointF(20, y), QPointF(w - 20, y));
    y += 20.0;

    // Metric Summary Table
    painter.setFont(QFont("Plus Jakarta Sans", 11, QFont::Bold));
    painter.drawText(QRectF(20, y, w - 40, 20), Qt::AlignLeft, "1. INVENTORY & CIRCULATION SUMMARY");
    y += 24.0;

    painter.setFont(QFont("Plus Jakarta Sans", 10));
    auto drawMetricRow = [&](const QString &label, const QString &val) {
        painter.drawText(QRectF(30, y, 300, 18), Qt::AlignLeft, label);
        painter.setFont(QFont("JetBrains Mono", 10, QFont::Bold));
        painter.drawText(QRectF(340, y, 200, 18), Qt::AlignLeft, val);
        painter.setFont(QFont("Plus Jakarta Sans", 10));
        y += 20.0;
    };

    drawMetricRow("Total Distinct Bibliographic Titles:", QString::number(stats.total_titles));
    drawMetricRow("Total Physical Copy Accession Items:", QString::number(stats.total_copies));
    drawMetricRow("Active Outstanding Loans:", QString::number(stats.active_loans));
    drawMetricRow("Overdue Outstanding Loans:", QString::number(stats.overdue_loans));
    drawMetricRow("Campus Return Compliance Rate:", QString("%1%").arg(QString::number(stats.on_time_rate, 'f', 2)));
    y += 15.0;

    // Active Loans Breakdown
    painter.setFont(QFont("Plus Jakarta Sans", 11, QFont::Bold));
    painter.drawText(QRectF(20, y, w - 40, 20), Qt::AlignLeft, "2. CURRENT OVERDUE & ACTIVE CIRCULATION AUDIT");
    y += 24.0;

    auto activeLoans = DatabaseManager::instance().getActiveLoans();

    // Table Header
    painter.setPen(QPen(Qt::black, 1.0));
    painter.drawRect(QRectF(20, y, w - 40, 22));
    painter.setFont(QFont("Plus Jakarta Sans", 9, QFont::Bold));
    painter.drawText(QRectF(25, y + 2, 80, 18), Qt::AlignLeft, "Accession");
    painter.drawText(QRectF(110, y + 2, 220, 18), Qt::AlignLeft, "Title & Author");
    painter.drawText(QRectF(340, y + 2, 160, 18), Qt::AlignLeft, "Borrower ID & Name");
    painter.drawText(QRectF(510, y + 2, 80, 18), Qt::AlignLeft, "Due Date");
    painter.drawText(QRectF(600, y + 2, 80, 18), Qt::AlignRight, "Overdue/Fine");
    y += 22.0;

    painter.setFont(QFont("Plus Jakarta Sans", 8));
    for (int i = 0; i < activeLoans.size() && y < page.height() - 140; ++i) {
        const auto &l = activeLoans[i];
        painter.drawRect(QRectF(20, y, w - 40, 18));
        painter.drawText(QRectF(25, y + 1, 80, 16), Qt::AlignLeft, l.barcode);
        painter.drawText(QRectF(110, y + 1, 220, 16), Qt::AlignLeft, l.title.left(35));
        painter.drawText(QRectF(340, y + 1, 160, 16), Qt::AlignLeft, QString("%1 (%2)").arg(l.borrower_name.left(16)).arg(l.university_id));
        painter.drawText(QRectF(510, y + 1, 80, 16), Qt::AlignLeft, l.due_date);

        QString status = l.days_overdue > 0 ? QString("%1d (%2)").arg(l.days_overdue).arg(Book::formatPaisa(l.fine_paisa)) : "OK";
        painter.drawText(QRectF(600, y + 1, 80, 16), Qt::AlignRight, status);
        y += 18.0;
    }

    // Official Verification Block at Bottom
    y = page.height() - 100.0;
    painter.drawLine(QPointF(20, y), QPointF(w - 20, y));
    y += 20.0;

    painter.setFont(QFont("Plus Jakarta Sans", 9));
    painter.drawText(QRectF(40, y, 250, 40), Qt::AlignLeft,
                     "Prepared By:\n__________________________\nAssistant Librarian");

    painter.drawText(QRectF(w - 290, y, 250, 40), Qt::AlignLeft,
                     "Verified & Approved By:\n__________________________\nChief Librarian / Registrar ULM");

    painter.end();
    AudioFeedback::instance().playSuccessBeep();
    QMessageBox::information(this, "Audit Printed", "The A4 university audit sheet was successfully printed.");
}
