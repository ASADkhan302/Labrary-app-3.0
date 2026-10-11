#include "CatalogModel.h"
#include "DatabaseManager.h"
#include <QSqlQuery>
#include <QSqlError>
#include <QColor>
#include <QFont>
#include <QDebug>

CatalogModel::CatalogModel(QObject *parent)
    : QAbstractTableModel(parent)
{
    refresh();
}

int CatalogModel::rowCount(const QModelIndex &parent) const {
    if (parent.isValid()) return 0;
    return m_books.size();
}

int CatalogModel::columnCount(const QModelIndex &parent) const {
    if (parent.isValid()) return 0;
    return ColumnCount;
}

QVariant CatalogModel::data(const QModelIndex &index, int role) const {
    if (!index.isValid() || index.row() >= m_books.size()) {
        return QVariant();
    }

    const Book &b = m_books.at(index.row());

    if (role == Qt::DisplayRole) {
        switch (index.column()) {
            case ColAccessionNo: return b.accession_no;
            case ColBarcode:     return b.barcode;
            case ColTitle:       return b.title;
            case ColAuthor:      return b.author.isEmpty() ? QString("-") : b.author;
            case ColEdition:     return b.edition.isEmpty() ? QString("-") : b.edition;
            case ColPublisher:   return b.publisher.isEmpty() ? QString("-") : b.publisher;
            case ColYear:        return b.year > 0 ? QString::number(b.year) : QString("-");
            case ColCallNumber:  return b.dewey_call_number.isEmpty() ? QString("-") : b.dewey_call_number;
            case ColShelf:       return b.shelf.isEmpty() ? QString("-") : b.shelf;
            case ColStatus:      return b.status.toUpper();
            case ColPrice:       return Book::formatPaisa(b.price_paisa);
            default: break;
        }
    } else if (role == Qt::TextAlignmentRole) {
        if (index.column() == ColAccessionNo || index.column() == ColYear || index.column() == ColPrice) {
            return QVariant(Qt::AlignRight | Qt::AlignVCenter);
        }
        if (index.column() == ColStatus || index.column() == ColShelf) {
            return QVariant(Qt::AlignCenter | Qt::AlignVCenter);
        }
        return QVariant(Qt::AlignLeft | Qt::AlignVCenter);
    } else if (role == Qt::ForegroundRole) {
        if (index.column() == ColStatus) {
            if (b.status == "available") return QColor("#10B981"); // Success green
            if (b.status == "issued") return QColor("#F59E0B");    // Amber
            if (b.status == "withdrawn") return QColor("#FB7185"); // Rose danger
            return QColor("#A8B5C8");
        }
        if (index.column() == ColBarcode || index.column() == ColAccessionNo) {
            return QColor("#60A5FA"); // Blue accent
        }
        if (index.column() == ColTitle) {
            return QColor("#F1F5F9"); // Crisp white
        }
        return QColor("#CBD5E1"); // Slate text
    } else if (role == Qt::FontRole) {
        if (index.column() == ColBarcode || index.column() == ColAccessionNo || 
            index.column() == ColCallNumber || index.column() == ColShelf) {
            QFont monoFont("JetBrains Mono", 9);
            return monoFont;
        }
        if (index.column() == ColStatus) {
            QFont statusFont("Plus Jakarta Sans", 9, QFont::Bold);
            return statusFont;
        }
    }

    return QVariant();
}

QVariant CatalogModel::headerData(int section, Qt::Orientation orientation, int role) const {
    if (orientation == Qt::Horizontal && role == Qt::DisplayRole) {
        switch (section) {
            case ColAccessionNo: return QStringLiteral("ACC NO");
            case ColBarcode:     return QStringLiteral("BARCODE");
            case ColTitle:       return QStringLiteral("BOOK TITLE");
            case ColAuthor:      return QStringLiteral("AUTHOR");
            case ColEdition:     return QStringLiteral("EDITION");
            case ColPublisher:   return QStringLiteral("PUBLISHER");
            case ColYear:        return QStringLiteral("YEAR");
            case ColCallNumber:  return QStringLiteral("DEWEY CALL NO");
            case ColShelf:       return QStringLiteral("SHELF");
            case ColStatus:      return QStringLiteral("STATUS");
            case ColPrice:       return QStringLiteral("PRICE");
            default: break;
        }
    }
    return QVariant();
}

bool CatalogModel::canFetchMore(const QModelIndex &parent) const {
    if (parent.isValid()) return false;
    return m_books.size() < m_totalCount;
}

void CatalogModel::fetchMore(const QModelIndex &parent) {
    if (parent.isValid()) return;
    fetchNextBatch();
}

void CatalogModel::sort(int column, Qt::SortOrder order) {
    m_sortColumn = column;
    m_sortOrder = order;
    refresh();
}

void CatalogModel::setSearchFilter(const QString &search) {
    if (m_searchQuery == search.trimmed()) return;
    m_searchQuery = search.trimmed();
    refresh();
}

