#include "CsvWizardDialog.h"
#include "DatabaseManager.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFileDialog>
#include <QMessageBox>
#include <QHeaderView>
#include <QFile>
#include <QTextStream>
#include <QApplication>

CsvWizardDialog::CsvWizardDialog(QWidget *parent)
    : QDialog(parent)
{
    setWindowTitle("Accession Register CSV Import Wizard - ULM LMS");
    setMinimumSize(920, 680);
    setupUi();
}

void CsvWizardDialog::setupUi() {
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(20, 20, 20, 20);
    mainLayout->setSpacing(14);

    // Title & Instructions
    auto *headerLabel = new QLabel("<h2>Batch Accession Register CSV Import</h2>", this);
    headerLabel->setStyleSheet("color: #F1F5F9;");
    mainLayout->addWidget(headerLabel);

    auto *descLabel = new QLabel(
        "Import register records directly from UTF-8 CSV. Map each CSV column to the accession register field. "
        "The wizard previews 20 rows, detects duplicates, validates line-by-line, and executes within an atomic SQL transaction.",
        this
    );
    descLabel->setStyleSheet("color: #A8B5C8;");
    descLabel->setWordWrap(true);
    mainLayout->addWidget(descLabel);

    // File Selector Row
    auto *fileRow = new QHBoxLayout();
    m_filePathInput = new QLineEdit(this);
    m_filePathInput->setReadOnly(true);
    m_filePathInput->setPlaceholderText("Select a UTF-8 CSV file containing library register data...");
    fileRow->addWidget(m_filePathInput, 1);

    m_btnBrowse = new QPushButton("Browse File...", this);
    m_btnBrowse->setObjectName("btnSecondary");
    connect(m_btnBrowse, &QPushButton::clicked, this, &CsvWizardDialog::onBrowseFile);
    fileRow->addWidget(m_btnBrowse);

    m_btnDownloadTemplate = new QPushButton("Download Template", this);
    m_btnDownloadTemplate->setObjectName("btnSecondary");
    connect(m_btnDownloadTemplate, &QPushButton::clicked, this, &CsvWizardDialog::onDownloadTemplate);
    fileRow->addWidget(m_btnDownloadTemplate);

    mainLayout->addLayout(fileRow);

    // Split section: Left = Column Mapping, Right = Preview
    auto *tablesLayout = new QHBoxLayout();
    tablesLayout->setSpacing(12);

    // Column Mapping Table
    auto *mapContainer = new QVBoxLayout();
    auto *mapTitle = new QLabel("<b>1. Column Mapping</b>", this);
    mapTitle->setStyleSheet("color: #F1F5F9;");
    mapContainer->addWidget(mapTitle);

    m_mappingTable = new QTableWidget(this);
    m_mappingTable->setColumnCount(2);
    m_mappingTable->setHorizontalHeaderLabels({"CSV Header Column", "Register Target Field"});
    m_mappingTable->horizontalHeader()->setStretchLastSection(true);
    m_mappingTable->horizontalHeader()->setSectionResizeMode(0, QHeaderView::ResizeToContents);
    m_mappingTable->verticalHeader()->setVisible(false);
    mapContainer->addWidget(m_mappingTable);
    tablesLayout->addLayout(mapContainer, 2);

    // 20-Row Preview Table
    auto *prevContainer = new QVBoxLayout();
    auto *prevTitle = new QLabel("<b>2. Data Preview (First 20 Rows)</b>", this);
    prevTitle->setStyleSheet("color: #F1F5F9;");
    prevContainer->addWidget(prevTitle);

    m_previewTable = new QTableWidget(this);
    m_previewTable->horizontalHeader()->setSectionResizeMode(QHeaderView::ResizeToContents);
    prevContainer->addWidget(m_previewTable);
    tablesLayout->addLayout(prevContainer, 3);

    mainLayout->addLayout(tablesLayout, 1);

    // Status & Progress
    m_progressBar = new QProgressBar(this);
    m_progressBar->setVisible(false);
    m_progressBar->setRange(0, 100);
    mainLayout->addWidget(m_progressBar);

    // Validation Report Box
    m_reportArea = new QTextEdit(this);
    m_reportArea->setReadOnly(true);
    m_reportArea->setMaximumHeight(120);
    m_reportArea->setPlaceholderText("Validation report and line-by-line diagnostics will appear here...");
    m_reportArea->setStyleSheet("background-color: #0F172A; color: #CBD5E1; border: 1px solid #334155; font-family: 'JetBrains Mono'; font-size: 11px;");
    mainLayout->addWidget(m_reportArea);

    // Bottom Action Row
    auto *actionRow = new QHBoxLayout();
    m_statusLabel = new QLabel(this);
    m_statusLabel->setStyleSheet("color: #A8B5C8;");
    actionRow->addWidget(m_statusLabel, 1);

    auto *btnClose = new QPushButton("Cancel", this);
    btnClose->setObjectName("btnSecondary");
    connect(btnClose, &QPushButton::clicked, this, &QDialog::reject);
    actionRow->addWidget(btnClose);

    m_btnImport = new QPushButton("Execute Safe Import", this);
    m_btnImport->setObjectName("btnPrimary");
    m_btnImport->setEnabled(false);
    connect(m_btnImport, &QPushButton::clicked, this, &CsvWizardDialog::onStartImport);
    actionRow->addWidget(m_btnImport);

    mainLayout->addLayout(actionRow);
}

