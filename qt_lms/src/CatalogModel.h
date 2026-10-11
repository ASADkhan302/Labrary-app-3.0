#pragma once

#include <QAbstractTableModel>
#include <QVector>
#include <QString>
#include "Models.h"

class CatalogModel : public QAbstractTableModel {
    Q_OBJECT
public:
    enum Column {
        ColAccessionNo = 0,
        ColBarcode,
        ColTitle,
        ColAuthor,
        ColEdition,
        ColPublisher,
        ColYear,
        ColCallNumber,
        ColShelf,
        ColStatus,
        ColPrice,
        ColumnCount
    };

    explicit CatalogModel(QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    int columnCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QVariant headerData(int section, Qt::Orientation orientation, int role = Qt::DisplayRole) const override;

    bool canFetchMore(const QModelIndex &parent) const override;
    void fetchMore(const QModelIndex &parent) override;
    void sort(int column, Qt::SortOrder order = Qt::AscendingOrder) override;

    void setSearchFilter(const QString &search);
    void setCategoryFilter(const QString &category);
    void refresh();

    const Book& getBookAt(int row) const;

private:
    void executeCountQuery();
    void fetchNextBatch();

    QVector<Book> m_books;
    int m_totalCount = 0;
    static constexpr int BATCH_SIZE = 50;

    QString m_searchQuery;
    QString m_categoryFilter;
    int m_sortColumn = ColAccessionNo;
    Qt::SortOrder m_sortOrder = Qt::AscendingOrder;
};
