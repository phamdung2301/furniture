import { useEffect, useRef, useState } from 'react';
import SlideOver from './SlideOver';
import ConfirmDialog from './ConfirmDialog';
import {
  createFlashSale,
  flashSaleStatus,
  getFlashSale,
  updateFlashSale,
} from '../../api/adminPromoApi';
import { getProduct, listProducts } from '../../api/adminProductApi';
import { formatVND } from '../../utils/format';

/**
 * Form tạo/sửa chương trình flash sale — slide-over 560px,
 * admin-flash-sale-shipping.md §3 (FR-028 · F-022 · US-019).
 * 2 nhóm: Thông tin chung (tên nội bộ chỉ admin thấy, code tự sinh chỉ-đọc,
 * khung giờ, tổng suất, giới hạn 2 suất/khách CHỈ-ĐỌC) → Sản phẩm tham gia
 * (items[]: phạm vi màu, flashPrice XOR discountPercent + trần, itemQuota).
 * Ma trận khóa trường theo vòng đời §3.5 enforce cả FE lẫn BE; tắt chương
 * trình đang chạy ngay trong form vẫn qua confirm hậu quả §4.1.
 */

const pad2 = (n) => String(n).padStart(2, '0');

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function localInputOf(date, hh, mm) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(hh)}:${pad2(mm)}`;
}

let itemSeq = 0;
const nextKey = () => `it${(itemSeq += 1)}`;

function blankItem(product, variants) {
  return {
    key: nextKey(),
    productId: product.id,
    productName: product.name,
    image: product.images?.[0]?.url || null,
    variants: variants || [],
    scopeAll: true,
    variantId: null,
    kind: 'PERCENT', // PERCENT | FIXED
    flashPrice: '',
    discountPercent: '',
    maxDiscount: '',
    quotaUnlimited: false,
    itemQuota: '',
    itemSoldCount: 0,
    error: '',
  };
}

function detailItemToForm(item, detail) {
  const variants = (detail?.variants || []).map((v) => ({
    id: v.id,
    color: v.color,
    colorHex: v.colorHex,
    price: v.price,
    stock: v.stock,
  }));
  return {
    key: nextKey(),
    productId: item.productId,
    productName: item.productName || detail?.name || item.productId,
    image: item.image || detail?.images?.[0]?.url || null,
    variants,
    scopeAll: item.variantId == null,
    variantId: item.variantId ?? null,
    kind: item.flashPrice != null ? 'FIXED' : 'PERCENT',
    flashPrice: item.flashPrice != null ? String(item.flashPrice) : '',
    discountPercent: item.discountPercent != null ? String(item.discountPercent) : '',
    maxDiscount: item.maxDiscount != null ? String(item.maxDiscount) : '',
    quotaUnlimited: item.itemQuota == null,
    itemQuota: item.itemQuota != null ? String(item.itemQuota) : '',
    itemSoldCount: item.itemSoldCount || 0,
    error: '',
  };
}

function blankForm() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  return {
    name: '',
    code: '',
    active: true,
    startAt: localInputOf(now, 20, 0),
    endAt: localInputOf(end, 22, 0),
    totalUnlimited: false,
    totalUsageLimit: '',
    items: [],
  };
}

function detailToForm(d) {
  return {
    name: d.name || '',
    code: d.code || '',
    active: d.active !== false,
    startAt: toLocalInput(d.startAt),
    endAt: toLocalInput(d.endAt),
    totalUnlimited: !d.totalUsageLimit,
    totalUsageLimit: d.totalUsageLimit ? String(d.totalUsageLimit) : '',
    items: [],
  };
}

function Field({ label, required, error, hint, children, wide }) {
  return (
    <div
      className={`pf-field${wide ? ' pf-field--wide' : ''}${error ? ' has-error' : ''}`}
      data-invalid={error ? 'true' : undefined}
    >
      <label className="pf-field__label">
        {label}
        {required ? <span className="pf-required"> *</span> : null}
      </label>
      {children}
      {error ? <p className="pf-field__error">{error}</p> : null}
      {!error && hint ? <p className="pf-field__hint">{hint}</p> : null}
    </div>
  );
}

function Switch({ checked, onChange, label, hint, disabled }) {
  return (
    <div className="pf-switch-row">
      <div className="pf-switch-row__text">
        <span className="pf-switch-row__label">{label}</span>
        {hint ? <span className="pf-field__hint">{hint}</span> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`pf-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="pf-switch__dot" />
      </button>
    </div>
  );
}

