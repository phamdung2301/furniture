import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/admin/DataTable';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminModal from '../../components/admin/AdminModal';
import FlashSaleFormSlideOver from '../../components/admin/FlashSaleFormSlideOver';
import ShippingRuleModal, { SHIPPING_APPLY_NOTE } from '../../components/admin/ShippingRuleModal';
import {
  deleteFlashSale,
  deleteShippingRule,
  findShippingGaps,
  flashSaleStatus,
  listFlashSales,
  listShippingRules,
  patchFlashSale,
  previewShipping,
  shippingTierLabel,
  updateShippingConfig,
  updateShippingRule,
} from '../../api/adminPromoApi';
import { formatAreaM2 } from '../../api/shippingApi';
import { formatDateTime, formatVND } from '../../utils/format';

/**
 * Flash sale & Phí vận chuyển (admin) — màn 22 · FR-028/FR-029 · F-022/F-023 ·
 * US-019/US-021 (admin-flash-sale-shipping.md).
 * 1 route /admin/khuyen-mai, 2 tab qua ?tab=flash-sale|phi-ship (§1.1); mỗi
 * tab tải dữ liệu độc lập, lỗi/rỗng của tab này không chặn tab kia (§7), và
 * giữ nguyên trạng thái khi qua lại trong cùng phiên (cả 2 panel luôn mounted).
 * Mọi thao tác ghi ở tab Phí vận chuyển đều qua confirm §5.5 trước khi gọi API.
 */

const STATUS_CHIPS = [
  { value: '', label: 'Tất cả' },
  { value: 'RUNNING', label: 'Đang chạy' },
  { value: 'UPCOMING', label: 'Sắp chạy' },
  { value: 'ENDED', label: 'Đã kết thúc' },
  { value: 'INACTIVE', label: 'Đã tắt' },
];

const BADGE_CLASS = {
  RUNNING: 'is-running',
  UPCOMING: 'is-upcoming',
  ENDED: 'is-muted',
  INACTIVE: 'is-muted',
};

/** Dòng phụ cột Khung giờ (§2.2): còn < 24 giờ / bắt đầu sau / hết suất sớm. */
function scheduleNote(row, statusKey) {
  const now = new Date();
  if (statusKey === 'RUNNING' && row.endAt) {
    const remain = new Date(row.endAt) - now;
    if (remain > 0 && remain < 24 * 3600000) {
      return { text: `Còn ${Math.max(1, Math.floor(remain / 3600000))} giờ`, warn: true };
    }
  }
  if (statusKey === 'UPCOMING' && row.startAt) {
    const diff = new Date(row.startAt) - now;
    const days = Math.ceil(diff / 86400000);
    if (days >= 1) return { text: `Bắt đầu sau ${days} ngày` };
    return { text: `Bắt đầu sau ${Math.max(1, Math.ceil(diff / 3600000))} giờ` };
  }
  if (
    statusKey === 'ENDED' &&
    row.totalUsageLimit > 0 &&
    row.usedCount >= row.totalUsageLimit &&
    row.endAt &&
    now < new Date(row.endAt)
  ) {
    return { text: 'Đã hết suất trước giờ kết thúc' };
  }
  return null;
}

function gapText(gaps) {
  return gaps
    .map((g) => `${formatAreaM2(g.from)} – ${formatAreaM2(g.to)} m²`)
    .join('; ');
}

