'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Có hàm này thì cột được sắp xếp khi bấm vào tiêu đề. */
  sort?: (row: T) => string | number;
  className?: string;
  width?: number | string;
};

type Sort = { key: string; dir: 'asc' | 'desc' };

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty: ReactNode;
  pageSize?: number;
  defaultSort?: Sort;
  minWidth?: number;
  /** Đổi giá trị này (ví dụ chuỗi bộ lọc) để quay về trang 1. */
  resetKey?: string;
};

export function DataTable<T>({ columns, rows, rowKey, loading, empty, pageSize = 10, defaultSort, minWidth = 720, resetKey }: DataTableProps<T>) {
  const [sort, setSort] = useState<Sort | undefined>(defaultSort);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [resetKey]);

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort?.key);
    if (!sort || !column?.sort) return rows;
    const getValue = column.sort;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = getValue(a);
      const y = getValue(b);
      const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'vi', { numeric: true, sensitivity: 'base' });
      return result * factor;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key: string) =>
    setSort((value) => (value?.key === key ? { key, dir: value.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <>
      <div className="table-scroll">
        <table className="table" style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((column) => {
                const dir = sort?.key === column.key ? sort.dir : undefined;
                return (
                  <th
                    key={column.key}
                    className={column.className}
                    style={{ width: column.width }}
                    aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {column.sort ? (
                      <button type="button" className={`th-sort${dir ? ' is-active' : ''}`} onClick={() => toggleSort(column.key)}>
                        {column.header}
                        <Icon name={dir ? (dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'chevrons-up-down'} size={13} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, index) => (
                  <tr key={index} aria-hidden="true">
                    {columns.map((column) => (
                      <td key={column.key}>
                        <span className="skeleton" style={{ width: `${55 + ((index * 17 + column.key.length * 7) % 40)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((row) => (
                  <tr key={rowKey(row)}>
                    {columns.map((column) => (
                      <td key={column.key} className={column.className}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && !rows.length && <div className="table-empty">{empty}</div>}
      {!loading && pageCount > 1 && (
        <Pagination page={current} pageCount={pageCount} total={sorted.length} pageSize={pageSize} onChange={setPage} />
      )}
    </>
  );
}

function pageList(page: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap' as const, p] : [p]));
}

function Pagination({ page, pageCount, total, pageSize, onChange }: { page: number; pageCount: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav className="pagination" aria-label="Phân trang">
      <span>
        Hiển thị <strong>{from}–{to}</strong> trong <strong>{total}</strong>
      </span>
      <div className="pagination-pages">
        <button type="button" className="page-btn" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Trang trước">
          <Icon name="chevron-left" size={16} />
        </button>
        {pageList(page, pageCount).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="page-gap">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`page-btn${item === page ? ' is-current' : ''}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button type="button" className="page-btn" onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Trang sau">
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </nav>
  );
}