/** Variant tham chiếu giá dự kiến: màu đã chọn, hoặc mặc định F-004 (còn hàng rẻ nhất). */
function refVariant(item) {
  const variants = item.variants || [];
  if (!item.scopeAll && item.variantId) {
    return variants.find((v) => v.id === item.variantId) || null;
  }
  const pool = variants.filter((v) => v.stock > 0);
  const src = pool.length ? pool : variants;
  return src.reduce((best, v) => (best == null || v.price < best.price ? v : best), null);
}

/** Giá flash dự kiến (tính nháp FE — giá chốt do hệ thống tính lại khi lưu, §3.4). */
function previewFlashPrice(item) {
  const ref = refVariant(item);
  if (!ref) return null;
  if (item.kind === 'FIXED') {
    const fp = Number(item.flashPrice);
    return item.flashPrice === '' || Number.isNaN(fp) ? null : fp;
  }
  const pct = Number(item.discountPercent);
  if (item.discountPercent === '' || Number.isNaN(pct)) return null;
  let discount = Math.round((ref.price * pct) / 100);
  if (item.maxDiscount !== '' && !Number.isNaN(Number(item.maxDiscount))) {
    discount = Math.min(discount, Number(item.maxDiscount));
  }
  const raw = ref.price - discount;
  if (raw <= 0) return 0;
  return Math.round(raw / 1000) * 1000; // làm tròn nghìn như backend
}

