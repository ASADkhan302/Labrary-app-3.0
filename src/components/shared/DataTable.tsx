import React from 'react';

export interface ColumnDef<T> {
  header: React.ReactNode;
  accessorKey?: keyof T | string;
  cell?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T, index: number) => string;
  emptyState?: React.ReactNode;
  className?: string;
  rowHeightClass?: string; // e.g. 'h-12' or 'h-[52px]'
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyState,
  className = '',
  rowHeightClass = 'min-h-[48px]',
}: DataTableProps<T>) {
  if (!data || data.length === 0) {
    return emptyState ? (
      <>{emptyState}</>
    ) : (
      <div className="py-12 text-center text-[#B3AABD] text-[13px] bg-[#1A1A1A] border border-[#2E2A33] rounded-[14px]">
        No records found.
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden rounded-[14px] border border-[#2E2A33] bg-[#1A1A1A] shadow-md ${className}`}>
      <div className="w-full overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[700px] border-collapse text-left text-[13px]">
          {/* Sticky Header on Surface-2 */}
          <thead className="sticky top-0 z-10 bg-[#221F26] border-b border-[#2E2A33]">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#B3AABD] font-mono whitespace-nowrap select-none ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body with Surface-3 Hover */}
          <tbody className="divide-y divide-[#2E2A33]/80">
            {data.map((item, rowIdx) => (
              <tr
                key={keyExtractor(item, rowIdx)}
                className={`transition-colors duration-100 hover:bg-[#2B2730] group ${rowHeightClass}`}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className={`px-4 py-3 text-[#E7E2EC] ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    } ${col.className || ''}`}
                  >
                    {col.cell
                      ? col.cell(item, rowIdx)
                      : (item as Record<string, unknown>)[col.accessorKey as string] as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
