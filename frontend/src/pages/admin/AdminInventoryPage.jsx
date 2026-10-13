import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/admin/DataTable';
import StockAdjustModal, {
  StockStatusBadge,
} from '../../components/admin/StockAdjustModal';
import { formatVND } from '../../utils/format';
import { listCategories } from '../../api/adminProductApi';
import { listInventory, updateThreshold } from '../../api/adminInventoryApi';

/**
 * Quản lý tồn kho — màn 18 · FR-023 · F-017 · US-015 (admin-ton-kho.md).
 * 1 dòng = 1 biến thể màu. Chips Tất cả/Sắp hết/Hết hàng kèm counts từ API;
 * đọc ?trang-thai=sap-het|het-hang và ?sku= từ Dashboard (§4);
 * sửa ngưỡng inline tại ô; điều chỉnh tồn qua StockAdjustModal (§5).
 */

const STATUS_TABS = [
  { key: 'all', label: 'Tất cả', param: null },
  { key: 'low', label: 'Sắp hết', param: 'sap-het', dot: 'is-warning' },
  { key: 'out', label: 'Hết hàng', param: 'het-hang', dot: 'is-error' },
];

function statusFromParam(param) {
  if (param === 'sap-het') return 'low';
  if (param === 'het-hang') return 'out';
  return 'all';
}

// Sort của DataTable {key, dir} <-> sort param của API (§9).
const SORT_TO_API = {
  name: (dir) => (dir === 'desc' ? 'name_desc' : 'name_asc'),
  price: (dir) => (dir === 'desc' ? 'price_desc' : 'price_asc'),
  stock: (dir) => (dir === 'desc' ? 'stock_desc' : 'stock_asc'),
};
const API_TO_SORT = {
  stock_asc: { key: 'stock', dir: 'asc' },
  stock_desc: { key: 'stock', dir: 'desc' },
  price_asc: { key: 'price', dir: 'asc' },
  price_desc: { key: 'price', dir: 'desc' },
  name_asc: { key: 'name', dir: 'asc' },
  name_desc: { key: 'name', dir: 'desc' },
};

/** Ô ngưỡng cảnh báo sửa inline (§6): Enter/✓ lưu · Esc/✕ hủy. */
function ThresholdCell({ row, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(String(row.lowStockThreshold));
    setError('');
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError('');
  };

  const save = async () => {
    const value = Number(draft);
    if (draft.trim() === '' || !Number.isInteger(value) || value < 0) {
      setError('Ngưỡng phải là số nguyên ≥ 0.');
      return;
    }
    if (value === row.lowStockThreshold) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(row.variantId, value);
      setEditing(false);
    } catch {
      // onSave đã toast lý do cụ thể; khôi phục số cũ bằng cách thoát sửa.
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      // Click vào số hoặc icon bút chì đều mở sửa inline (§6).
      <span className="inv-threshold" onClick={startEdit} title="Sửa ngưỡng">
        <span>{row.lowStockThreshold}</span>
        <button
          type="button"
          className="inv-threshold__edit"
          onClick={startEdit}
          title="Sửa ngưỡng"
          aria-label={`Sửa ngưỡng cảnh báo của ${row.sku}`}
        >
          ✎
        </button>
      </span>
    );
  }

  return (
    <span className="inv-threshold inv-threshold--editing" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className={`inv-threshold__input${error ? ' has-error' : ''}`}
        type="number"
        min="0"
        step="1"
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') cancel();
        }}
        aria-label="Ngưỡng cảnh báo"
        aria-invalid={error ? 'true' : undefined}
      />
      <button
        type="button"
        className="inv-threshold__btn"
        onClick={save}
        disabled={saving}
        title="Lưu ngưỡng"
        aria-label="Lưu ngưỡng"
      >
        {saving ? <span className="inv-spinner" aria-hidden="true" /> : '✓'}
      </button>
      <button
        type="button"
        className="inv-threshold__btn"
        onClick={cancel}
        disabled={saving}
        title="Hủy"
        aria-label="Hủy sửa ngưỡng"
      >
        ✕
      </button>
      {error ? <span className="inv-threshold__error">{error}</span> : null}
    </span>
  );
}

