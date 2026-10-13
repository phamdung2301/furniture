import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import DataTable from '../../components/admin/DataTable';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import VoucherFormSlideOver from '../../components/admin/VoucherFormSlideOver';
import {
  deleteVoucher,
  listVouchers,
  patchVoucher,
  voucherStatus,
} from '../../api/adminVoucherApi';
import { listCategories } from '../../api/adminCategoryApi';
import { listProducts } from '../../api/adminProductApi';
import { formatDateTime, formatVND } from '../../utils/format';

/**
 * Quản lý voucher — màn 19 · FR-024 · F-018 · US-017 (admin-voucher.md).
 * Bảng voucher THƯỜNG (API đã loại FLASH_SALE, FE lọc thêm ở api module);
 * trạng thái badge SUY RA theo §2.3; tắt voucher đang chạy qua confirm
 * hậu quả §4.1; xóa chỉ khi chưa từng được dùng (§4.2).
 */

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'RUNNING', label: 'Đang chạy' },
  { value: 'UPCOMING', label: 'Sắp chạy' },
  { value: 'EXPIRED', label: 'Hết hạn' },
  { value: 'EXHAUSTED', label: 'Hết lượt' },
  { value: 'INACTIVE', label: 'Đã tắt' },
];

const BADGE_CLASS = {
  RUNNING: 'is-running',
  UPCOMING: 'is-upcoming',
  EXPIRED: 'is-muted',
  EXHAUSTED: 'is-exhausted',
  INACTIVE: 'is-muted',
};

/** Dòng phụ thời gian (§2.2 cột 4): sắp chạy / sắp hết hạn / đã kết thúc. */
function relativeNote(row, statusKey) {
  const now = new Date();
  if (statusKey === 'UPCOMING' && row.startAt) {
    const diff = new Date(row.startAt) - now;
    const days = Math.ceil(diff / 86400000);
    if (days >= 1) return { text: `Bắt đầu sau ${days} ngày` };
    return { text: `Bắt đầu sau ${Math.max(1, Math.ceil(diff / 3600000))} giờ` };
  }
  if (statusKey === 'RUNNING' && row.endAt) {
    const remain = new Date(row.endAt) - now;
    if (remain > 0 && remain < 48 * 3600000) {
      return { text: `Còn ${Math.max(1, Math.floor(remain / 3600000))} giờ`, warn: true };
    }
  }
  if (statusKey === 'EXPIRED' && row.endAt) {
    const diff = now - new Date(row.endAt);
    const days = Math.floor(diff / 86400000);
    if (days >= 1) return { text: `Đã kết thúc ${days} ngày trước` };
    return { text: `Đã kết thúc ${Math.max(1, Math.floor(diff / 3600000))} giờ trước` };
  }
  return null;
}