export default function AdminPromoPage() {
  const { onToast } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'phi-ship' ? 'phi-ship' : 'flash-sale';

  const setTab = (next) => {
    setSearchParams(next === 'phi-ship' ? { tab: 'phi-ship' } : { tab: 'flash-sale' });
  };

  // Tín hiệu mở form từ hàng tiêu đề trang (§1.2 — nút theo tab đang mở).
  const [createSignal, setCreateSignal] = useState(0);

  return (
    <div className="admin-promo">
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-head__title">Flash sale &amp; Phí vận chuyển</h2>
          <p className="admin-page-head__count">
            Chương trình giảm giá theo khung giờ và bảng phí vận chuyển theo diện tích. Voucher
            thường được quản lý ở màn Voucher.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreateSignal((n) => n + 1)}
        >
          {tab === 'flash-sale' ? '+ Tạo chương trình' : '+ Thêm bậc phí'}
        </button>
      </div>

      <div className="promo-tabs" role="tablist" aria-label="Nhóm cấu hình">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'flash-sale'}
          className={`promo-tab${tab === 'flash-sale' ? ' is-active' : ''}`}
          onClick={() => setTab('flash-sale')}
        >
          Flash sale
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'phi-ship'}
          className={`promo-tab${tab === 'phi-ship' ? ' is-active' : ''}`}
          onClick={() => setTab('phi-ship')}
        >
          Phí vận chuyển
        </button>
      </div>

      <div hidden={tab !== 'flash-sale'}>
        <FlashSaleTab onToast={onToast} createSignal={createSignal} active={tab === 'flash-sale'} />
      </div>
      <div hidden={tab !== 'phi-ship'}>
        <ShippingTab onToast={onToast} createSignal={createSignal} active={tab === 'phi-ship'} />
      </div>
    </div>
  );
}

/* ======================================================================
   TAB FLASH SALE (§2, §4)
   ====================================================================== */