void CatalogModel::setCategoryFilter(const QString &category) {
    if (m_categoryFilter == category) return;
    m_categoryFilter = category;
    refresh();
}

void CatalogModel::refresh() {
    beginResetModel();
    m_books.clear();
    executeCountQuery();
    endResetModel();

    if (m_totalCount > 0) {
        fetchNextBatch();
    }
}

const Book& CatalogModel::getBookAt(int row) const {
    return m_books.at(row);
}

void CatalogModel::executeCountQuery() {
    QString sql = "SELECT COUNT(*) FROM books WHERE is_active = 1 ";
    QVector<QVariant> bindings;

    if (!m_categoryFilter.isEmpty() && m_categoryFilter != "All") {
        sql += " AND category = ? ";
        bindings.append(m_categoryFilter);
    }

    if (!m_searchQuery.isEmpty()) {
        sql += " AND (title LIKE ? OR author LIKE ? OR isbn LIKE ? OR barcode LIKE ? OR accession_no LIKE ? OR dewey_call_number LIKE ? OR shelf LIKE ?) ";
        QString wildcard = "%" + m_searchQuery + "%";
        for (int i = 0; i < 7; ++i) {
            bindings.append(wildcard);
        }
    }

    QSqlQuery q;
    q.prepare(sql);
    for (const auto &b : bindings) {
        q.addBindValue(b);
    }

    if (q.exec() && q.next()) {
        m_totalCount = q.value(0).toInt();
    } else {
        m_totalCount = 0;
    }
}

void CatalogModel::fetchNextBatch() {
    int currentSize = m_books.size();
    if (currentSize >= m_totalCount) return;

    QString colName;
    switch (m_sortColumn) {
        case ColAccessionNo: colName = "accession_no"; break;
        case ColBarcode:     colName = "barcode"; break;
        case ColTitle:       colName = "title"; break;
        case ColAuthor:      colName = "author"; break;
        case ColPublisher:   colName = "publisher"; break;
        case ColYear:        colName = "year"; break;
        case ColCallNumber:  colName = "dewey_call_number"; break;
        case ColShelf:       colName = "shelf"; break;
        case ColStatus:      colName = "status"; break;
        case ColPrice:       colName = "price_paisa"; break;
        default:             colName = "accession_no"; break;
    }

    QString orderStr = (m_sortOrder == Qt::AscendingOrder) ? "ASC" : "DESC";

    QString sql = "SELECT * FROM books WHERE is_active = 1 ";
    QVector<QVariant> bindings;

    if (!m_categoryFilter.isEmpty() && m_categoryFilter != "All") {
        sql += " AND category = ? ";
        bindings.append(m_categoryFilter);
    }

    if (!m_searchQuery.isEmpty()) {
        sql += " AND (title LIKE ? OR author LIKE ? OR isbn LIKE ? OR barcode LIKE ? OR accession_no LIKE ? OR dewey_call_number LIKE ? OR shelf LIKE ?) ";
        QString wildcard = "%" + m_searchQuery + "%";
        for (int i = 0; i < 7; ++i) {
            bindings.append(wildcard);
        }
    }

    sql += QString(" ORDER BY %1 %2 LIMIT %3 OFFSET %4;").arg(colName, orderStr).arg(BATCH_SIZE).arg(currentSize);

    QSqlQuery q;
    q.prepare(sql);
    for (const auto &b : bindings) {
        q.addBindValue(b);
    }

    QVector<Book> newBooks;
    if (q.exec()) {
        while (q.next()) {
            Book b;
            b.id = q.value("id").toInt();
            b.accession_no = q.value("accession_no").toInt();
            b.barcode = q.value("barcode").toString();
            b.author = q.value("author").toString();
            b.title = q.value("title").toString();
            b.edition = q.value("edition").toString();
            b.place = q.value("place").toString();
            b.publisher = q.value("publisher").toString();
            b.year = q.value("year").toInt();
            b.pages = q.value("pages").toString();
            b.price_paisa = q.value("price_paisa").toInt();
            b.binding = q.value("binding").toString();
            b.binding_code = q.value("binding_code").toString();
            b.isbn = q.value("isbn").toString();
            b.source_remarks = q.value("source_remarks").toString();
            b.category = q.value("category").toString();
            b.dewey_call_number = q.value("dewey_call_number").toString();
            b.shelf = q.value("shelf").toString();
            b.status = q.value("status").toString();
            b.is_active = q.value("is_active").toInt() == 1;
            b.created_at = q.value("created_at").toString();
            b.updated_at = q.value("updated_at").toString();
            newBooks.append(b);
        }
    }

    if (!newBooks.isEmpty()) {
        beginInsertRows(QModelIndex(), currentSize, currentSize + newBooks.size() - 1);
        m_books.append(newBooks);
        endInsertRows();
    }
}
