import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/admin/DataTable';
import CustomerAccountBadge from '../../components/admin/CustomerAccountBadge';
import CustomerLockDialog from '../../components/admin/CustomerLockDialog';
import CustomerDetailSlideOver from '../../components/admin/CustomerDetailSlideOver';
import { listCustomers, unlockCustomer } from '../../api/adminCustomerApi';
import { formatPhoneVN, formatVND } from '../../utils/format';

/**
 * Quản lý khách hàng — màn 20 · FR-025 · F-019 (admin-khach-hang.md).
 * Danh sách chỉ ROLE_CUSTOMER (BE lọc); tìm tên/SĐT/email, lọc trạng thái
 * tài khoản + xác thực SĐT, sort ngày đăng ký / tổng chi tiêu, phân trang.
 * Chi tiết mở slide-over 640px ngay trên trang; deep-link ?khach=<id> mở
 * sẵn. Hành động duy nhất: Khóa (confirm §4.2) / Mở khóa (làm ngay §4.5) —
 * TUYỆT ĐỐI không có xóa khách (§4.6). Lọc đồng bộ lên query string
 * (?q=&trang-thai=&sdt=) như pattern màn 17.
 */

const pad2 = (n) => String(n).padStart(2, '0');

/** "dd/MM/yyyy" — §2.2 cột Ngày đăng ký. */
function formatDateOnly(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function AdminCustomersPage() {
  const { onToast } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [status, setStatus] = useState(() => searchParams.get('trang-thai') || '');
  const [verified, setVerified] = useState(() => searchParams.get('sdt') || '');
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1); // UI 1-indexed; API page 0-indexed (§7)
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailId, setDetailId] = useState(() => searchParams.get('khach') || null);
  const [lockTarget, setLockTarget] = useState(null);
  const [unlockingId, setUnlockingId] = useState(null);
  const deepLinkHandled = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCustomers({
        q,
        status,
        verified: verified === '' ? '' : verified === 'true',
        page: page - 1,
        size: pageSize,
        sort: `${sort.key},${sort.dir}`,
      });
      setData({ items: res?.items || [], total: res?.total || 0 });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [q, status, verified, page, pageSize, sort]);

  useEffect(() => {
    load();
  }, [load]);

  /* ------- Đồng bộ URL: ?q=&trang-thai=&sdt=&khach= (history.replace) ------- */
  const syncUrl = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams);
      if (next.q) params.set('q', next.q);
      else params.delete('q');
      if (next.status) params.set('trang-thai', next.status);
      else params.delete('trang-thai');
      if (next.verified) params.set('sdt', next.verified);
      else params.delete('sdt');
      if (next.detailId) params.set('khach', next.detailId);
      else params.delete('khach');
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const syncFilters = (patch, nextDetailId = detailId) =>
    syncUrl({ q, status, verified, detailId: nextDetailId, ...patch });

  /* ------- Deep-link ?khach=<id>: mở sẵn slide-over (§3) ------- */
  useEffect(() => {
    if (deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    if (searchParams.get('khach')) setDetailId(searchParams.get('khach'));
    // Chỉ chạy 1 lần khi vào trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = (row) => {
    setDetailId(row.id);
    syncFilters({}, row.id);
  };

  const closeDetail = () => {
    setDetailId(null);
    syncFilters({}, null);
  };

  /* ------------------------- Khóa / mở khóa (§4) ------------------------- */

  // Cập nhật 1 hàng tại chỗ sau khi API xác nhận — không tải lại trang (§4.2).
  const applyRowUpdate = useCallback((updated) => {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
    }));
  }, []);

  // Mở khóa: làm ngay, không confirm (§4.5).
  const handleUnlock = async (row) => {
    setUnlockingId(row.id);
    try {
      const updated = await unlockCustomer(row.id);
      applyRowUpdate(updated);
      onToast?.(`Đã mở khóa tài khoản của ${row.fullName}.`);
    } catch (e) {
      onToast?.(e?.message || 'Không mở khóa được tài khoản. Vui lòng thử lại.');
      load();
    } finally {
      setUnlockingId(null);
    }
  };

  /* ------------------------------ Bộ lọc ------------------------------ */

  const hasFilter = Boolean(q.trim() || status || verified);

  const clearFilters = () => {
    setQ('');
    setStatus('');
    setVerified('');
    setPage(1);
    syncUrl({ q: '', status: '', verified: '', detailId });
  };

  /* ------------------------------ Cột bảng (§2.2) ------------------------------ */

  const columns = [
    {
      key: 'fullName',
      label: 'Khách hàng',
      render: (row) => (
        <span className="customer-cell">
          {row.avatarUrl ? (
            <img className="customer-avatar" src={row.avatarUrl} alt="" />
          ) : (
            <span className="customer-avatar" aria-hidden="true">
              {(row.fullName || '?').trim().charAt(0)}
            </span>
          )}
          <span className="customer-cell__name">{row.fullName}</span>
        </span>
      ),
    },
    {
      key: 'phone',
      label: 'Số điện thoại',
      render: (row) => (
        <span className="customer-cell customer-cell--col">
          <span className="customer-cell__phone">{formatPhoneVN(row.phone)}</span>
          <span
            className={`customer-badge ${
              row.phoneVerified ? 'is-verified' : 'is-unverified'
            }`}
          >
            {row.phoneVerified ? 'Đã xác thực' : 'Chưa xác thực'}
          </span>
        </span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (row) => (
        <span className="customer-cell__email" title={row.email}>
          {row.email}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Ngày đăng ký',
      sortable: true,
      render: (row) => formatDateOnly(row.createdAt),
    },
    {
      key: 'orderCount',
      label: 'Số đơn',
      align: 'center',
      render: (row) => row.orderCount,
    },
    {
      key: 'totalSpent',
      label: 'Tổng chi tiêu',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="customer-cell__money">{formatVND(row.totalSpent)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <CustomerAccountBadge customer={row} />,
    },
    {
      key: 'actions',
      label: 'Hành động',
      align: 'right',
      render: (row) => {
        const busy = unlockingId === row.id;
        return (
          <span className="row-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="row-action-btn"
              title="Xem chi tiết"
              onClick={() => openDetail(row)}
            >
              Xem
            </button>
            {row.status === 'LOCKED' ? (
              <button
                type="button"
                className="row-action-btn"
                title="Mở khóa tài khoản"
                onClick={() => handleUnlock(row)}
                disabled={busy}
              >
                {busy ? 'Đang xử lý…' : 'Mở khóa'}
              </button>
            ) : (
              <button
                type="button"
                className="row-action-btn is-danger"
                title="Khóa tài khoản"
                onClick={() => setLockTarget(row)}
              >
                Khóa
              </button>
            )}
          </span>
        );
      },
    },
  ];

  const filtersNode = (
    <>
      <select
        className="admin-filter-select"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
          syncFilters({ status: e.target.value });
        }}
        aria-label="Lọc theo trạng thái tài khoản"
      >
        <option value="">Tất cả trạng thái</option>
        <option value="ACTIVE">Hoạt động</option>
        <option value="LOCKED">Đã khóa</option>
      </select>
      <select
        className="admin-filter-select"
        value={verified}
        onChange={(e) => {
          setVerified(e.target.value);
          setPage(1);
          syncFilters({ verified: e.target.value });
        }}
        aria-label="Lọc theo xác thực số điện thoại"
      >
        <option value="">Tất cả số điện thoại</option>
        <option value="true">Đã xác thực</option>
        <option value="false">Chưa xác thực</option>
      </select>
    </>
  );

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div className="admin-customers">
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-head__title">Khách hàng</h2>
          <p className="admin-page-head__count">{data.total} khách hàng</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data.items}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        errorText="Không tải được dữ liệu."
        onRetry={load}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
          syncFilters({ q: v });
        }}
        searchPlaceholder="Tìm theo tên, số điện thoại, email…"
        filters={filtersNode}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        totalItems={data.total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        emptyText={
          hasFilter
            ? 'Không tìm thấy khách hàng nào phù hợp.'
            : 'Chưa có khách hàng nào.'
        }
        hasActiveFilter={hasFilter}
        onClearFilter={clearFilters}
        footerNote="Tổng chi tiêu chỉ tính các đơn đã hoàn thành. Số đơn tính tất cả đơn khách đã đặt."
        onRowClick={openDetail}
        itemLabel="khách hàng"
      />

      {detailId ? (
        <CustomerDetailSlideOver
          key={detailId}
          customerId={detailId}
          onClose={closeDetail}
          onToast={onToast}
          onChanged={applyRowUpdate}
        />
      ) : null}

      <CustomerLockDialog
        customer={lockTarget}
        onClose={() => setLockTarget(null)}
        onLocked={applyRowUpdate}
        onToast={onToast}
      />
    </div>
  );
}