export default function AdminInventoryPage() {
  const { onToast } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [status, setStatus] = useState(() => statusFromParam(searchParams.get('trang-thai')));
  const [q, setQ] = useState(() => searchParams.get('sku') || searchParams.get('q') || '');
  const [categoryId, setCategoryId] = useState('');
  const [sortApi, setSortApi] = useState('stock_asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState({
    content: [],
    totalElements: 0,
    totalPages: 1,
    counts: { all: 0, low: 0, out: 0 },
  });
  const [counts, setCounts] = useState(null); // null = chưa tải được lần nào
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [adjustRow, setAdjustRow] = useState(null);
  // SKU cần highlight từ deep-link Dashboard (§4): nền sáng 2 giây rồi mờ dần.
  const [highlightSku, setHighlightSku] = useState(() => searchParams.get('sku') || '');

  useEffect(() => {
    let cancelled = false;
    listCategories()
      .then((cats) => {
        if (!cancelled) setCategories(cats || []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listInventory({
        status,
        q,
        categoryId,
        sort: sortApi,
        page,
        size: pageSize,
      });
      setData(res);
      setCounts(res.counts);
      // API đã clamp trang (trang cuối rỗng sau khi dòng rời bộ lọc) — bám theo.
      if (res.page && res.page !== page) setPage(res.page);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [status, q, categoryId, sortApi, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  /* Đồng bộ ?trang-thai= khi admin đổi chip (history.replace — §4). */
  const syncStatusParam = useCallback(
    (nextStatus) => {
      const params = new URLSearchParams(searchParams);
      const tab = STATUS_TABS.find((t) => t.key === nextStatus);
      if (tab?.param) params.set('trang-thai', tab.param);
      else params.delete('trang-thai');
      params.delete('sku');
      params.delete('q');
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const changeStatus = (next) => {
    setStatus(next);
    setPage(1);
    syncStatusParam(next);
  };

  const clearFilters = () => {
    setQ('');
    setCategoryId('');
    setHighlightSku('');
    setPage(1);
    changeStatus('all');
  };

  const categoryOptions = useMemo(() => {
    const roots = categories.filter((c) => !c.parentId);
    const out = [];
    roots.forEach((r) => {
      out.push({ id: r.id, label: r.name });
      categories
        .filter((c) => c.parentId === r.id)
        .forEach((c) => out.push({ id: c.id, label: `— ${c.name}` }));
    });
    categories
      .filter((c) => c.parentId && !roots.some((r) => r.id === c.parentId))
      .forEach((c) => out.push({ id: c.id, label: c.name }));
    return out;
  }, [categories]);

  const copySku = async (e, sku) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(sku);
    } catch {
      /* clipboard không khả dụng */
    }
    onToast?.('Đã sao chép SKU.');
  };

  const goToProduct = (row) => navigate(`/admin/san-pham?q=${encodeURIComponent(row.sku)}`);

  const handleThresholdSave = async (variantId, value) => {
    try {
      await updateThreshold(variantId, { lowStockThreshold: value });
      onToast?.('Đã cập nhật ngưỡng cảnh báo.');
      // Badge dòng + thẻ tổng quan + badge sidebar tính lại theo số mới (§6).
      window.dispatchEvent(new Event('mocan:badges-refresh'));
      load();
    } catch (e) {
      onToast?.(e?.message || 'Không cập nhật được ngưỡng cảnh báo.');
      throw e;
    }
  };

  const handleAdjusted = (res) => {
    const row = adjustRow;
    setAdjustRow(null);
    onToast?.(
      `Đã cập nhật tồn kho: ${row.productName} — ${row.color} còn ${res.stock}.`
    );
    window.dispatchEvent(new Event('mocan:badges-refresh'));
    // Tải lại đúng trang + bộ lọc hiện tại (§5.5): dòng có thể rời chip Sắp hết.
    load();
  };

  /* ------------------------------ Trạng thái rỗng (§10) ------------------------------ */
  const hasSearchFilter = Boolean(q.trim() || categoryId);
  const emptyState = (() => {
    if (error || loading) return { text: '', action: null };
    if ((counts?.all ?? data.counts.all) === 0 && !hasSearchFilter && status === 'all') {
      return {
        text: 'Chưa có biến thể nào. Biến thể được tạo khi thêm sản phẩm.',
        action: (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/admin/san-pham')}
          >
            Đến Quản lý sản phẩm
          </button>
        ),
      };
    }
    if (hasSearchFilter) return { text: 'Không tìm thấy biến thể phù hợp.', action: null };
    if (status === 'low') return { text: '✓ Tất cả biến thể đều đủ tồn kho.', action: null };
    if (status === 'out') return { text: 'Không có biến thể nào hết hàng.', action: null };
    return { text: 'Chưa có biến thể nào. Biến thể được tạo khi thêm sản phẩm.', action: null };
  })();

  /* ---------------------------------- Cột bảng ---------------------------------- */
  const columns = [
    {
      key: 'name',
      label: 'Sản phẩm',
      sortable: true,
      render: (row) => (
        <div className="prod-cell inv-product-cell">
          {row.image ? (
            <img className="prod-cell__img" src={row.image} alt="" />
          ) : (
            <span className="prod-cell__img prod-cell__img--empty" aria-hidden="true">
              🛋️
            </span>
          )}
          <span className="prod-cell__meta">
            <span className="prod-cell__name">
              {row.productName}
              {!row.productActive ? (
                <span className="admin-pill is-muted inv-inactive-badge">Ngừng bán</span>
              ) : null}
            </span>
            <span className="inv-product-cell__color">
              <span
                className="color-dot"
                style={{ background: row.colorHex || 'transparent' }}
                aria-hidden="true"
              />
              {row.color}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (row) => (
        <span className="inv-sku">
          <span className="inv-sku__text">{row.sku}</span>
          <button
            type="button"
            className="orders-cell__copy"
            title="Sao chép SKU"
            aria-label={`Sao chép SKU ${row.sku}`}
            onClick={(e) => copySku(e, row.sku)}
          >
            ⧉
          </button>
        </span>
      ),
    },
    {
      key: 'price',
      label: 'Giá bán',
      sortable: true,
      align: 'right',
      render: (row) => <span className="inv-price">{formatVND(row.price)}</span>,
    },
    {
      key: 'stock',
      label: 'Tồn hiện tại',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span
          className={`inv-stock${
            row.stock === 0 ? ' is-error' : row.stock <= row.lowStockThreshold ? ' is-warning' : ''
          }`}
        >
          {row.stock}
        </span>
      ),
    },
    {
      key: 'threshold',
      label: 'Ngưỡng cảnh báo',
      align: 'right',
      render: (row) => <ThresholdCell row={row} onSave={handleThresholdSave} />,
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (
        <StockStatusBadge stock={row.stock} lowStockThreshold={row.lowStockThreshold} />
      ),
    },
    {
      key: 'actions',
      label: 'Hành động',
      align: 'right',
      render: (row) => (
        <span className="row-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => setAdjustRow(row)}
            title="Điều chỉnh tồn kho"
          >
            Điều chỉnh tồn
          </button>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => goToProduct(row)}
            title="Sửa ở Sản phẩm"
            aria-label={`Sửa ${row.productName} ở màn Sản phẩm`}
          >
            ↗
          </button>
        </span>
      ),
    },
  ];

  const chipsNode = (
    <div className="inv-chips" role="group" aria-label="Lọc theo trạng thái tồn">
      {STATUS_TABS.map((tab) => {
        const count = counts ? counts[tab.key] : null;
        return (
          <button
            key={tab.key}
            type="button"
            className={`inv-chip${status === tab.key ? ' is-active' : ''}`}
            onClick={() => changeStatus(tab.key)}
            aria-pressed={status === tab.key}
          >
            {tab.dot ? <span className={`inv-chip__dot ${tab.dot}`} aria-hidden="true" /> : null}
            {tab.label} ({count == null ? '…' : count})
          </button>
        );
      })}
    </div>
  );

  const filtersNode = (
    <select
      className="admin-filter-select"
      value={categoryId}
      onChange={(e) => {
        setCategoryId(e.target.value);
        setPage(1);
      }}
      aria-label="Lọc theo danh mục"
    >
      <option value="">Tất cả danh mục</option>
      {categoryOptions.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );

  const summaryCards = [
    { key: 'low', label: 'Sắp hết', value: counts?.low, statusKey: 'low' },
    { key: 'out', label: 'Hết hàng', value: counts?.out, statusKey: 'out' },
    { key: 'all', label: 'Tổng số biến thể', value: counts?.all, statusKey: 'all' },
  ];

  return (
    <div className="admin-inventory">
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-head__title">Quản lý tồn kho</h2>
          <p className="admin-page-head__count">{data.totalElements} biến thể</p>
        </div>
      </div>

      {/* §2.2 Thẻ tổng quan — bấm để áp chip lọc tương ứng */}
      <section className="inv-summary" aria-label="Tổng quan tồn kho">
        {summaryCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`inv-summary__card${status === card.statusKey ? ' is-active' : ''}`}
            onClick={() => changeStatus(card.statusKey)}
          >
            <span className="inv-summary__label">{card.label}</span>
            {loading && counts == null ? (
              <span className="skeleton inv-summary__skel" aria-hidden="true" />
            ) : counts == null ? (
              <span className="inv-summary__error">
                —
                <span
                  className="inv-summary__retry"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    load();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      load();
                    }
                  }}
                >
                  Thử lại
                </span>
              </span>
            ) : (
              <span className="inv-summary__value">{card.value}</span>
            )}
          </button>
        ))}
      </section>

      <DataTable
        columns={columns}
        rows={data.content}
        rowKey={(row) => row.variantId}
        loading={loading}
        error={error}
        errorText="Không tải được dữ liệu tồn kho."
        onRetry={load}
        toolbarTop={chipsNode}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setHighlightSku('');
          setPage(1);
        }}
        searchPlaceholder="Tìm theo tên sản phẩm, màu, SKU…"
        filters={filtersNode}
        sort={API_TO_SORT[sortApi]}
        onSortChange={({ key, dir }) => {
          const toApi = SORT_TO_API[key];
          if (toApi) setSortApi(toApi(dir));
          setPage(1);
        }}
        page={page}
        totalPages={data.totalPages}
        totalItems={data.totalElements}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        emptyText={emptyState.text}
        emptyAction={emptyState.action}
        hasActiveFilter={hasSearchFilter}
        onClearFilter={clearFilters}
        onRowClick={goToProduct}
        rowClassName={(row) =>
          highlightSku && row.sku === highlightSku ? 'inv-row--highlight' : ''
        }
        itemLabel="biến thể"
      />

      {adjustRow ? (
        <StockAdjustModal
          key={adjustRow.variantId}
          row={adjustRow}
          onClose={() => setAdjustRow(null)}
          onSaved={handleAdjusted}
          onToast={onToast}
        />
      ) : null}
    </div>
  );
}