export default function AdminVouchersPage() {
  const { onToast } = useOutletContext();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [discountType, setDiscountType] = useState('');
  const [sort, setSort] = useState({ key: 'endAt', dir: 'asc' });
  const [page, setPage] = useState(1); // UI 1-indexed; API page 0-indexed (§6)
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [categoryNames, setCategoryNames] = useState({});
  const [productNames, setProductNames] = useState({});
  const [formState, setFormState] = useState(null); // { id: null | string }
  const [deactivateRow, setDeactivateRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  // Tên danh mục/sản phẩm để tooltip phạm vi áp dụng (§2.2 cột 3).
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([listCategories(), listProducts({ page: 1, size: 50 })]).then(
      ([cats, prods]) => {
        if (cancelled) return;
        if (cats.status === 'fulfilled') {
          const map = {};
          (cats.value || []).forEach((c) => {
            map[c.id] = c.name;
          });
          setCategoryNames(map);
        }
        if (prods.status === 'fulfilled') {
          const map = {};
          (prods.value?.content || []).forEach((p) => {
            map[p.id] = p.name;
          });
          setProductNames(map);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listVouchers({
        q,
        status,
        discountType,
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
  }, [q, status, discountType, page, pageSize, sort, reloadTick]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const hasFilter = Boolean(q.trim() || status || discountType);

  const clearFilters = () => {
    setQ('');
    setStatus('');
    setDiscountType('');
    setPage(1);
  };

  const copyCode = async (e, code) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard không khả dụng */
    }
    onToast?.(`Đã sao chép mã ${code}.`);
  };

  /* ------------------------------ Bật / tắt (§4.1) ------------------------------ */

  const handleToggle = async (row) => {
    if (row.active) {
      setDeactivateRow(row);
      return;
    }
    setBusyId(row.id);
    try {
      await patchVoucher(row.id, { active: true });
      if (row.endAt && new Date(row.endAt) < new Date()) {
        onToast?.(
          `Đã bật voucher ${row.code}, nhưng voucher đã hết hạn nên khách chưa dùng được. Hãy gia hạn thời gian kết thúc.`
        );
      } else {
        onToast?.(`Đã bật voucher ${row.code}.`);
      }
      load();
    } catch (e) {
      onToast?.(e?.message || 'Không bật được voucher. Vui lòng thử lại.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateRow) return;
    setDialogBusy(true);
    try {
      await patchVoucher(deactivateRow.id, { active: false });
      onToast?.(`Đã tắt voucher ${deactivateRow.code}.`);
      setDeactivateRow(null);
      load();
    } catch (e) {
      onToast?.(e?.message || 'Không tắt được voucher. Vui lòng thử lại.');
      setDeactivateRow(null);
    } finally {
      setDialogBusy(false);
    }
  };

  /* ------------------------------ Xóa (§4.2) ------------------------------ */

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDialogBusy(true);
    try {
      await deleteVoucher(deleteRow.id);
      onToast?.(`Đã xóa voucher ${deleteRow.code}.`);
      const wasLastOnPage = data.items.length === 1 && page > 1;
      setDeleteRow(null);
      if (wasLastOnPage) setPage(page - 1);
      else load();
    } catch (e) {
      // API chặn ở phút chót (đã có đơn dùng) → toast đúng message + đồng bộ lại bảng.
      onToast?.(e?.message || 'Không xóa được voucher. Vui lòng thử lại.');
      setDeleteRow(null);
      load();
    } finally {
      setDialogBusy(false);
    }
  };

  /* ------------------------------ Lưu form (§3.7) ------------------------------ */

  const handleSaved = (saved, isCreate) => {
    setFormState(null);
    if (isCreate) {
      onToast?.(`Đã tạo voucher ${saved.code}.`);
      // Reset bộ lọc về Tất cả để voucher mới nằm trong vùng nhìn thấy.
      clearFilters();
      setReloadTick((t) => t + 1);
    } else {
      onToast?.(`Đã lưu voucher ${saved.code}.`);
      load();
    }
  };

  /* ------------------------------ Cột bảng (§2.2) ------------------------------ */

  const scopeInfo = (row) => {
    const cats = row.applicableCategories || [];
    const prods = row.applicableProductIds || [];
    if (prods.length > 0) {
      return {
        label: `${prods.length} sản phẩm`,
        title: prods.map((id) => productNames[id] || id).join(', '),
      };
    }
    if (cats.length > 0) {
      return {
        label: `${cats.length} danh mục`,
        title: cats.map((id) => categoryNames[id] || id).join(', '),
      };
    }
    return { label: 'Toàn đơn', title: 'Áp dụng cho toàn bộ đơn hàng' };
  };

  const columns = [
    {
      key: 'code',
      label: 'Mã code',
      sortable: true,
      render: (row) => (
        <span className="voucher-code">
          <button
            type="button"
            className="voucher-code__text"
            onClick={(e) => copyCode(e, row.code)}
            title="Sao chép mã"
          >
            {row.code}
          </button>
          <button
            type="button"
            className="orders-cell__copy"
            title="Sao chép mã"
            aria-label={`Sao chép mã ${row.code}`}
            onClick={(e) => copyCode(e, row.code)}
          >
            ⧉
          </button>
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Loại giảm',
      render: (row) =>
        row.type === 'PERCENT' ? (
          <span className="voucher-cell">
            <span className="voucher-cell__main">Giảm {row.value}%</span>
            <span className="voucher-cell__sub">
              {row.maxDiscount != null
                ? `tối đa ${formatVND(row.maxDiscount)}`
                : 'không giới hạn mức giảm'}
            </span>
          </span>
        ) : (
          <span className="voucher-cell">
            <span className="voucher-cell__main">Giảm {formatVND(row.value)}</span>
          </span>
        ),
    },
    {
      key: 'condition',
      label: 'Điều kiện & phạm vi',
      render: (row) => {
        const scope = scopeInfo(row);
        return (
          <span className="voucher-cell">
            <span className="voucher-cell__main">
              {row.minOrderValue > 0
                ? `Đơn từ ${formatVND(row.minOrderValue)}`
                : 'Mọi đơn hàng'}
            </span>
            <span className="voucher-cell__sub" title={scope.title}>
              {scope.label}
            </span>
          </span>
        );
      },
    },
    {
      key: 'endAt',
      label: 'Thời gian hiệu lực',
      sortable: true,
      render: (row) => {
        const note = relativeNote(row, voucherStatus(row).key);
        return (
          <span className="voucher-cell">
            <span className="voucher-cell__line">Từ {formatDateTime(row.startAt)}</span>
            <span className="voucher-cell__line">Đến {formatDateTime(row.endAt)}</span>
            {note ? (
              <span className={`voucher-cell__note${note.warn ? ' is-warning' : ''}`}>
                {note.text}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'usedCount',
      label: 'Đã dùng / Giới hạn',
      sortable: true,
      render: (row) => {
        const limit = row.totalUsageLimit || 0;
        const pct = limit > 0 ? Math.min(100, (row.usedCount / limit) * 100) : 0;
        return (
          <span className="voucher-cell">
            <span className="voucher-cell__main">
              {row.usedCount} / {limit > 0 ? limit : 'Không giới hạn'}
            </span>
            {limit > 0 ? (
              <span className="voucher-progress" aria-hidden="true">
                <span
                  className={`voucher-progress__bar${
                    pct >= 100 ? ' is-error' : pct >= 90 ? ' is-warning' : ''
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </span>
            ) : null}
            {row.perUserLimit ? (
              <span className="voucher-cell__sub">
                Tối đa {row.perUserLimit} lượt/khách
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => {
        const st = voucherStatus(row);
        return <span className={`voucher-badge ${BADGE_CLASS[st.key]}`}>{st.label}</span>;
      },
    },
    {
      key: 'actions',
      label: 'Hành động',
      align: 'right',
      render: (row) => {
        const busy = busyId === row.id;
        const canDelete = (row.usedCount || 0) === 0;
        return (
          <span className="row-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="row-action-btn"
              onClick={() => setFormState({ id: row.id })}
              title="Sửa voucher"
              disabled={busy}
            >
              Sửa
            </button>
            <button
              type="button"
              className="row-action-btn"
              onClick={() => handleToggle(row)}
              title={row.active ? 'Vô hiệu hóa' : 'Bật lại'}
              disabled={busy}
            >
              {busy ? 'Đang xử lý…' : row.active ? 'Vô hiệu hóa' : 'Bật lại'}
            </button>
            <button
              type="button"
              className="row-action-btn is-danger"
              onClick={() => canDelete && setDeleteRow(row)}
              title={
                canDelete
                  ? 'Xóa voucher'
                  : 'Voucher đã có lượt dùng — chỉ có thể vô hiệu hóa, không thể xóa.'
              }
              disabled={!canDelete || busy}
            >
              Xóa
            </button>
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
        }}
        aria-label="Lọc theo trạng thái"
      >
        {STATUS_FILTERS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        className="admin-filter-select"
        value={discountType}
        onChange={(e) => {
          setDiscountType(e.target.value);
          setPage(1);
        }}
        aria-label="Lọc theo loại giảm"
      >
        <option value="">Tất cả loại giảm</option>
        <option value="PERCENT">Giảm %</option>
        <option value="FIXED">Giảm số tiền</option>
      </select>
    </>
  );

  return (
    <div className="admin-vouchers">
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-head__title">Quản lý voucher</h2>
          <p className="admin-page-head__count">
            Mã giảm giá khách nhập khi đặt hàng. Chương trình flash sale được quản lý ở màn
            Flash sale &amp; Phí ship.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data.items}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        errorText="Không tải được danh sách voucher."
        onRetry={load}
        searchValue={q}
        onSearchChange={(v) => {
          // Mã luôn uppercase (F-018) — hiển thị in hoa ngay khi gõ (§2.1).
          setQ(v.toUpperCase());
          setPage(1);
        }}
        searchPlaceholder="Tìm theo mã voucher…"
        filters={filtersNode}
        toolbarRight={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormState({ id: null })}
          >
            + Tạo voucher
          </button>
        }
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
          hasFilter ? 'Không có voucher nào khớp bộ lọc.' : 'Chưa có voucher nào.'
        }
        emptyAction={
          !hasFilter ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setFormState({ id: null })}
            >
              + Tạo voucher
            </button>
          ) : null
        }
        hasActiveFilter={hasFilter}
        onClearFilter={clearFilters}
        itemLabel="voucher"
      />

      {formState ? (
        <VoucherFormSlideOver
          key={formState.id || 'new'}
          voucherId={formState.id}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
          onToast={onToast}
        />
      ) : null}

      {/* §4.1 — vô hiệu hóa voucher đang chạy/sắp chạy: nêu rõ hậu quả. */}
      <ConfirmDialog
        open={Boolean(deactivateRow)}
        title={deactivateRow ? `Vô hiệu hóa voucher ${deactivateRow.code}?` : ''}
        confirmLabel="Vô hiệu hóa"
        loading={dialogBusy}
        onCancel={() => setDeactivateRow(null)}
        onConfirm={confirmDeactivate}
      >
        {deactivateRow ? (
          <p>
            Khách đang ở bước đặt hàng sẽ không áp được mã này nữa (hệ thống báo “Mã ưu đãi
            không tồn tại.”). Các đơn đã tạo trước đó không bị ảnh hưởng. Lượt đã dùng (
            {deactivateRow.usedCount}) được giữ nguyên và bạn có thể bật lại voucher sau.
          </p>
        ) : null}
      </ConfirmDialog>

      {/* §4.2 — xóa voucher chưa từng được dùng. */}
      <ConfirmDialog
        open={Boolean(deleteRow)}
        title={deleteRow ? `Xóa voucher ${deleteRow.code}?` : ''}
        confirmLabel="Xóa"
        loading={dialogBusy}
        onCancel={() => setDeleteRow(null)}
        onConfirm={confirmDelete}
      >
        {deleteRow ? (
          <p>
            Voucher <strong>{deleteRow.code}</strong> chưa từng được dùng trong đơn nào.
            Thao tác này không thể hoàn tác.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