function FlashSaleTab({ onToast, createSignal, active }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: 'startAt', dir: 'desc' });
  const [page, setPage] = useState(1); // UI 1-indexed; API page 0-indexed (§8)
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formState, setFormState] = useState(null); // { id: null | string }
  const [deactivateRow, setDeactivateRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  useEffect(() => {
    if (createSignal > 0 && active) setFormState({ id: null });
  }, [createSignal, active]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listFlashSales({
        q,
        status,
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
  }, [q, status, page, pageSize, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const hasFilter = Boolean(q.trim() || status);

  const clearFilters = () => {
    setQ('');
    setStatus('');
    setPage(1);
  };

  /* ------------------------------ Bật / tắt (§4.1) ------------------------------ */

  const handleToggle = async (row) => {
    const st = flashSaleStatus(row).key;
    if (row.active && (st === 'RUNNING' || st === 'UPCOMING')) {
      setDeactivateRow(row);
      return;
    }
    setBusyId(row.id);
    try {
      const saved = await patchFlashSale(row.id, { active: !row.active });
      if (!row.active) {
        const savedStatus = flashSaleStatus(saved).key;
        if (savedStatus === 'ENDED') {
          onToast?.(
            `Đã bật chương trình "${row.name}", nhưng chương trình đã kết thúc nên khách chưa thấy được. Hãy gia hạn thời gian kết thúc.`
          );
        } else {
          onToast?.(`Đã bật chương trình "${row.name}".`);
        }
      } else {
        onToast?.(`Đã tắt chương trình "${row.name}".`);
      }
      load();
    } catch (e) {
      onToast?.(e?.message || 'Không đổi được trạng thái chương trình. Vui lòng thử lại.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateRow) return;
    setDialogBusy(true);
    try {
      await patchFlashSale(deactivateRow.id, { active: false });
      onToast?.(`Đã tắt chương trình "${deactivateRow.name}".`);
      setDeactivateRow(null);
      load();
    } catch (e) {
      onToast?.(e?.message || 'Không tắt được chương trình. Vui lòng thử lại.');
      setDeactivateRow(null);
    } finally {
      setDialogBusy(false);
    }
  };

  /* ------------------------------ Xóa (§4.2) ------------------------------ */

  const deleteBlocker = (row) => {
    const st = flashSaleStatus(row).key;
    const sold =
      (row.usedCount || 0) > 0 || (row.items || []).some((i) => (i.itemSoldCount || 0) > 0);
    if (sold) return 'Chương trình đã có lượt bán — chỉ có thể tắt, không thể xóa.';
    if (st === 'RUNNING') return 'Chương trình đang chạy — hãy tắt chương trình thay vì xóa.';
    if (st === 'ENDED') return 'Chương trình đã kết thúc — giữ lại làm lịch sử, không thể xóa.';
    return null;
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDialogBusy(true);
    try {
      await deleteFlashSale(deleteRow.id);
      onToast?.(`Đã xóa chương trình "${deleteRow.name}".`);
      const wasLastOnPage = data.items.length === 1 && page > 1;
      setDeleteRow(null);
      if (wasLastOnPage) setPage(page - 1);
      else load();
    } catch (e) {
      // API chặn ở phút chót (409) → toast đúng message + đồng bộ lại bảng.
      onToast?.(e?.message || 'Không xóa được chương trình. Vui lòng thử lại.');
      setDeleteRow(null);
      load();
    } finally {
      setDialogBusy(false);
    }
  };

  /* ------------------------------ Lưu form (§3.6) ------------------------------ */

  const handleSaved = (saved, isCreate) => {
    setFormState(null);
    if (isCreate) {
      onToast?.(`Đã tạo chương trình "${saved.name}".`);
      clearFilters(); // reset lọc về Tất cả để chương trình mới nằm trong vùng nhìn thấy
    } else {
      onToast?.(`Đã lưu chương trình "${saved.name}".`);
      load();
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Chương trình',
      sortable: true,
      render: (row) => (
        <span className="voucher-cell">
          <span className="voucher-cell__main">{row.name}</span>
          <span className="voucher-cell__sub promo-mono">{row.code}</span>
        </span>
      ),
    },
    {
      key: 'startAt',
      label: 'Khung giờ',
      sortable: true,
      render: (row) => {
        const st = flashSaleStatus(row);
        const note = scheduleNote(row, st.key);
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
      key: 'items',
      label: 'Sản phẩm',
      render: (row) => {
        const items = row.items || [];
        const title = items
          .map(
            (i) =>
              `${i.productName || i.productId} — ${i.variantId ? `Màu ${i.color || ''}` : 'Tất cả các màu'}`
          )
          .join('; ');
        return (
          <span className="voucher-cell__main" title={title}>
            {row.itemCount ?? items.length} sản phẩm
          </span>
        );
      },
    },
    {
      key: 'usedCount',
      label: 'Đã bán / Tổng suất',
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
                  className={`voucher-progress__bar${pct >= 100 ? ' is-error' : pct >= 90 ? ' is-warning' : ''}`}
                  style={{ width: `${pct}%` }}
                />
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
        const st = flashSaleStatus(row);
        return <span className={`voucher-badge ${BADGE_CLASS[st.key]}`}>{st.label}</span>;
      },
    },
    {
      key: 'actions',
      label: 'Hành động',
      align: 'right',
      render: (row) => {
        const busy = busyId === row.id;
        const st = flashSaleStatus(row);
        const blocker = deleteBlocker(row);
        return (
          <span className="row-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="row-action-btn"
              onClick={() => setFormState({ id: row.id })}
              title={st.key === 'ENDED' ? 'Xem chi tiết' : 'Sửa chương trình'}
              disabled={busy}
            >
              {st.key === 'ENDED' ? 'Xem' : 'Sửa'}
            </button>
            <button
              type="button"
              className="row-action-btn"
              onClick={() => handleToggle(row)}
              title={row.active ? 'Tắt chương trình' : 'Bật lại'}
              disabled={busy}
            >
              {busy ? 'Đang xử lý…' : row.active ? 'Tắt chương trình' : 'Bật lại'}
            </button>
            <button
              type="button"
              className="row-action-btn is-danger"
              onClick={() => !blocker && setDeleteRow(row)}
              title={blocker || 'Xóa chương trình'}
              disabled={Boolean(blocker) || busy}
            >
              Xóa
            </button>
          </span>
        );
      },
    },
  ];

  const chipsNode = (
    <div className="promo-chips" role="group" aria-label="Lọc theo trạng thái">
      {STATUS_CHIPS.map((chip) => (
        <button
          key={chip.value || 'all'}
          type="button"
          className={`promo-chip${status === chip.value ? ' is-active' : ''}`}
          onClick={() => {
            setStatus(chip.value);
            setPage(1);
          }}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <DataTable
        columns={columns}
        rows={data.items}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        errorText="Không tải được danh sách chương trình."
        onRetry={load}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Tìm theo tên chương trình…"
        toolbarTop={chipsNode}
        toolbarRight={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormState({ id: null })}
          >
            + Tạo chương trình
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
          hasFilter
            ? 'Không có chương trình nào khớp bộ lọc.'
            : 'Chưa có chương trình flash sale nào.'
        }
        emptyAction={
          !hasFilter ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setFormState({ id: null })}
            >
              + Tạo chương trình
            </button>
          ) : null
        }
        hasActiveFilter={hasFilter}
        onClearFilter={clearFilters}
        itemLabel="chương trình"
        footerNote="Mã chương trình do hệ thống tự sinh, chỉ dùng để tra soát nội bộ — khách hàng không nhập mã này."
      />

      {formState ? (
        <FlashSaleFormSlideOver
          key={formState.id || 'new'}
          programId={formState.id}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
          onToast={onToast}
        />
      ) : null}

      {/* §4.1 — tắt chương trình đang chạy/sắp chạy: nêu đúng hậu quả. */}
      <ConfirmDialog
        open={Boolean(deactivateRow)}
        title={deactivateRow ? `Tắt chương trình "${deactivateRow.name}"?` : ''}
        confirmLabel="Tắt chương trình"
        loading={dialogBusy}
        onCancel={() => setDeactivateRow(null)}
        onConfirm={confirmDeactivate}
      >
        {deactivateRow ? (
          flashSaleStatus(deactivateRow).key === 'UPCOMING' ? (
            <p>
              Chương trình sẽ không bắt đầu theo lịch đã đặt và khách sẽ không thấy chương
              trình này. Bạn có thể bật lại trước giờ bắt đầu.
            </p>
          ) : (
            <p>
              Khách hàng sẽ mất giá flash sale ngay lập tức: trang flash sale và giá ở trang
              sản phẩm trở về giá thường, đơn đang ở bước đặt hàng sẽ chốt theo giá thường.
              Các đơn đã đặt trước đó giữ nguyên giá flash sale đã chốt. Suất đã bán (
              {deactivateRow.usedCount}) được giữ nguyên và bạn có thể bật lại chương trình
              sau.
            </p>
          )
        ) : null}
      </ConfirmDialog>

      {/* §4.2 — xóa chương trình chưa chạy + chưa có lượt bán. */}
      <ConfirmDialog
        open={Boolean(deleteRow)}
        title={deleteRow ? `Xóa chương trình "${deleteRow.name}"?` : ''}
        confirmLabel="Xóa"
        loading={dialogBusy}
        onCancel={() => setDeleteRow(null)}
        onConfirm={confirmDelete}
      >
        {deleteRow ? (
          <p>
            Chương trình <strong>{deleteRow.name}</strong> chưa bắt đầu và chưa có lượt bán
            nào. Thao tác này không thể hoàn tác.
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

/* ======================================================================
   TAB PHÍ VẬN CHUYỂN (§5)
   ====================================================================== */

function ShippingTab({ onToast, createSignal, active }) {
  const [rules, setRules] = useState([]);
  const [config, setConfig] = useState({ freeThreshold: 10000000, maxAreaM2: 10 });
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [ruleModal, setRuleModal] = useState(null); // { rule: null | rule }
  const [shipConfirm, setShipConfirm] = useState(null);
  // { kind: 'toggle'|'delete'|'threshold', rule?, summary, gapNote, label, danger }
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState(null);
  const [thresholdDraft, setThresholdDraft] = useState('');
  const [preview, setPreview] = useState({ area: '', subtotal: '', result: null, error: '', loading: false });

  useEffect(() => {
    if (createSignal > 0 && active) setRuleModal({ rule: null });
  }, [createSignal, active]);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError(null);
    setConfigError(null);
    try {
      const res = await listShippingRules();
      setRules(res?.rules || []);
      if (res?.config) {
        setConfig(res.config);
        setThresholdDraft(String(res.config.freeThreshold ?? ''));
      } else {
        setConfigError(new Error('config'));
      }
    } catch (e) {
      setRulesError(e);
      setConfigError(e);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const maxArea = config.maxAreaM2 ?? 10;
  const gaps = useMemo(() => findShippingGaps(rules, maxArea), [rules, maxArea]);
  const thresholdDirty =
    thresholdDraft !== '' && Number(thresholdDraft) !== Number(config.freeThreshold);

  const afterShipChange = (toastMsg) => {
    onToast?.(toastMsg);
    setPreview((p) => ({ ...p, result: null, error: '' })); // cấu hình đã đổi -> xóa kết quả thử cũ (§5.5)
    loadRules();
  };

  /** Lỗ hổng MỚI sẽ xuất hiện nếu áp thay đổi lên tập bậc cho trước. */
  const newGapNote = (nextRules) => {
    const before = new Set(gaps.map((g) => `${g.from}-${g.to}`));
    const fresh = findShippingGaps(nextRules, maxArea).filter(
      (g) => !before.has(`${g.from}-${g.to}`)
    );
    return fresh.length
      ? `Thay đổi này tạo khoảng trống ${gapText(fresh)} chưa có bậc phí.`
      : '';
  };

  /* ------------------------------ Confirm §5.5 ------------------------------ */

  const askToggleRule = (rule) => {
    const next = rules.map((r) => (r.id === rule.id ? { ...r, active: !rule.active } : r));
    if (rule.active) {
      setShipConfirm({
        kind: 'toggle',
        rule,
        summary: `Tắt bậc "${shippingTierLabel(rule.minAreaM2, rule.maxAreaM2)}" (phí ${formatVND(rule.fee)}) — bậc này sẽ không tham gia tính phí nữa.`,
        gapNote: newGapNote(next),
        label: 'Tắt bậc',
        danger: true,
      });
    } else {
      setShipConfirm({
        kind: 'toggle',
        rule,
        summary: `Bật lại bậc "${shippingTierLabel(rule.minAreaM2, rule.maxAreaM2)}" (phí ${formatVND(rule.fee)}) — bậc này sẽ tham gia tính phí trở lại.`,
        gapNote: '',
        label: 'Bật lại',
        danger: false,
      });
    }
  };

  const askDeleteRule = (rule) => {
    const next = rules.filter((r) => r.id !== rule.id);
    setShipConfirm({
      kind: 'delete',
      rule,
      summary: `Xóa bậc "${shippingTierLabel(rule.minAreaM2, rule.maxAreaM2)}" (phí ${formatVND(rule.fee)}) — khoảng ${formatAreaM2(rule.minAreaM2)} – ${rule.maxAreaM2 == null ? maxArea : formatAreaM2(rule.maxAreaM2)} m² sẽ không còn bậc phí.`,
      gapNote: newGapNote(next),
      label: 'Xóa bậc',
      danger: true,
    });
  };

  const askSaveThreshold = () => {
    setShipConfirm({
      kind: 'threshold',
      summary: `Đổi ngưỡng miễn phí từ ${formatVND(config.freeThreshold)} thành ${formatVND(Number(thresholdDraft))}.`,
      gapNote: '',
      label: 'Lưu',
      danger: false,
    });
  };

  const runShipConfirm = async () => {
    if (!shipConfirm) return;
    setConfirmBusy(true);
    try {
      if (shipConfirm.kind === 'toggle') {
        const rule = shipConfirm.rule;
        setBusyRuleId(rule.id);
        await updateShippingRule(rule.id, {
          minAreaM2: rule.minAreaM2,
          maxAreaM2: rule.maxAreaM2,
          fee: rule.fee,
          active: !rule.active,
        });
        afterShipChange(rule.active ? 'Đã tắt bậc phí.' : 'Đã bật bậc phí.');
      } else if (shipConfirm.kind === 'delete') {
        setBusyRuleId(shipConfirm.rule.id);
        await deleteShippingRule(shipConfirm.rule.id);
        afterShipChange('Đã xóa bậc phí.');
      } else if (shipConfirm.kind === 'threshold') {
        await updateShippingConfig({ freeThreshold: Number(thresholdDraft) });
        afterShipChange('Đã lưu ngưỡng miễn phí vận chuyển.');
      }
      setShipConfirm(null);
    } catch (e) {
      onToast?.(e?.message || 'Không lưu được thay đổi. Vui lòng thử lại.');
      setShipConfirm(null);
      loadRules();
    } finally {
      setConfirmBusy(false);
      setBusyRuleId(null);
    }
  };

  /* ------------------------------ Thử tính phí (§5.4) ------------------------------ */

  const runPreview = async () => {
    const area = Number(preview.area);
    if (preview.area === '' || Number.isNaN(area) || area <= 0) {
      setPreview((p) => ({ ...p, result: null, error: 'Nhập tổng diện tích đơn lớn hơn 0.' }));
      return;
    }
    setPreview((p) => ({ ...p, loading: true, error: '' }));
    try {
      const result = await previewShipping({
        areaM2: area,
        subtotal: preview.subtotal === '' ? 0 : Number(preview.subtotal),
      });
      setPreview((p) => ({ ...p, result, loading: false }));
    } catch {
      setPreview((p) => ({ ...p, result: null, error: 'Không tính thử được. Thử lại.', loading: false }));
    }
  };

  const previewNode = (() => {
    const { result, area, subtotal } = preview;
    if (!result) return null;
    const areaLabel = formatAreaM2(Number(area));
    if (result.overLimit) {
      return (
        <p className="promo-preview__text is-warning">
          Diện tích {areaLabel} m² vượt trần {formatAreaM2(maxArea)} m² — đơn thuộc diện
          &quot;Liên hệ báo giá&quot;, không đặt hàng trực tuyến được.
        </p>
      );
    }
    if (result.freeShipping) {
      return (
        <>
          <p className="promo-preview__text">
            Tạm tính {formatVND(Number(subtotal) || 0)} đạt ngưỡng miễn phí (
            {formatVND(config.freeThreshold)}) → Phí vận chuyển: <strong>0đ (Miễn phí)</strong>.
          </p>
          {result.originalFee != null ? (
            <p className="promo-preview__sub">
              Phí gốc theo bậc: <s>{formatVND(result.originalFee)}</s>
            </p>
          ) : null}
        </>
      );
    }
    if (!result.tier) {
      return (
        <p className="promo-preview__text is-warning">
          Diện tích {areaLabel} m² không thuộc bậc phí nào — đơn như thế này sẽ không tính được
          phí vận chuyển. Hãy kiểm tra lại bảng bậc phí.
        </p>
      );
    }
    return (
      <>
        <p className="promo-preview__text">
          Diện tích {areaLabel} m² thuộc bậc {shippingTierLabel(result.tier.min, result.tier.max)}{' '}
          → Phí vận chuyển: <strong>{formatVND(result.fee)}</strong>.
        </p>
        <p className="promo-preview__sub">
          Từ {formatAreaM2(result.tier.min)} m² đến{' '}
          {result.tier.max == null ? 'trở lên' : `${formatAreaM2(result.tier.max)} m²`}
        </p>
      </>
    );
  })();

  return (
    <div className="promo-ship">
      {/* §5.1 — khối giải thích cách tính (chỉ-đọc) */}
      <div className="promo-explain">
        Phí vận chuyển tính theo tổng diện tích chiếm chỗ của đơn hàng: Tổng diện tích = Σ (dài ×
        rộng × số lượng) của từng sản phẩm, tra vào bảng bậc phí dưới đây. Đơn đạt ngưỡng miễn phí
        thì phí = 0đ. Đơn có tổng diện tích trên {formatAreaM2(maxArea)} m² sẽ hiển thị &quot;Liên
        hệ báo giá&quot; và không đặt hàng trực tuyến được.
      </div>

      {/* §5.2 — bảng bậc phí */}
      <div className="data-table-card">
        <div className="promo-card-head">
          <h3 className="admin-card__title">Bảng bậc phí</h3>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setRuleModal({ rule: null })}
          >
            + Thêm bậc phí
          </button>
        </div>

        {!rulesLoading && !rulesError && rules.length > 0 && gaps.length > 0 ? (
          <div className="promo-gap-strip">
            Bảng phí đang có khoảng trống: diện tích {gapText(gaps)} chưa có bậc phí. Đơn rơi
            vào khoảng này sẽ không tính được phí vận chuyển.
          </div>
        ) : null}
        {!rulesLoading && !rulesError && rules.length === 0 ? (
          <div className="promo-gap-strip is-danger">
            Chưa cấu hình bậc phí nào — mọi đơn hàng sẽ không tính được phí vận chuyển.
          </div>
        ) : null}

        <div className="data-table__scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Từ (m²)</th>
                <th>Đến (m²)</th>
                <th>Khoảng hiển thị</th>
                <th>Phí</th>
                <th>Trạng thái</th>
                <th className="is-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {rulesLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="data-table__skeleton-row">
                    <td colSpan={6}>
                      <div className="skeleton data-table__skel" aria-hidden="true" />
                    </td>
                  </tr>
                ))
              ) : rulesError ? (
                <tr>
                  <td colSpan={6}>
                    <div className="data-table__state">
                      <p>Không tải được bảng bậc phí.</p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={loadRules}
                      >
                        Thử lại
                      </button>
                    </div>
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="data-table__state">
                      <p>Chưa có bậc phí nào.</p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setRuleModal({ rule: null })}
                      >
                        + Thêm bậc phí
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{formatAreaM2(rule.minAreaM2)}</td>
                    <td>{rule.maxAreaM2 == null ? 'Trở lên' : formatAreaM2(rule.maxAreaM2)}</td>
                    <td>{shippingTierLabel(rule.minAreaM2, rule.maxAreaM2)}</td>
                    <td>
                      {rule.fee === 0 ? (
                        <span className="promo-free-text">Miễn phí</span>
                      ) : (
                        formatVND(rule.fee)
                      )}
                    </td>
                    <td>
                      {rule.active ? (
                        <span className="voucher-badge is-running">Đang áp dụng</span>
                      ) : (
                        <span className="voucher-badge is-muted">Đã tắt</span>
                      )}
                    </td>
                    <td className="is-right">
                      <span className="row-actions">
                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() => setRuleModal({ rule })}
                          title="Sửa bậc phí"
                          disabled={busyRuleId === rule.id}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() => askToggleRule(rule)}
                          title={rule.active ? 'Tắt bậc' : 'Bật lại'}
                          disabled={busyRuleId === rule.id}
                        >
                          {busyRuleId === rule.id
                            ? 'Đang xử lý…'
                            : rule.active
                              ? 'Tắt'
                              : 'Bật lại'}
                        </button>
                        <button
                          type="button"
                          className="row-action-btn is-danger"
                          onClick={() => askDeleteRule(rule)}
                          title="Xóa bậc"
                          disabled={busyRuleId === rule.id}
                        >
                          Xóa
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* §5.3 + §5.4 — ngưỡng miễn phí | thử tính phí */}
      <div className="promo-ship-grid">
        <div className="admin-card">
          <h3 className="admin-card__title">Ngưỡng miễn phí vận chuyển</h3>
          {configError && !rulesLoading ? (
            <div className="admin-block__state">
              <p>Không tải được ngưỡng miễn phí.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadRules}>
                Thử lại
              </button>
            </div>
          ) : rulesLoading ? (
            <div className="admin-skel-rows" aria-hidden="true">
              <div className="skeleton" style={{ height: 20 }} />
              <div className="skeleton" style={{ height: 40 }} />
            </div>
          ) : (
            <>
              <p className="promo-card-note">
                Đơn hàng có tạm tính từ mức này trở lên được miễn phí vận chuyển, bất kể diện
                tích (trừ đơn trên {formatAreaM2(maxArea)} m² thuộc diện liên hệ báo giá). Tạm
                tính là tổng tiền hàng trước khi trừ mã giảm giá.
              </p>
              <label className="pf-field__label" htmlFor="promo-free-threshold">
                Ngưỡng miễn phí <span className="pf-required">*</span>
              </label>
              <div className="voucher-suffix">
                <input
                  id="promo-free-threshold"
                  type="number"
                  className="pf-input"
                  min="0"
                  value={thresholdDraft}
                  onChange={(ev) => setThresholdDraft(ev.target.value)}
                />
                <span className="voucher-suffix__unit">đ</span>
              </div>
              {thresholdDraft !== '' && Number(thresholdDraft) === 0 ? (
                <p className="voucher-warn-text">
                  Đặt 0đ nghĩa là miễn phí vận chuyển cho mọi đơn hàng.
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                onClick={askSaveThreshold}
                disabled={!thresholdDirty}
              >
                Lưu ngưỡng
              </button>
            </>
          )}
        </div>

        <div className="admin-card">
          <h3 className="admin-card__title">Thử tính phí</h3>
          <p className="promo-card-note">
            Kiểm tra cấu hình đã lưu áp vào một đơn giả lập. Sửa bậc phí xong hãy lưu rồi thử
            lại — công cụ này luôn dùng cấu hình đã lưu, không dùng số đang gõ dở.
          </p>
          <div className="promo-preview-form">
            <div>
              <label className="pf-field__label" htmlFor="promo-preview-area">
                Tổng diện tích đơn (m²) <span className="pf-required">*</span>
              </label>
              <input
                id="promo-preview-area"
                type="number"
                className="pf-input"
                min="0"
                step="0.01"
                value={preview.area}
                onChange={(ev) =>
                  setPreview((p) => ({ ...p, area: ev.target.value, result: null, error: '' }))
                }
                placeholder="VD: 5.4"
              />
            </div>
            <div>
              <label className="pf-field__label" htmlFor="promo-preview-subtotal">
                Tạm tính đơn (đ)
              </label>
              <input
                id="promo-preview-subtotal"
                type="number"
                className="pf-input"
                min="0"
                value={preview.subtotal}
                onChange={(ev) =>
                  setPreview((p) => ({ ...p, subtotal: ev.target.value, result: null, error: '' }))
                }
                placeholder="Để trống = chỉ kiểm tra bậc phí"
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={runPreview}
            disabled={preview.loading}
          >
            {preview.loading ? 'Đang tính…' : 'Tính thử'}
          </button>
          {preview.error ? <p className="pf-field__error">{preview.error}</p> : null}
          {previewNode}
        </div>
      </div>

      {ruleModal ? (
        <ShippingRuleModal
          key={ruleModal.rule?.id || 'new'}
          rule={ruleModal.rule}
          rules={rules}
          maxAreaM2={maxArea}
          onClose={() => setRuleModal(null)}
          onSaved={(saved, isCreate) => {
            setRuleModal(null);
            afterShipChange(isCreate ? 'Đã lưu bậc phí.' : 'Đã lưu bậc phí.');
          }}
          onError={(msg) => onToast?.(msg)}
        />
      ) : null}

      {/* Confirm §5.5 cho tắt/bật/xóa bậc + lưu ngưỡng — nút nguy hiểm chỉ cho Xóa/Tắt. */}
      {shipConfirm?.danger ? (
        <ConfirmDialog
          open
          title={
            shipConfirm.kind === 'delete'
              ? 'Xóa bậc phí?'
              : shipConfirm.kind === 'toggle'
                ? 'Tắt bậc phí?'
                : 'Lưu thay đổi?'
          }
          confirmLabel={shipConfirm.label}
          loading={confirmBusy}
          onCancel={() => setShipConfirm(null)}
          onConfirm={runShipConfirm}
        >
          <p>{shipConfirm.summary}</p>
          {shipConfirm.gapNote ? <p className="voucher-warn-text">{shipConfirm.gapNote}</p> : null}
          <p>{SHIPPING_APPLY_NOTE}</p>
        </ConfirmDialog>
      ) : (
        <AdminModal
          open={Boolean(shipConfirm)}
          title={shipConfirm?.kind === 'threshold' ? 'Lưu ngưỡng miễn phí?' : 'Bật lại bậc phí?'}
          onClose={confirmBusy ? undefined : () => setShipConfirm(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShipConfirm(null)}
                disabled={confirmBusy}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={runShipConfirm}
                disabled={confirmBusy}
              >
                {confirmBusy ? 'Đang lưu…' : shipConfirm?.label || 'Lưu'}
              </button>
            </>
          }
        >
          {shipConfirm ? (
            <div className="confirm-dialog__body">
              <p>{shipConfirm.summary}</p>
              {shipConfirm.gapNote ? (
                <p className="voucher-warn-text">{shipConfirm.gapNote}</p>
              ) : null}
              <p>{SHIPPING_APPLY_NOTE}</p>
            </div>
          ) : null}
        </AdminModal>
      )}
    </div>
  );
}
