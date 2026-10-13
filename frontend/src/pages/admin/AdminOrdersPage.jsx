import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import Pagination from '../../components/Pagination';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import OrderDetailSlideOver from '../../components/admin/OrderDetailSlideOver';
import { formatVND } from '../../utils/format';
import {
  ORDER_STATUSES,
  SLUG_BY_STATUS,
  getOrder,
  listOrders,
  statusSlugFromParam,
} from '../../api/adminOrderApi';

/**
 * Quản lý đơn hàng — màn 17 · FR-022 · FR-012 · F-016 (admin-don-hang.md).
 * Tab trạng thái kèm số đếm (statusCounts từ API), tìm mã đơn/tên/SĐT,
 * lọc khoảng ngày + preset, lọc phương thức thanh toán; chi tiết mở
 * slide-over 720px ngay trên trang. Đọc ?trang-thai= (gồm "cho-xu-ly")
 * và ?ma-don= từ Dashboard (§2.5).
 */

const COUNT_KEY = {
  'MỚI': 'MOI',
  'ĐÃ XÁC NHẬN': 'DA_XAC_NHAN',
  'ĐANG GIAO': 'DANG_GIAO',
  'HOÀN THÀNH': 'HOAN_THANH',
  'ĐÃ HỦY': 'DA_HUY',
  'HOÀN TRẢ': 'HOAN_TRA',
};

const METHOD_SHORT = { MOMO: 'Ví MoMo', COD: 'COD', BANK_TRANSFER: 'Chuyển khoản' };

/** Nhãn Title Case tiếng Việt — thuật ngữ hiển thị của màn 11 (không hiện enum thô). */
const TAB_LABEL = {
  'MỚI': 'Mới',
  'ĐÃ XÁC NHẬN': 'Đã xác nhận',
  'ĐANG GIAO': 'Đang giao',
  'HOÀN THÀNH': 'Hoàn thành',
  'ĐÃ HỦY': 'Đã hủy',
  'HOÀN TRẢ': 'Hoàn trả',
};
const PAY_LABEL = {
  'ĐÃ THANH TOÁN': 'Đã thanh toán',
  'CHƯA THANH TOÁN': 'Chưa thanh toán',
  'THẤT BẠI': 'Thất bại',
  'HOÀN TIỀN': 'Hoàn tiền',
};

const PAY_PILL = {
  'ĐÃ THANH TOÁN': 'is-success',
  'CHƯA THANH TOÁN': 'is-muted',
  'THẤT BẠI': 'is-error',
  'HOÀN TIỀN': 'is-refund',
};

const PRESETS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày qua' },
  { key: '30d', label: '30 ngày qua' },
  { key: 'month', label: 'Tháng này' },
];

const pad2 = (n) => String(n).padStart(2, '0');
const toDateInput = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function presetRange(key) {
  const today = new Date();
  if (key === 'today') return { from: toDateInput(today), to: toDateInput(today) };
  if (key === '7d') {
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    return { from: toDateInput(from), to: toDateInput(today) };
  }
  if (key === '30d') {
    const from = new Date(today);
    from.setDate(today.getDate() - 29);
    return { from: toDateInput(from), to: toDateInput(today) };
  }
  if (key === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toDateInput(from), to: toDateInput(today) };
  }
  return { from: '', to: '' };
}