void CsvWizardDialog::onBrowseFile() {
    QString path = QFileDialog::getOpenFileName(this, "Select Accession Register CSV", "", "CSV Files (*.csv);;All Files (*.*)");
    if (path.isEmpty()) return;

    m_selectedFilePath = path;
    m_filePathInput->setText(path);
    parsePreview(path);
}

void CsvWizardDialog::onDownloadTemplate() {
    QString dest = QFileDialog::getSaveFileName(this, "Save Accession Register CSV Template", "ULM_Accession_Register_Template.csv", "CSV Files (*.csv)");
    if (dest.isEmpty()) return;

    QFile file(dest);
    if (file.open(QIODevice::WriteOnly | QIODevice::Text)) {
        QTextStream out(&file);
        out.setEncoding(QStringConverter::Utf8);
        out << "Accession No,Title,Author,Edition,Place,Publisher,Year,Pages,Price Rs,Binding,Binding Code,ISBN,Category,Dewey Call Number,Shelf,Remarks\n";
        out << "10021,\"Introduction to Database Management\",\"Dr. Asadullah Marwat\",\"2nd\",\"Lakki Marwat\",\"ULM Press\",2023,540,850.00,\"HB\",\"01\",\"9789694481012\",\"Computer Science\",\"005.74 MAR\",\"CS-03-B\",\"University Purchase\"\n";
        out << "10022,\"Principles of Modern Physics\",\"Dr. Tariq Khan\",\"1st\",\"Peshawar\",\"Khyber Publishing\",2022,480,620.00,\"SB\",\"02\",\"9789694481029\",\"Physics\",\"530.1 KHA\",\"SCI-01-C\",\"Donation\"\n";
        file.close();
        QMessageBox::information(this, "Template Saved", "The Accession Register CSV template was saved successfully.");
    }
}

