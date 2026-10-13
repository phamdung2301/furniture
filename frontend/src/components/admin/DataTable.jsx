import { useEffect, useRef, useState } from 'react';
import Pagination from '../Pagination';

/**
 * Bảng dữ liệu dùng chung cho các màn quản lý 15–22 — quy ước §B.1.
 * Component có điều khiển (controlled): cha giữ state tìm kiếm/sort/trang.
 *
 * columns: [{ key, label, sortable?, align?: 'left'|'right'|'center',
 *             render?: (row) => node }]
 * Trạng thái: loading → 5 hàng skeleton; rỗng → "Chưa có dữ liệu." (+ nút
 * xóa bộ lọc khi đang lọc); lỗi → message + "Thử lại".
 */
export default function DataTable({
  columns,
  rows = [],
  rowKey = (row) => row.id,
  loading = false,
  error = null,
  onRetry,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm…',
  toolbarRight = null,
  filters = null,
  sort = null, // { key, dir: 'asc'|'desc' }
  onSortChange,
  page = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  emptyText = 'Chưa có dữ liệu.',
  hasActiveFilter = false,
  onClearFilter,
  onRowClick,
  // Props tùy chọn (màn 18 Tồn kho): khối trên thanh công cụ (hàng chips),
  // text lỗi riêng, nút hành động ở trạng thái rỗng, class cho từng dòng
  // (highlight), nhãn đơn vị ở chân phân trang ("biến thể"…). Mặc định giữ
  // nguyên hành vi cũ cho các màn 15–17.
  toolbarTop = null,
  errorText = 'Không tải được dữ liệu.',
  emptyAction = null,
  rowClassName,
  itemLabel = 'mục',
  // Ghi chú chân bảng (màn 20 Khách hàng §2.4): dòng nhỏ dưới bảng, trên
  // phân trang. Mặc định null = giữ nguyên hành vi các màn cũ.
  footerNote = null,
}) {
  const [searchDraft, setSearchDraft] = useState(searchValue);
  const debounceRef = useRef(null);

  useEffect(() => {
    setSearchDraft(searchValue);
  }, [searchValue]);

  // Tìm kiếm debounce 300ms (§B.1).
  const handleSearch = (value) => {
    setSearchDraft(value);
    if (!onSearchChange) return;
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => onSearchChange(value), 300);
  };

  const toggleSort = (col) => {
    if (!col.sortable || !onSortChange) return;
    if (sort?.key === col.key) {
      onSortChange({ key: col.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ key: col.key, dir: 'asc' });
    }
  };

  return (
    <div className="data-table-card">
      {toolbarTop}
      <div className="data-table__toolbar">
        <div className="data-table__search">
          <span className="data-table__search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
        {filters}
        <div className="data-table__toolbar-right">{toolbarRight}</div>
      </div>

      <div className="data-table__scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={[
                      col.align === 'right' ? 'is-right' : '',
                      col.align === 'center' ? 'is-center' : '',
                      col.sortable ? 'is-sortable' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => toggleSort(col)}
                    aria-sort={
                      active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    {col.label}
                    {col.sortable ? (
                      <span className="data-table__sort-arrow" aria-hidden="true">
                        {active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                      </span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className="data-table__skeleton-row">
                  <td colSpan={columns.length}>
                    <div className="skeleton data-table__skel" aria-hidden="true" />
                  </td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="data-table__state">
                    <p>{errorText}</p>
                    {onRetry ? (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
                        Thử lại
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="data-table__state">
                    <p>{emptyText}</p>
                    {emptyAction}
                    {hasActiveFilter && onClearFilter ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={onClearFilter}
                      >
                        Xóa bộ lọc
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={[
                    onRowClick ? 'is-clickable' : '',
                    rowClassName ? rowClassName(row) : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        col.align === 'right' ? 'is-right' : '',
                        col.align === 'center' ? 'is-center' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && !error && footerNote ? (
        <p className="data-table__note">{footerNote}</p>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="data-table__footer">
          <span className="data-table__pageinfo">
            Trang {page} / {Math.max(1, totalPages)} · Tổng {totalItems} {itemLabel}
          </span>
          <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
          {onPageSizeChange ? (
            <label className="data-table__pagesize">
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label="Số mục mỗi trang"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / trang
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
