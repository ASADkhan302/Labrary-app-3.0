#pragma once

#include <QString>
#include <QDateTime>
#include <QLocale>
#include <QRegularExpression>

struct Book {
    int id = 0;
    int accession_no = 0;
    QString barcode;
    QString author;
    QString title;
    QString edition;
    QString place;
    QString publisher;
    int year = 0;
    QString pages;
    int price_paisa = 0; // In integer paisa
    QString binding = "HB"; // HB, SB, Other
    QString binding_code;
    QString isbn;
    QString source_remarks;
    QString category;
    QString dewey_call_number;
    QString shelf;
    QString status = "available"; // available, issued, lost, withdrawn
    bool is_active = true;
    QString created_at;
    QString updated_at;

    static QString formatBarcode(int accNo) {
        return QString("ULM-%1").arg(accNo, 5, 10, QChar('0'));
    }

    static QString formatPaisa(int paisa) {
        if (paisa <= 0) return QString("-");
        double rupees = static_cast<double>(paisa) / 100.0;
        QLocale locale(QLocale::English);
        return QString("Rs %1").arg(locale.toString(rupees, 'f', 2));
    }
};

struct Borrower {
    int id = 0;
    QString role = "Student"; // Student, Faculty, Staff
    QString university_id;    // e.g. ULM-FA23-BCS-042
    QString barcode;          // same as university_id
    QString name;
    QString father_name;      // Student only
    QString department;       // Computer Science, Law, etc.
    QString program;          // e.g. BCS (Student only)
    QString session;          // e.g. FA23 (Student only)
    int semester = 1;         // 1-8 (Student only)
    QString designation;      // Professor, Lecturer, etc. (Faculty/Staff only)
    QString email;
    QString phone;            // Pakistani format 03XX-XXXXXXX or +92 3XX XXXXXXX
    QString address;
    QString photo_path;       // Local resized photo in Photos directory
    int borrow_limit = 3;     // Student: 3, Faculty: 10, Staff: 5
    QString joined_date;      // YYYY-MM-DD
    QString valid_until;      // YYYY-MM-DD (students leave)
    QString status = "active"; // active, suspended, left
    QString notes;
    bool is_active = true;
    QString created_at;
    QString updated_at;

    static int defaultLimitForRole(const QString &r) {
        if (r.compare("Faculty", Qt::CaseInsensitive) == 0) return 10;
        if (r.compare("Staff", Qt::CaseInsensitive) == 0) return 5;
        return 3; // Student default
    }

    // Normalizes Pakistani phone number: e.g. "03001234567" or "+92 300 1234567" -> "0300-1234567"
    static QString normalizePhone(const QString &raw) {
        QString digits;
        for (QChar c : raw) {
            if (c.isDigit()) digits.append(c);
        }
        if (digits.startsWith("92") && digits.length() >= 12) {
            digits = "0" + digits.mid(2);
        }
        if (digits.length() == 11 && digits.startsWith("03")) {
            return QString("%1-%2").arg(digits.left(4), digits.mid(4));
        }
        return raw.trimmed();
    }

    // Auto-detect session and program from ULM ID pattern: ^ULM-([A-Z]{2}\d{2})-([A-Z]+)-(\d{3})$
    static bool parseUniversityId(const QString &uid, QString &outSession, QString &outProgram, QString &outRoll) {
        static QRegularExpression re("^ULM-([A-Z]{2}\\d{2})-([A-Z]+)-(\\d{3})$", QRegularExpression::CaseInsensitiveOption);
        auto match = re.match(uid.trimmed());
        if (match.hasMatch()) {
            outSession = match.captured(1).toUpper();
            outProgram = match.captured(2).toUpper();
            outRoll = match.captured(3);
            return true;
        }
        return false;
    }
};

struct Transaction {
    int id = 0;
    int book_id = 0;
    int borrower_id = 0;
    QString issue_date;
    QString due_date;
    QString return_date;
    int fine_paid_paisa = 0;
};