void CsvWizardDialog::parsePreview(const QString &filePath) {
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        QMessageBox::warning(this, "File Error", "Could not open selected CSV file.");
        return;
    }

    QTextStream in(&file);
    in.setEncoding(QStringConverter::Utf8);

    m_csvHeaders.clear();
    m_previewRows.clear();

    auto parseLine = [](const QString &line) -> QStringList {
        QStringList fields;
        QString field;
        bool inQuotes = false;
        for (int i = 0; i < line.length(); ++i) {
            QChar c = line[i];
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line[i + 1] == '"') {
                    field += '"';
                    ++i;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields << field.trimmed();
                field.clear();
            } else {
                field += c;
            }
        }
        fields << field.trimmed();
        return fields;
    };

    int rowCount = 0;
    while (!in.atEnd() && rowCount < 21) {
        QString line = in.readLine();
        if (line.trimmed().isEmpty()) continue;
        if (rowCount == 0) {
            m_csvHeaders = parseLine(line);
        } else {
            m_previewRows.append(parseLine(line));
        }
        rowCount++;
    }
    file.close();

    // Setup Mapping Table
    m_mappingTable->setRowCount(m_csvHeaders.size());
    QStringList targetFields = {
        "-- Ignore Column --",
        "accession_no",
        "title",
        "author",
        "edition",
        "place",
        "publisher",
        "year",
        "pages",
        "price_rs",
        "price_paisa",
        "binding",
        "binding_code",
        "isbn",
        "category",
        "dewey_call_number",
        "shelf",
        "source_remarks"
    };

    for (int i = 0; i < m_csvHeaders.size(); ++i) {
        auto *hdrItem = new QTableWidgetItem(m_csvHeaders[i]);
        hdrItem->setFlags(Qt::ItemIsEnabled | Qt::ItemIsSelectable);
        m_mappingTable->setItem(i, 0, hdrItem);

        auto *combo = new QComboBox(m_mappingTable);
        combo->addItems(targetFields);

        // Auto-guess target
        QString hLower = m_csvHeaders[i].toLower().remove(" ").remove("_");
        if (hLower.contains("accession")) combo->setCurrentText("accession_no");
        else if (hLower.contains("title")) combo->setCurrentText("title");
        else if (hLower.contains("author")) combo->setCurrentText("author");
        else if (hLower.contains("edition")) combo->setCurrentText("edition");
        else if (hLower.contains("place")) combo->setCurrentText("place");
        else if (hLower.contains("publisher")) combo->setCurrentText("publisher");
        else if (hLower.contains("year")) combo->setCurrentText("year");
        else if (hLower.contains("page")) combo->setCurrentText("pages");
        else if (hLower.contains("pricers") || hLower == "price") combo->setCurrentText("price_rs");
        else if (hLower.contains("paisa")) combo->setCurrentText("price_paisa");
        else if (hLower.contains("bindingcode")) combo->setCurrentText("binding_code");
        else if (hLower.contains("binding")) combo->setCurrentText("binding");
        else if (hLower.contains("isbn")) combo->setCurrentText("isbn");
        else if (hLower.contains("category")) combo->setCurrentText("category");
        else if (hLower.contains("dewey") || hLower.contains("call")) combo->setCurrentText("dewey_call_number");
        else if (hLower.contains("shelf")) combo->setCurrentText("shelf");
        else if (hLower.contains("remark") || hLower.contains("source")) combo->setCurrentText("source_remarks");

        m_mappingTable->setCellWidget(i, 1, combo);
    }

    // Setup Preview Table
    m_previewTable->setColumnCount(m_csvHeaders.size());
    m_previewTable->setHorizontalHeaderLabels(m_csvHeaders);
    m_previewTable->setRowCount(m_previewRows.size());

    for (int r = 0; r < m_previewRows.size(); ++r) {
        const auto &rowVals = m_previewRows[r];
        for (int c = 0; c < rowVals.size() && c < m_csvHeaders.size(); ++c) {
            m_previewTable->setItem(r, c, new QTableWidgetItem(rowVals[c]));
        }
    }

    m_btnImport->setEnabled(true);
    m_statusLabel->setText(QString("Found %1 columns and loaded %2 preview rows.")
                           .arg(m_csvHeaders.size()).arg(m_previewRows.size()));
}

void CsvWizardDialog::onStartImport() {
    if (m_selectedFilePath.isEmpty()) return;

    QMap<int, QString> columnMap;
    bool hasTitle = false;

    for (int i = 0; i < m_mappingTable->rowCount(); ++i) {
        auto *combo = qobject_cast<QComboBox*>(m_mappingTable->cellWidget(i, 1));
        if (combo) {
            QString selected = combo->currentText();
            if (selected != "-- Ignore Column --") {
                columnMap[i] = selected;
                if (selected == "title") hasTitle = true;
            }
        }
    }

    if (!hasTitle) {
        QMessageBox::critical(this, "Mapping Error", "You must map at least one column to the mandatory 'title' field.");
        return;
    }

    m_btnImport->setEnabled(false);
    m_btnBrowse->setEnabled(false);
    m_progressBar->setVisible(true);
    m_progressBar->setValue(20);
    qApp->processEvents();

    QStringList errors;
    int imported = 0;
    int skipped = 0;

    m_progressBar->setValue(50);
    qApp->processEvents();

    bool ok = DatabaseManager::instance().importBooksFromCsv(m_selectedFilePath, columnMap, errors, imported, skipped);
    m_progressBar->setValue(100);

    QString reportText;
    reportText += QString("=== Import Summary ===\n");
    reportText += QString("Status: %1\n").arg(ok ? "COMPLETED" : "FAILED");
    reportText += QString("Successfully Added Copies: %1\n").arg(imported);
    reportText += QString("Skipped / Invalid Rows: %1\n\n").arg(skipped);

    if (!errors.isEmpty()) {
        reportText += "Validation Diagnostics:\n";
        for (const QString &err : errors) {
            reportText += " • " + err + "\n";
        }
    } else {
        reportText += "All parsed records passed integrity constraints with zero errors.\n";
    }

    m_reportArea->setText(reportText);

    if (ok) {
        QMessageBox::information(this, "Import Complete",
                                 QString("Successfully imported %1 books into the library register.\n%2 rows skipped.")
                                 .arg(imported).arg(skipped));
        accept();
    } else {
        QMessageBox::warning(this, "Import Finished with Warnings",
                             "The import completed with errors. See the diagnostic log below.");
        m_btnImport->setEnabled(true);
        m_btnBrowse->setEnabled(true);
    }
}