export default function AdminOrdersPage() {
  const { onToast } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const [slug, setSlug] = useState(() => statusSlugFromParam(searchParams.get('trang-thai')));
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('q') || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preset, setPreset] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 1, statusCounts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const debounceRef = useRef(null);
  const deepLinkHandled = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listOrders({
        status: slug === 'tat-ca' ? '' : slug,
        q,
        from,
        to,
        paymentMethod,
        sort: `${sort.key},${sort.dir}`,
        page,
        size: pageSize,
      });
      setData(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [slug, q, from, to, paymentMethod, sort, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  /* ------- Đồng bộ URL: ?trang-thai= + ?ma-don= (history.replace — §2.5) ------- */
  const syncUrl = useCallback(
    (nextSlug, nextDetail) => {
      const params = new URLSearchParams(searchParams);
      if (nextSlug && nextSlug !== 'tat-ca') params.set('trang-thai', nextSlug);
      else params.delete('trang-thai');
      if (nextDetail) params.set('ma-don', nextDetail);
      else params.delete('ma-don');
      params.delete('q');
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  /* ------- Deep-link ?ma-don= từ Dashboard §7: mở sẵn chi tiết (§2.5) ------- */
  useEffect(() => {
    if (deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const maDon = searchParams.get('ma-don');
    if (!maDon) return;
    getOrder(maDon)
      .then(() => setDetailOrder(maDon))
      .catch(() => {
        onToast?.(`Không tìm thấy đơn hàng ${maDon}.`);
        syncUrl(slug, null);
      });
    // Chỉ chạy 1 lần khi vào trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = (orderNumber) => {
    setDetailOrder(orderNumber);
    syncUrl(slug, orderNumber);
  };

  const closeDetail = () => {
    setDetailOrder(null);
    syncUrl(slug, null);
  };

  const changeSlug = (next) => {
    setSlug(next);
    setPage(1);
    syncUrl(next, detailOrder);
  };

  const handleSearchDraft = (value) => {
    setSearchDraft(value);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setQ(value);
      setPage(1);
    }, 300);
  };

  const applyPreset = (key) => {
    const range = presetRange(key);
    setPreset(key);
    setFrom(range.from);
    setTo(range.to);
    setPage(1);
  };

  const hasActiveFilter =
    slug !== 'tat-ca' || q.trim() !== '' || from !== '' || to !== '' || paymentMethod !== '';

  const clearFilters = () => {
    setSlug('tat-ca');
    setQ('');
    setSearchDraft('');
    setFrom('');
    setTo('');
    setPreset('all');
    setPaymentMethod('');
    setPage(1);
    syncUrl('tat-ca', detailOrder);
  };

  const copyCode = async (e, orderNumber) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(orderNumber);
    } catch {
      /* clipboard không khả dụng */
    }
    onToast?.('Đã sao chép mã đơn.');
  };

  const toggleSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
    setPage(1);
  };

  const counts = data.statusCounts || {};
  const tabs = [
    { slug: 'tat-ca', label: 'Tất cả', count: counts.ALL ?? 0 },
    ...ORDER_STATUSES.map((st) => ({
      slug: SLUG_BY_STATUS[st],
      label: TAB_LABEL[st],
      count: counts[COUNT_KEY[st]] ?? 0,
      dot: st === 'MỚI',
    })),
  ];

  const rows = data.content || [];
  const totalPages = Math.max(1, data.totalPages || 1);
  const safePage = Math.min(page, totalPages);
  const isEmpty = !loading && !error && rows.length === 0;
  const noOrdersAtAll = isEmpty && !hasActiveFilter && (counts.ALL ?? 0) === 0;

  const renderTime = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return (
      <>
        <span className="orders-cell__time">
          {pad2(d.getHours())}:{pad2(d.getMinutes())}
        </span>
        <span className="orders-cell__date">
          {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}/{d.getFullYear()}
        </span>
      </>
    );
  };

  const sortArrow = (key) =>
    sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  return (
    <div className="admin-orders">
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-head__title">Đơn hàng</h2>
          <p className="admin-page-head__count">{data.totalElements} đơn</p>
        </div>
      </div>

      <div className="data-table-card">
        {/* §2.1 Tab trạng thái kèm số đếm */}
        <div className="orders-tabs" role="tablist" aria-label="Lọc theo trạng thái">
          {tabs.map((tab) => (
            <button
              key={tab.slug}
              type="button"
              role="tab"
              aria-selected={slug === tab.slug}
              className={`orders-tab${slug === tab.slug ? ' is-active' : ''}`}
              onClick={() => changeSlug(tab.slug)}
            >
              {tab.label} ({tab.count})
              {tab.dot && tab.count > 0 ? (
                <span className="orders-tab__dot" aria-label="Có đơn mới cần xử lý" />
              ) : null}
            </button>
          ))}
          {slug === 'cho-xu-ly' ? (
            <span className="orders-pending-chip">
              Đang lọc: Đơn chờ xử lý
              <button
                type="button"
                aria-label="Xóa lọc đơn chờ xử lý"
                onClick={() => changeSlug('tat-ca')}
              >
                ×
              </button>
            </span>
          ) : null}
        </div>

        {/* §2.2 Thanh công cụ */}
        <div className="data-table__toolbar">
          <div className="data-table__search">
            <span className="data-table__search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => handleSearchDraft(e.target.value)}
              placeholder="Tìm theo mã đơn, tên, SĐT người nhận…"
              aria-label="Tìm theo mã đơn, tên, SĐT người nhận…"
            />
          </div>
          <div className="orders-date-filter">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset('custom');
                setPage(1);
              }}
              aria-label="Từ ngày"
            />
            <span aria-hidden="true">–</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset('custom');
                setPage(1);
              }}
              aria-label="Đến ngày"
            />
          </div>
          <select
            className="admin-filter-select"
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo phương thức thanh toán"
          >
            <option value="">Tất cả phương thức</option>
            <option value="MOMO">Ví MoMo</option>
            <option value="COD">COD</option>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
          </select>
        </div>
        <div className="orders-presets" aria-label="Khoảng ngày nhanh">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`orders-preset${preset === p.key ? ' is-active' : ''}`}
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
          {preset === 'custom' ? <span className="orders-preset is-active">Tùy chọn</span> : null}
        </div>

        {/* §2.3 Bảng đơn */}
        <div className="data-table__scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Số món</th>
                <th className="is-sortable" onClick={() => toggleSort('total')}>
                  Tổng tiền<span className="data-table__sort-arrow">{sortArrow('total')}</span>
                </th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th className="is-sortable" onClick={() => toggleSort('createdAt')}>
                  Thời gian tạo
                  <span className="data-table__sort-arrow">{sortArrow('createdAt')}</span>
                </th>
                <th className="is-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="data-table__skeleton-row">
                    <td colSpan={8}>
                      <div className="skeleton data-table__skel" aria-hidden="true" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={8}>
                    <div className="data-table__state">
                      <p>Không tải được dữ liệu.</p>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                        Thử lại
                      </button>
                    </div>
                  </td>
                </tr>
              ) : isEmpty ? (
                <tr>
                  <td colSpan={8}>
                    <div className="data-table__state">
                      {noOrdersAtAll ? (
                        <>
                          <p>Chưa có đơn hàng nào.</p>
                          <p className="orders-empty__sub">
                            Đơn hàng sẽ xuất hiện tại đây khi khách đặt mua.
                          </p>
                        </>
                      ) : (
                        <>
                          <p>Không tìm thấy đơn hàng phù hợp.</p>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={clearFilters}
                          >
                            Xóa bộ lọc
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((o) => (
                  <tr
                    key={o.orderNumber}
                    className="is-clickable"
                    onClick={() => openDetail(o.orderNumber)}
                  >
                    <td>
                      <span className="orders-cell__code-wrap">
                        <span className="orders-cell__code">{o.orderNumber}</span>
                        <button
                          type="button"
                          className="orders-cell__copy"
                          title="Sao chép mã đơn"
                          aria-label={`Sao chép mã đơn ${o.orderNumber}`}
                          onClick={(e) => copyCode(e, o.orderNumber)}
                        >
                          ⧉
                        </button>
                      </span>
                    </td>
                    <td>
                      <span className="orders-cell__customer">{o.customerName}</span>
                      <span className="orders-cell__phone">{o.customerPhone}</span>
                    </td>
                    <td>
                      {o.itemCount}
                      {o.itemKinds > 1 ? (
                        <span className="orders-cell__kinds"> ({o.itemKinds} loại)</span>
                      ) : null}
                    </td>
                    <td className="orders-cell__total">{formatVND(o.total)}</td>
                    <td>
                      <span className="orders-cell__method">
                        {METHOD_SHORT[o.paymentMethod] || o.paymentMethod}
                      </span>
                      <span className={`admin-pill orders-pay-pill ${PAY_PILL[o.paymentStatus] || 'is-muted'}`}>
                        {PAY_LABEL[o.paymentStatus] || o.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td>{renderTime(o.createdAt)}</td>
                    <td className="is-right">
                      <button
                        type="button"
                        className="row-action-btn"
                        title="Xem chi tiết đơn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(o.orderNumber);
                        }}
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* §2.4 Phân trang */}
        {!loading && !error && rows.length > 0 ? (
          <div className="data-table__footer">
            <span className="data-table__pageinfo">
              Trang {safePage} / {totalPages} · Tổng {data.totalElements} đơn
            </span>
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
            <label className="data-table__pagesize">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Số đơn mỗi trang"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / trang
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {detailOrder ? (
        <OrderDetailSlideOver
          key={detailOrder}
          orderNumber={detailOrder}
          onClose={closeDetail}
          onToast={onToast}
          onChanged={load}
        />
      ) : null}
    </div>
  );
}