export default function FlashSaleFormSlideOver({
  programId, // null = tạo mới
  onClose,
  onSaved,
  onToast,
}) {
  const isEdit = Boolean(programId);
  const [form, setForm] = useState(blankForm);
  const [original, setOriginal] = useState(null);
  const [loadState, setLoadState] = useState({ loading: isEdit, error: null });
  const [errors, setErrors] = useState({});
  const [itemsError, setItemsError] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [confirmKind, setConfirmKind] = useState(null); // 'deactivate' | 'endNow'
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);
  const snapshotRef = useRef('');
  const rootRef = useRef(null);
  const productDebounceRef = useRef(null);

  const status = original ? flashSaleStatus(original) : null;
  const statusKey = status?.key || null;
  const readOnly = statusKey === 'ENDED';
  const runningLocked =
    statusKey === 'RUNNING' || (statusKey === 'INACTIVE' && (original?.usedCount || 0) > 0);
  const dirty =
    snapshotRef.current !== '' && JSON.stringify(form) !== snapshotRef.current;

  const takeSnapshot = (f) => {
    snapshotRef.current = JSON.stringify(f);
  };

  const loadDetail = async () => {
    setLoadState({ loading: true, error: null });
    try {
      const d = await getFlashSale(programId);
      setOriginal(d);
      const base = detailToForm(d);
      const items = await Promise.all(
        (d.items || []).map(async (item) => {
          let detail = null;
          try {
            detail = await getProduct(item.productId);
          } catch {
            detail = null;
          }
          return detailItemToForm(item, detail);
        })
      );
      const f = { ...base, items };
      setForm(f);
      takeSnapshot(f);
      setLoadState({ loading: false, error: null });
    } catch (e) {
      setLoadState({ loading: false, error: e });
    }
  };

  useEffect(() => {
    if (isEdit) {
      loadDetail();
    } else {
      const f = blankForm();
      setForm(f);
      takeSnapshot(f);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  const requestClose = () => {
    if (saving) return;
    if (dirty && !readOnly) setAskDiscard(true);
    else onClose?.();
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const patchItem = (key, patch) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((i) => (i.key === key ? { ...i, ...patch, error: '' } : i)),
    }));

  const removeItem = (key) =>
    setForm((f) => ({ ...f, items: f.items.filter((i) => i.key !== key) }));

  /* ------------------------- Tìm + thêm sản phẩm (§3.4) ------------------------- */

  const handleProductQuery = (value) => {
    setProductQuery(value);
    window.clearTimeout(productDebounceRef.current);
    if (!value.trim()) {
      setProductResults([]);
      return;
    }
    productDebounceRef.current = window.setTimeout(async () => {
      setProductSearching(true);
      try {
        const res = await listProducts({ q: value.trim(), active: true, page: 1, size: 8 });
        setProductResults(res?.content || []);
      } catch {
        setProductResults([]);
      } finally {
        setProductSearching(false);
      }
    }, 300);
  };

  const addProduct = async (p) => {
    setPickerOpen(false);
    setProductQuery('');
    setProductResults([]);
    let detail = null;
    try {
      detail = await getProduct(p.id);
    } catch {
      detail = null;
    }
    const variants = (detail?.variants || []).map((v) => ({
      id: v.id,
      color: v.color,
      colorHex: v.colorHex,
      price: v.price,
      stock: v.stock,
    }));
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        blankItem(
          { id: p.id, name: detail?.name || p.name, images: detail?.images || [{ url: p.image }] },
          variants
        ),
      ],
    }));
    setItemsError('');
  };

  /* ------------------------- Validate (§3.2, §3.4, §3.5) ------------------------- */

  const validate = () => {
    const e = {};
    const name = form.name.trim();
    if (name.length < 3 || name.length > 80)
      e.name = 'Tên chương trình phải từ 3 đến 80 ký tự.';
    if (!form.startAt) e.startAt = 'Thời gian bắt đầu là bắt buộc.';
    if (!form.endAt) e.endAt = 'Thời gian kết thúc là bắt buộc.';
    else if (form.startAt && new Date(form.endAt) <= new Date(form.startAt))
      e.endAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
    if (!form.totalUnlimited) {
      const limit = Number(form.totalUsageLimit);
      if (form.totalUsageLimit === '' || !Number.isInteger(limit) || limit < 1)
        e.totalUsageLimit = 'Tổng suất phải từ 1 trở lên.';
      else if (original && limit < original.usedCount)
        e.totalUsageLimit = `Tổng suất phải từ ${original.usedCount} trở lên (đã bán ${original.usedCount}).`;
      else if (runningLocked && original?.totalUsageLimit && limit < original.totalUsageLimit)
        e.totalUsageLimit = 'Chương trình đang chạy nên chỉ tăng được tổng suất, không giảm.';
    }
    let groupError = '';
    if (form.items.length === 0) groupError = 'Chương trình cần ít nhất 1 sản phẩm.';
    const nextItems = form.items.map((item) => {
      let error = '';
      const variants = item.variants || [];
      const dup = form.items.some((other) => {
        if (other.key === item.key || other.productId !== item.productId) return false;
        if (item.scopeAll || other.scopeAll) return true;
        return other.variantId === item.variantId;
      });
      if (dup) error = 'Sản phẩm/màu này đã có trong chương trình.';
      if (!error && item.kind === 'FIXED') {
        const fp = Number(item.flashPrice);
        const refPrices = item.scopeAll
          ? variants.map((v) => v.price)
          : [variants.find((v) => v.id === item.variantId)?.price].filter((n) => n != null);
        const refMin = refPrices.length ? Math.min(...refPrices) : null;
        if (item.flashPrice === '' || Number.isNaN(fp) || fp <= 0)
          error = 'Giá flash phải lớn hơn 0đ.';
        else if (refMin != null && fp >= refMin)
          error = `Giá flash phải nhỏ hơn giá bán (${formatVND(refMin)}).`;
      }
      if (!error && item.kind === 'PERCENT') {
        const pct = Number(item.discountPercent);
        if (item.discountPercent === '' || !Number.isInteger(pct) || pct < 1 || pct > 99)
          error = '% giảm phải từ 1 đến 99.';
        else if (item.maxDiscount !== '' && Number(item.maxDiscount) <= 0)
          error = 'Mức giảm tối đa phải lớn hơn 0đ.';
      }
      if (!error && !item.quotaUnlimited) {
        const quota = Number(item.itemQuota);
        if (item.itemQuota === '' || !Number.isInteger(quota) || quota < 1)
          error = 'Nhập suất cho món này hoặc chọn "Không giới hạn theo món".';
        else if (runningLocked && item.itemSoldCount != null) {
          const origItem = (original?.items || []).find(
            (i) => i.productId === item.productId && (i.variantId ?? null) === (item.scopeAll ? null : item.variantId)
          );
          if (origItem?.itemQuota != null && quota < origItem.itemQuota)
            error = 'Chương trình đang chạy nên chỉ tăng được suất riêng của món.';
        }
      }
      return { ...item, error };
    });
    if (nextItems.some((i) => i.error)) {
      setForm((f) => ({ ...f, items: nextItems }));
      if (!groupError) groupError = 'Một số sản phẩm chưa hợp lệ — kiểm tra thẻ món được đánh dấu bên dưới.';
    }
    return { e, groupError, ok: Object.keys(e).length === 0 && !groupError };
  };

  const scrollToFirstError = () => {
    window.requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector('[data-invalid="true"]');
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.querySelector('input, select, textarea')?.focus({ preventScroll: true });
      }
    });
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    startAt: new Date(form.startAt).toISOString(),
    endAt: new Date(form.endAt).toISOString(),
    totalUsageLimit: form.totalUnlimited ? 0 : Number(form.totalUsageLimit),
    active: form.active,
    items: form.items.map((item) => ({
      productId: item.productId,
      variantId: item.scopeAll ? null : item.variantId,
      flashPrice: item.kind === 'FIXED' ? Number(item.flashPrice) : null,
      discountPercent: item.kind === 'PERCENT' ? Number(item.discountPercent) : null,
      maxDiscount:
        item.kind === 'PERCENT' && item.maxDiscount !== '' ? Number(item.maxDiscount) : null,
      itemQuota: item.quotaUnlimited ? null : Number(item.itemQuota),
    })),
  });

  const doSave = async () => {
    setSaving(true);
    setBannerError('');
    try {
      const payload = buildPayload();
      const saved = isEdit
        ? await updateFlashSale(programId, payload)
        : await createFlashSale(payload);
      onSaved?.(saved, !isEdit);
    } catch (err) {
      const msg = err?.message || 'Không lưu được chương trình. Vui lòng thử lại.';
      if (msg.includes('Khung giờ trùng') || !err?.field) {
        // Trùng lịch + lỗi không map được -> banner đầu form (§3.6).
        setBannerError(msg);
      } else if (err.field === 'items') {
        setItemsError(msg);
      } else {
        setErrors((prev) => ({ ...prev, [err.field]: msg }));
        scrollToFirstError();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const { e, groupError, ok } = validate();
    setErrors(e);
    setItemsError(groupError);
    if (!ok) {
      scrollToFirstError();
      return;
    }
    // Tắt chương trình đang chạy/sắp chạy ngay trong form -> confirm §4.1.
    if (
      isEdit &&
      original?.active &&
      !form.active &&
      ['RUNNING', 'UPCOMING'].includes(statusKey)
    ) {
      setConfirmKind('deactivate');
      return;
    }
    // Rút ngắn endAt xuống <= hiện tại khi đang chạy = kết thúc ngay -> confirm §4.1.
    if (
      isEdit &&
      statusKey === 'RUNNING' &&
      form.endAt &&
      new Date(form.endAt) <= new Date() &&
      form.endAt !== toLocalInput(original?.endAt)
    ) {
      setConfirmKind('endNow');
      return;
    }
    doSave();
  };

  /* ------------------------- Render ------------------------- */

  const title = !isEdit
    ? 'Tạo chương trình flash sale'
    : readOnly
      ? 'Chi tiết chương trình'
      : 'Sửa chương trình';

  const footer = readOnly ? (
    <button type="button" className="btn btn-primary" onClick={() => onClose?.()}>
      Đóng
    </button>
  ) : (
    <>
      <button type="button" className="btn btn-secondary" onClick={requestClose} disabled={saving}>
        Hủy
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving || loadState.loading || Boolean(loadState.error)}
      >
        {saving ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo chương trình'}
      </button>
    </>
  );

  const itemsQuotaSum = form.items
    .filter((i) => !i.quotaUnlimited && i.itemQuota !== '')
    .reduce((s, i) => s + (Number(i.itemQuota) || 0), 0);
  const quotaWarn =
    !form.totalUnlimited &&
    form.totalUsageLimit !== '' &&
    itemsQuotaSum > 0 &&
    itemsQuotaSum < Number(form.totalUsageLimit);

  const fieldDisabled = readOnly || saving;

  return (
    <div ref={rootRef}>
      <SlideOver open title={title} onClose={requestClose} dirty={false} footer={footer}>
        {isEdit && original ? (
          <p className="promo-form__subtitle">
            {original.name} · <span className="promo-mono">{original.code}</span>
          </p>
        ) : null}

        {runningLocked && !readOnly ? (
          <div className="promo-banner is-warning">
            Chương trình đang chạy nên giá và danh sách sản phẩm đã khóa. Bạn chỉ có thể tăng
            suất, rút ngắn thời gian hoặc tắt chương trình.
          </div>
        ) : null}
        {readOnly ? (
          <div className="promo-banner is-info">
            Chương trình đã kết thúc — hiển thị chỉ để xem, không sửa được.
          </div>
        ) : null}
        {bannerError ? (
          <div className="promo-banner is-error">
            <span>{bannerError}</span>
            <button type="button" className="voucher-banner__retry" onClick={doSave} disabled={saving}>
              Thử lại
            </button>
          </div>
        ) : null}

        {loadState.loading ? (
          <div className="admin-skel-rows" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44 }} />
            ))}
          </div>
        ) : loadState.error ? (
          <div className="promo-banner is-error">
            <span>Không tải được chi tiết chương trình.</span>
            <button type="button" className="voucher-banner__retry" onClick={loadDetail}>
              Thử lại
            </button>
          </div>
        ) : (
          <>
            {/* ---------- Nhóm 1: Thông tin chung (§3.2) ---------- */}
            <h4 className="promo-form__group-title">Thông tin chung</h4>
            <Field
              label="Tên chương trình"
              required
              error={errors.name}
              hint="Tên chỉ để quản lý nội bộ — khách hàng không thấy tên này, phía khách chỉ hiển thị khung giờ và đếm ngược."
            >
              <input
                type="text"
                className="pf-input"
                value={form.name}
                maxLength={80}
                onChange={(ev) => set({ name: ev.target.value })}
                disabled={fieldDisabled}
                placeholder="VD: Flash sale cuối tuần"
              />
            </Field>

            <Field label="Mã chương trình">
              {isEdit ? (
                <input
                  type="text"
                  className="pf-input promo-mono"
                  value={form.code}
                  readOnly
                  disabled
                />
              ) : (
                <p className="pf-field__hint promo-code-note">
                  Mã sẽ được tự sinh khi tạo chương trình.
                </p>
              )}
            </Field>

            <div className="promo-form__grid2">
              <Field label="Bắt đầu" required error={errors.startAt}>
                <input
                  type="datetime-local"
                  className="pf-input"
                  value={form.startAt}
                  onChange={(ev) => set({ startAt: ev.target.value })}
                  disabled={fieldDisabled || runningLocked}
                />
              </Field>
              <Field label="Kết thúc" required error={errors.endAt}>
                <input
                  type="datetime-local"
                  className="pf-input"
                  value={form.endAt}
                  onChange={(ev) => set({ endAt: ev.target.value })}
                  disabled={fieldDisabled}
                />
              </Field>
            </div>

            <Field label="Tổng suất toàn chương trình" error={errors.totalUsageLimit}>
              <div className="voucher-suffix">
                <input
                  type="number"
                  className="pf-input"
                  min="1"
                  value={form.totalUsageLimit}
                  onChange={(ev) => set({ totalUsageLimit: ev.target.value })}
                  disabled={fieldDisabled || form.totalUnlimited}
                  placeholder="VD: 100"
                />
                <label className="voucher-unlimited">
                  <input
                    type="checkbox"
                    checked={form.totalUnlimited}
                    onChange={(ev) => set({ totalUnlimited: ev.target.checked })}
                    disabled={fieldDisabled}
                  />
                  Không giới hạn
                </label>
              </div>
            </Field>

            <div className="promo-readonly-row">
              <span className="pf-field__label">Giới hạn mỗi khách</span>
              <p className="promo-readonly-row__text">
                Mỗi khách hàng tối đa 2 suất cho mỗi chương trình.
              </p>
              <p className="pf-field__hint">
                Giới hạn cố định cho toàn hệ thống, không cấu hình riêng theo chương trình.
              </p>
            </div>

            {isEdit && original ? (
              <p className="promo-readonly-row__text">
                Đã bán: <strong>{original.usedCount} suất</strong>
              </p>
            ) : null}

            <Switch
              label="Kích hoạt chương trình"
              hint="Tắt = chương trình ở trạng thái Đã tắt, khách không thấy giá flash."
              checked={form.active}
              onChange={(v) => set({ active: v })}
              disabled={fieldDisabled}
            />

            {/* ---------- Nhóm 2: Sản phẩm tham gia (§3.4) ---------- */}
            <div className="promo-form__group-head">
              <h4 className="promo-form__group-title">
                Sản phẩm tham gia <span className="pf-required">*</span>
              </h4>
              {!runningLocked && !readOnly ? (
                <button
                  type="button"
                  className="btn btn-text promo-add-btn"
                  onClick={() => setPickerOpen((v) => !v)}
                >
                  + Thêm sản phẩm
                </button>
              ) : null}
            </div>

            {itemsError ? <p className="pf-field__error">{itemsError}</p> : null}

            {pickerOpen && !runningLocked && !readOnly ? (
              <div className="voucher-product-picker">
                <input
                  type="search"
                  className="pf-input"
                  value={productQuery}
                  onChange={(ev) => handleProductQuery(ev.target.value)}
                  placeholder="Tìm sản phẩm theo tên…"
                  aria-label="Tìm sản phẩm"
                />
                {productSearching ? <p className="pf-field__hint">Đang tìm…</p> : null}
                {productResults.length > 0 ? (
                  <ul className="voucher-product-results">
                    {productResults.map((p) => {
                      const added = form.items.some((i) => i.productId === p.id);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            disabled={added}
                            onClick={() => addProduct(p)}
                          >
                            {p.name}
                            {added ? ' — Đã thêm' : p.minPrice != null ? ` · từ ${formatVND(p.minPrice)}` : ''}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {form.items.length === 0 ? (
              <div className="promo-items-empty">
                Chưa có sản phẩm nào. Bấm &quot;+ Thêm sản phẩm&quot; để chọn món đưa vào chương
                trình.
              </div>
            ) : (
              <div className="promo-items">
                {form.items.map((item) => {
                  const ref = refVariant(item);
                  const preview = previewFlashPrice(item);
                  const equivPct =
                    item.kind === 'FIXED' && ref && preview != null && ref.price > preview
                      ? Math.round(((ref.price - preview) / ref.price) * 100)
                      : null;
                  const multiPrice =
                    item.scopeAll &&
                    item.kind === 'PERCENT' &&
                    new Set((item.variants || []).map((v) => v.price)).size > 1;
                  return (
                    <div
                      key={item.key}
                      className={`promo-item-card${item.error ? ' has-error' : ''}`}
                      data-invalid={item.error ? 'true' : undefined}
                    >
                      <div className="promo-item-card__head">
                        {item.image ? (
                          <img src={item.image} alt="" className="promo-item-card__thumb" />
                        ) : (
                          <span className="promo-item-card__thumb promo-item-card__thumb--empty" />
                        )}
                        <span className="promo-item-card__name">{item.productName}</span>
                        {!runningLocked && !readOnly ? (
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={() => removeItem(item.key)}
                            aria-label={`Xóa ${item.productName} khỏi chương trình`}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>

                      <div className="promo-item-card__row">
                        <span className="pf-field__label">Phạm vi màu</span>
                        <label className="voucher-scope__option">
                          <input
                            type="radio"
                            name={`${item.key}-scope`}
                            checked={item.scopeAll}
                            onChange={() => patchItem(item.key, { scopeAll: true, variantId: null })}
                            disabled={fieldDisabled || runningLocked}
                          />
                          Tất cả các màu
                        </label>
                        <label className="voucher-scope__option">
                          <input
                            type="radio"
                            name={`${item.key}-scope`}
                            checked={!item.scopeAll}
                            onChange={() =>
                              patchItem(item.key, {
                                scopeAll: false,
                                variantId: item.variantId || item.variants[0]?.id || null,
                              })
                            }
                            disabled={fieldDisabled || runningLocked}
                          />
                          Chỉ 1 màu
                        </label>
                        {!item.scopeAll ? (
                          <div className="promo-variant-list">
                            {(item.variants || []).map((v) => (
                              <label key={v.id} className="promo-variant-option">
                                <input
                                  type="radio"
                                  name={`${item.key}-variant`}
                                  checked={item.variantId === v.id}
                                  onChange={() => patchItem(item.key, { variantId: v.id })}
                                  disabled={fieldDisabled || runningLocked}
                                />
                                <span
                                  className="promo-color-dot"
                                  style={{ background: v.colorHex || '#ccc' }}
                                  aria-hidden="true"
                                />
                                {v.color} · {formatVND(v.price)} · Còn {v.stock}
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="promo-item-card__row">
                        <span className="pf-field__label">Kiểu giảm</span>
                        <div className="voucher-segment" role="group" aria-label="Kiểu giảm">
                          <button
                            type="button"
                            className={item.kind === 'FIXED' ? 'is-active' : ''}
                            onClick={() => patchItem(item.key, { kind: 'FIXED' })}
                            disabled={fieldDisabled || runningLocked}
                          >
                            Giá flash cố định
                          </button>
                          <button
                            type="button"
                            className={item.kind === 'PERCENT' ? 'is-active' : ''}
                            onClick={() => patchItem(item.key, { kind: 'PERCENT' })}
                            disabled={fieldDisabled || runningLocked}
                          >
                            Giảm %
                          </button>
                        </div>
                        {item.kind === 'FIXED' ? (
                          <div className="voucher-suffix">
                            <input
                              type="number"
                              className="pf-input"
                              min="0"
                              value={item.flashPrice}
                              onChange={(ev) => patchItem(item.key, { flashPrice: ev.target.value })}
                              disabled={fieldDisabled || runningLocked}
                              placeholder="VD: 990000"
                              aria-label="Giá flash cố định"
                            />
                            <span className="voucher-suffix__unit">đ</span>
                            {equivPct != null ? (
                              <span className="pf-field__hint">Tương đương giảm {equivPct}%</span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="promo-percent-row">
                            <div className="voucher-suffix">
                              <input
                                type="number"
                                className="pf-input"
                                min="1"
                                max="99"
                                value={item.discountPercent}
                                onChange={(ev) => patchItem(item.key, { discountPercent: ev.target.value })}
                                disabled={fieldDisabled || runningLocked}
                                placeholder="VD: 30"
                                aria-label="Phần trăm giảm"
                              />
                              <span className="voucher-suffix__unit">%</span>
                            </div>
                            <div className="voucher-suffix">
                              <input
                                type="number"
                                className="pf-input"
                                min="0"
                                value={item.maxDiscount}
                                onChange={(ev) => patchItem(item.key, { maxDiscount: ev.target.value })}
                                disabled={fieldDisabled || runningLocked}
                                placeholder="Giảm tối đa (trần) — không bắt buộc"
                                aria-label="Giảm tối đa (trần)"
                              />
                              <span className="voucher-suffix__unit">đ</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {ref ? (
                        <p className="promo-item-card__preview">
                          Giá gốc {formatVND(ref.price)} → Giá flash dự kiến{' '}
                          {preview != null ? formatVND(preview) : '…'}
                          <span className="pf-field__hint">
                            {' '}
                            · Giá chốt do hệ thống tính lại khi lưu.
                          </span>
                          {multiPrice ? (
                            <span className="pf-field__hint">
                              {' '}
                              Giá flash từng màu có thể khác nhau theo giá gốc của màu.
                            </span>
                          ) : null}
                        </p>
                      ) : null}

                      <div className="promo-item-card__row">
                        <span className="pf-field__label">Suất riêng của món</span>
                        <div className="voucher-suffix">
                          <input
                            type="number"
                            className="pf-input"
                            min="1"
                            value={item.itemQuota}
                            onChange={(ev) => patchItem(item.key, { itemQuota: ev.target.value })}
                            disabled={fieldDisabled || item.quotaUnlimited}
                            placeholder="VD: 20"
                            aria-label="Suất riêng của món"
                          />
                          <label className="voucher-unlimited">
                            <input
                              type="checkbox"
                              checked={item.quotaUnlimited}
                              onChange={(ev) => patchItem(item.key, { quotaUnlimited: ev.target.checked })}
                              disabled={fieldDisabled || runningLocked}
                            />
                            Không giới hạn theo món
                          </label>
                        </div>
                        {isEdit ? (
                          <p className="pf-field__hint">
                            Đã bán: {item.itemSoldCount}
                            {item.quotaUnlimited ? '' : item.itemQuota ? ` / ${item.itemQuota}` : ''}
                          </p>
                        ) : null}
                      </div>

                      {item.error ? <p className="pf-field__error">{item.error}</p> : null}
                    </div>
                  );
                })}
              </div>
            )}

            {quotaWarn ? (
              <p className="voucher-warn-text promo-quota-warn">
                Tổng suất theo món ({itemsQuotaSum}) đang nhỏ hơn tổng suất toàn chương trình (
                {form.totalUsageLimit}) — chương trình sẽ hết suất theo món trước.
              </p>
            ) : null}
          </>
        )}
      </SlideOver>

      <ConfirmDialog
        open={askDiscard}
        title="Đóng mà không lưu?"
        confirmLabel="Đóng"
        onCancel={() => setAskDiscard(false)}
        onConfirm={() => {
          setAskDiscard(false);
          onClose?.();
        }}
      >
        <p>Bạn có thay đổi chưa lưu. Đóng mà không lưu?</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmKind != null}
        title={
          confirmKind === 'endNow'
            ? `Kết thúc chương trình "${original?.name || ''}" ngay?`
            : `Tắt chương trình "${original?.name || ''}"?`
        }
        confirmLabel={confirmKind === 'endNow' ? 'Kết thúc ngay' : 'Tắt chương trình'}
        loading={saving}
        onCancel={() => setConfirmKind(null)}
        onConfirm={() => {
          setConfirmKind(null);
          doSave();
        }}
      >
        {statusKey === 'UPCOMING' && confirmKind === 'deactivate' ? (
          <p>
            Chương trình sẽ không bắt đầu theo lịch đã đặt và khách sẽ không thấy chương trình
            này. Bạn có thể bật lại trước giờ bắt đầu.
          </p>
        ) : (
          <p>
            Khách hàng sẽ mất giá flash sale ngay lập tức: trang flash sale và giá ở trang sản
            phẩm trở về giá thường, đơn đang ở bước đặt hàng sẽ chốt theo giá thường. Các đơn đã
            đặt trước đó giữ nguyên giá flash sale đã chốt. Suất đã bán ({original?.usedCount || 0})
            được giữ nguyên và bạn có thể bật lại chương trình sau.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
