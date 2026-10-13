import { useEffect, useRef, useState } from 'react';
import SlideOver from './SlideOver';
import ConfirmDialog from './ConfirmDialog';
import {
  createVoucher,
  getVoucher,
  updateVoucher,
  voucherStatus,
} from '../../api/adminVoucherApi';
import { listCategories } from '../../api/adminCategoryApi';
import { getProduct, listProducts } from '../../api/adminProductApi';
import { formatVND } from '../../utils/format';

/**
 * Form tạo/sửa voucher — slide-over 560px, admin-voucher.md §3 (FR-024 · F-018 · US-017).
 * 4 nhóm: Mã & trạng thái · Mức giảm · Điều kiện & phạm vi · Giới hạn & thời gian
 * + khối xem trước mô tả như khách thấy ở checkout (§3.6, đúng format backend).
 * Validate inline khớp AdminVoucherService; lỗi 409/422 gắn đúng trường qua
 * e.field; tắt voucher đang chạy ngay trong form vẫn qua confirm §4.1.
 */

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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

function blankForm() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
  return {
    code: '',
    active: true,
    type: 'PERCENT',
    valuePercent: '',
    valueFixed: '',
    maxDiscount: '',
    minOrderValue: '0',
    scope: 'all', // all | categories | products
    categoryIds: [],
    totalUnlimited: false,
    totalUsageLimit: '',
    perUserUnlimited: true,
    perUserLimit: '',
    startAt: localInputOf(now, 0, 0),
    endAt: localInputOf(end, 23, 59),
  };
}

function detailToForm(d) {
  const scope =
    (d.applicableProductIds || []).length > 0
      ? 'products'
      : (d.applicableCategories || []).length > 0
        ? 'categories'
        : 'all';
  return {
    code: d.code || '',
    active: d.active !== false,
    type: d.type || 'PERCENT',
    valuePercent: d.type === 'PERCENT' && d.value != null ? String(d.value) : '',
    valueFixed: d.type === 'FIXED' && d.value != null ? String(d.value) : '',
    maxDiscount: d.maxDiscount != null ? String(d.maxDiscount) : '',
    minOrderValue: d.minOrderValue != null ? String(d.minOrderValue) : '0',
    scope,
    categoryIds: [...(d.applicableCategories || [])],
    totalUnlimited: !d.totalUsageLimit,
    totalUsageLimit: d.totalUsageLimit ? String(d.totalUsageLimit) : '',
    perUserUnlimited: d.perUserLimit == null || d.perUserLimit === 0,
    perUserLimit: d.perUserLimit ? String(d.perUserLimit) : '',
    startAt: toLocalInput(d.startAt),
    endAt: toLocalInput(d.endAt),
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

function Switch({ checked, onChange, label, hint }) {
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
      >
        <span className="pf-switch__dot" />
      </button>
    </div>
  );
}

export default function VoucherFormSlideOver({
  voucherId, // null = tạo mới
  onClose,
  onSaved,
  onToast,
}) {
  const isEdit = Boolean(voucherId);
  const [form, setForm] = useState(blankForm);
  const [original, setOriginal] = useState(null); // voucher gốc khi sửa (giữ usedCount/active)
  const [loadState, setLoadState] = useState({ loading: isEdit, error: null });
  const [categories, setCategories] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]); // [{ id, name }]
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);
  const [errors, setErrors] = useState({});
  const [bannerError, setBannerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [askDeactivate, setAskDeactivate] = useState(false);
  const snapshotRef = useRef('');
  const rootRef = useRef(null);
  const productDebounceRef = useRef(null);

  const dirty =
    snapshotRef.current !== '' &&
    JSON.stringify({ form, selectedProducts }) !== snapshotRef.current;

  const takeSnapshot = (f, products) => {
    snapshotRef.current = JSON.stringify({ form: f, selectedProducts: products });
  };

  const loadDetail = async () => {
    setLoadState({ loading: true, error: null });
    try {
      const [d, cats] = await Promise.all([getVoucher(voucherId), listCategories()]);
      setCategories(cats || []);
      const f = detailToForm(d);
      setForm(f);
      setOriginal(d);
      // Giải tên sản phẩm đã chọn (phạm vi theo sản phẩm) để hiện chip.
      const products = await Promise.all(
        (d.applicableProductIds || []).map(async (id) => {
          try {
            const p = await getProduct(id);
            return { id, name: p?.name || id };
          } catch {
            return { id, name: id };
          }
        })
      );
      setSelectedProducts(products);
      takeSnapshot(f, products);
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
      takeSnapshot(f, []);
      listCategories()
        .then((cats) => setCategories(cats || []))
        .catch(() => setCategories([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherId]);

  const requestClose = () => {
    if (saving) return;
    if (dirty) setAskDiscard(true);
    else onClose?.();
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  /* ------------------------- Tìm sản phẩm cho phạm vi ------------------------- */

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
        const res = await listProducts({ q: value.trim(), page: 1, size: 8 });
        setProductResults(res?.content || []);
      } catch {
        setProductResults([]);
      } finally {
        setProductSearching(false);
      }
    }, 300);
  };

  const addProduct = (p) => {
    setSelectedProducts((prev) =>
      prev.some((x) => x.id === p.id) ? prev : [...prev, { id: p.id, name: p.name }]
    );
    setProductQuery('');
    setProductResults([]);
  };

  const removeProduct = (id) =>
    setSelectedProducts((prev) => prev.filter((x) => x.id !== id));

  /* ------------------------- Trợ nhập nhanh ------------------------- */

  const genRandomCode = () => {
    let code = '';
    for (let i = 0; i < 8; i += 1) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    set({ code });
  };

  const applyQuickRange = (kind) => {
    const now = new Date();
    const start = localInputOf(now, 0, 0);
    let endDate;
    if (kind === 'month') {
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + kind);
    }
    set({ startAt: start, endAt: localInputOf(endDate, 23, 59) });
  };

  /* ------------------------- Xem trước (§3.6) ------------------------- */

  const previewText = (() => {
    const min = Number(form.minOrderValue) || 0;
    const minPart = min > 0 ? ` — đơn từ ${formatVND(min)}` : '';
    if (form.type === 'PERCENT') {
      const v = form.valuePercent === '' ? '…' : form.valuePercent;
      const cap = form.maxDiscount === '' ? '…' : formatVND(Number(form.maxDiscount));
      return `Giảm ${v}% tối đa ${cap}${minPart}`;
    }
    const v = form.valueFixed === '' ? '…' : formatVND(Number(form.valueFixed));
    return `Giảm ${v}${minPart}`;
  })();

  const endInPast = form.endAt !== '' && new Date(form.endAt) < new Date();
  const perUserWarn =
    !form.perUserUnlimited &&
    !form.totalUnlimited &&
    form.perUserLimit !== '' &&
    form.totalUsageLimit !== '' &&
    Number(form.perUserLimit) > Number(form.totalUsageLimit);

  /* ------------------------- Validate + Lưu ------------------------- */

  const validate = () => {
    const e = {};
    const code = form.code.trim().toUpperCase();
    if (!code) e.code = 'Mã voucher là bắt buộc.';
    else if (!/^[A-Z0-9_-]{3,30}$/.test(code))
      e.code = 'Mã chỉ gồm chữ in hoa, số, dấu - và _.';
    if (form.type === 'PERCENT') {
      const v = Number(form.valuePercent);
      if (form.valuePercent === '' || Number.isNaN(v) || v < 1 || v > 100)
        e.value = 'Phần trăm giảm phải từ 1 đến 100.';
      if (form.maxDiscount === '') e.maxDiscount = 'Nhập mức giảm tối đa khi giảm theo %.';
      else if (Number(form.maxDiscount) <= 0)
        e.maxDiscount = 'Mức giảm tối đa phải lớn hơn 0đ.';
    } else {
      const v = Number(form.valueFixed);
      if (form.valueFixed === '' || Number.isNaN(v) || v <= 0)
        e.value = 'Số tiền giảm phải lớn hơn 0đ.';
    }
    if (form.minOrderValue !== '' && Number(form.minOrderValue) < 0)
      e.minOrderValue = 'Giá trị đơn tối thiểu không được âm.';
    if (form.scope === 'categories' && form.categoryIds.length === 0)
      e.scope = 'Chọn ít nhất 1 danh mục.';
    if (form.scope === 'products' && selectedProducts.length === 0)
      e.scope = 'Chọn ít nhất 1 sản phẩm.';
    if (!form.totalUnlimited) {
      const limit = Number(form.totalUsageLimit);
      if (form.totalUsageLimit === '' || !Number.isInteger(limit) || limit < 1)
        e.totalUsageLimit = 'Tổng giới hạn lượt phải từ 1 trở lên.';
      else if (original && limit < original.usedCount)
        e.totalUsageLimit = `Giới hạn phải từ ${original.usedCount} lượt trở lên (đã dùng ${original.usedCount}).`;
    }
    if (!form.perUserUnlimited) {
      const limit = Number(form.perUserLimit);
      if (form.perUserLimit === '' || !Number.isInteger(limit) || limit < 1)
        e.perUserLimit = 'Giới hạn mỗi khách phải từ 1 trở lên.';
    }
    if (!form.startAt) e.startAt = 'Thời gian bắt đầu là bắt buộc.';
    if (!form.endAt) e.endAt = 'Thời gian kết thúc là bắt buộc.';
    else if (form.startAt && new Date(form.endAt) <= new Date(form.startAt))
      e.endAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
    return { e, ok: Object.keys(e).length === 0 };
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
    code: form.code.trim().toUpperCase(),
    type: form.type,
    value: Number(form.type === 'PERCENT' ? form.valuePercent : form.valueFixed),
    maxDiscount: form.type === 'PERCENT' ? Number(form.maxDiscount) : null,
    minOrderValue: form.minOrderValue === '' ? 0 : Number(form.minOrderValue),
    applicableCategories: form.scope === 'categories' ? [...form.categoryIds] : [],
    applicableProductIds:
      form.scope === 'products' ? selectedProducts.map((p) => p.id) : [],
    perUserLimit: form.perUserUnlimited ? null : Number(form.perUserLimit),
    startAt: new Date(form.startAt).toISOString(),
    endAt: new Date(form.endAt).toISOString(),
    totalUsageLimit: form.totalUnlimited ? 0 : Number(form.totalUsageLimit),
    active: form.active,
  });

  const doSave = async () => {
    setSaving(true);
    setBannerError('');
    try {
      const payload = buildPayload();
      const saved = isEdit
        ? await updateVoucher(voucherId, payload)
        : await createVoucher(payload);
      onSaved?.(saved, !isEdit);
    } catch (err) {
      if (err?.field) {
        // 409 trùng mã / 422 validate backend: gắn đúng trường (§3.7).
        setErrors((prev) => ({ ...prev, [err.field]: err.message }));
        scrollToFirstError();
      } else {
        setBannerError(err?.message || 'Không lưu được voucher. Vui lòng thử lại.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const { e, ok } = validate();
    setErrors(e);
    if (!ok) {
      scrollToFirstError();
      return;
    }
    // Tắt voucher đang chạy/sắp chạy ngay trong form → confirm hậu quả §4.1
    // trước khi gọi API (giống hành động Vô hiệu hóa ở bảng).
    if (
      isEdit &&
      original?.active &&
      !form.active &&
      ['RUNNING', 'UPCOMING'].includes(voucherStatus(original).key)
    ) {
      setAskDeactivate(true);
      return;
    }
    doSave();
  };

  /* ------------------------- Render ------------------------- */

  const categoryOptions = (() => {
    const roots = categories.filter((c) => !c.parentId);
    const out = [];
    roots.forEach((r) => {
      out.push({ id: r.id, label: r.name, child: false });
      categories
        .filter((c) => c.parentId === r.id)
        .forEach((c) => out.push({ id: c.id, label: c.name, child: true }));
    });
    categories
      .filter((c) => c.parentId && !roots.some((r) => r.id === c.parentId))
      .forEach((c) => out.push({ id: c.id, label: c.name, child: false }));
    return out;
  })();

  const footer = (
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
        {saving ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo voucher'}
      </button>
    </>
  );

  const codeLocked = isEdit && (original?.usedCount || 0) > 0;

  return (
    <>
      <SlideOver
        open
        title={isEdit ? `Sửa voucher ${original?.code || ''}` : 'Tạo voucher'}
        onClose={requestClose}
        footer={footer}
        dirty={false}
      >
        <div ref={rootRef} className="pform voucher-form">
          {loadState.loading ? (
            <div className="pform__loading" aria-busy="true">
              <div className="skeleton" style={{ height: 22, width: '55%' }} />
              <div className="skeleton" style={{ height: 40 }} />
              <div className="skeleton" style={{ height: 40 }} />
              <div className="skeleton" style={{ height: 120 }} />
              <div className="skeleton" style={{ height: 22, width: '45%' }} />
              <div className="skeleton" style={{ height: 90 }} />
            </div>
          ) : loadState.error ? (
            <div className="data-table__state">
              <p>Không tải được thông tin voucher.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadDetail}>
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {bannerError ? (
                <div className="voucher-banner is-error" role="alert">
                  <span>{bannerError}</span>
                  <button type="button" className="voucher-banner__retry" onClick={doSave}>
                    Thử lại
                  </button>
                </div>
              ) : null}
              {endInPast ? (
                <div className="voucher-banner is-warning" role="alert">
                  Voucher sẽ ở trạng thái Hết hạn ngay sau khi lưu.
                </div>
              ) : null}

              {/* -------- Nhóm 1: Mã & trạng thái (§3.2) -------- */}
              <section className="pform-section">
                <h4 className="pform-section__title">Mã &amp; trạng thái</h4>
                <div className="pform-grid">
                  <Field
                    label="Mã voucher"
                    required
                    error={errors.code}
                    hint={
                      codeLocked
                        ? 'Không đổi được mã khi voucher đã có lượt dùng.'
                        : undefined
                    }
                    wide
                  >
                    <div className="voucher-code-row">
                      <input
                        className="pf-input voucher-code-input"
                        value={form.code}
                        disabled={codeLocked}
                        maxLength={30}
                        onChange={(e) =>
                          set({ code: e.target.value.toUpperCase().replace(/\s/g, '') })
                        }
                        placeholder="VD: KHAITRUONG"
                        aria-label="Mã voucher"
                      />
                      {!codeLocked ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={genRandomCode}
                        >
                          Tạo mã ngẫu nhiên
                        </button>
                      ) : null}
                    </div>
                  </Field>
                </div>
                {isEdit && original ? (
                  <p className="pf-note">Đã dùng: {original.usedCount} lượt</p>
                ) : null}
                <Switch
                  label="Kích hoạt"
                  hint="Tắt = voucher ở trạng thái Đã tắt, khách không áp được mã này."
                  checked={form.active}
                  onChange={(v) => set({ active: v })}
                />
              </section>

              {/* -------- Nhóm 2: Mức giảm (§3.3) -------- */}
              <section className="pform-section">
                <h4 className="pform-section__title">Mức giảm</h4>
                <Field label="Loại giảm" required>
                  <div className="voucher-segment" role="group" aria-label="Loại giảm">
                    <button
                      type="button"
                      className={form.type === 'PERCENT' ? 'is-active' : ''}
                      onClick={() => set({ type: 'PERCENT' })}
                      aria-pressed={form.type === 'PERCENT'}
                    >
                      Giảm %
                    </button>
                    <button
                      type="button"
                      className={form.type === 'FIXED' ? 'is-active' : ''}
                      onClick={() => set({ type: 'FIXED' })}
                      aria-pressed={form.type === 'FIXED'}
                    >
                      Giảm số tiền
                    </button>
                  </div>
                </Field>
                <div className="pform-grid">
                  {form.type === 'PERCENT' ? (
                    <>
                      <Field label="Phần trăm giảm" required error={errors.value}>
                        <div className="voucher-suffix">
                          <input
                            className="pf-input"
                            type="number"
                            min="1"
                            max="100"
                            step="1"
                            value={form.valuePercent}
                            onChange={(e) => set({ valuePercent: e.target.value })}
                            placeholder="10"
                          />
                          <span className="voucher-suffix__unit">%</span>
                        </div>
                      </Field>
                      <Field label="Giảm tối đa" required error={errors.maxDiscount}>
                        <div className="voucher-suffix">
                          <input
                            className="pf-input"
                            type="number"
                            min="0"
                            step="1000"
                            value={form.maxDiscount}
                            onChange={(e) => set({ maxDiscount: e.target.value })}
                            placeholder="200000"
                          />
                          <span className="voucher-suffix__unit">đ</span>
                        </div>
                      </Field>
                    </>
                  ) : (
                    <Field label="Số tiền giảm" required error={errors.value}>
                      <div className="voucher-suffix">
                        <input
                          className="pf-input"
                          type="number"
                          min="0"
                          step="1000"
                          value={form.valueFixed}
                          onChange={(e) => set({ valueFixed: e.target.value })}
                          placeholder="100000"
                        />
                        <span className="voucher-suffix__unit">đ</span>
                      </div>
                    </Field>
                  )}
                </div>
              </section>

              {/* -------- Nhóm 3: Điều kiện & phạm vi (§3.4) -------- */}
              <section className="pform-section">
                <h4 className="pform-section__title">Điều kiện &amp; phạm vi áp dụng</h4>
                <div className="pform-grid">
                  <Field
                    label="Đơn tối thiểu"
                    error={errors.minOrderValue}
                    hint="Tính trên tổng các dòng thường của đơn (không gồm dòng flash sale, không gồm phí vận chuyển). 0 = mọi đơn hàng đều dùng được."
                    wide
                  >
                    <div className="voucher-suffix">
                      <input
                        className="pf-input"
                        type="number"
                        min="0"
                        step="10000"
                        value={form.minOrderValue}
                        onChange={(e) => set({ minOrderValue: e.target.value })}
                        placeholder="0"
                      />
                      <span className="voucher-suffix__unit">đ</span>
                    </div>
                  </Field>
                </div>
                <Field label="Phạm vi áp dụng" error={errors.scope}>
                  <div className="voucher-scope">
                    <label className="voucher-scope__option">
                      <input
                        type="radio"
                        name="voucher-scope"
                        checked={form.scope === 'all'}
                        onChange={() => set({ scope: 'all' })}
                      />
                      Toàn đơn
                    </label>
                    <label className="voucher-scope__option">
                      <input
                        type="radio"
                        name="voucher-scope"
                        checked={form.scope === 'categories'}
                        onChange={() => set({ scope: 'categories' })}
                      />
                      Theo danh mục
                    </label>
                    <label className="voucher-scope__option">
                      <input
                        type="radio"
                        name="voucher-scope"
                        checked={form.scope === 'products'}
                        onChange={() => set({ scope: 'products' })}
                      />
                      Theo sản phẩm cụ thể
                    </label>
                  </div>
                </Field>
                {form.scope === 'categories' ? (
                  <div className="voucher-cat-list">
                    {categoryOptions.length === 0 ? (
                      <p className="pf-field__hint">Chưa tải được danh sách danh mục.</p>
                    ) : (
                      categoryOptions.map((c) => (
                        <label
                          key={c.id}
                          className={`voucher-cat-item${c.child ? ' is-child' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={form.categoryIds.includes(c.id)}
                            onChange={(e) =>
                              set({
                                categoryIds: e.target.checked
                                  ? [...form.categoryIds, c.id]
                                  : form.categoryIds.filter((id) => id !== c.id),
                              })
                            }
                          />
                          {c.label}
                        </label>
                      ))
                    )}
                  </div>
                ) : null}
                {form.scope === 'products' ? (
                  <div className="voucher-product-picker">
                    <input
                      className="pf-input"
                      type="search"
                      value={productQuery}
                      onChange={(e) => handleProductQuery(e.target.value)}
                      placeholder="Tìm sản phẩm để thêm…"
                      aria-label="Tìm sản phẩm để thêm vào phạm vi"
                    />
                    {productSearching ? (
                      <p className="pf-field__hint">Đang tìm…</p>
                    ) : null}
                    {productResults.length > 0 ? (
                      <ul className="voucher-product-results">
                        {productResults
                          .filter((p) => !selectedProducts.some((x) => x.id === p.id))
                          .map((p) => (
                            <li key={p.id}>
                              <button type="button" onClick={() => addProduct(p)}>
                                {p.name}
                              </button>
                            </li>
                          ))}
                      </ul>
                    ) : null}
                    <div className="voucher-chips">
                      {selectedProducts.map((p) => (
                        <span key={p.id} className="voucher-chip">
                          {p.name}
                          <button
                            type="button"
                            onClick={() => removeProduct(p.id)}
                            aria-label={`Bỏ ${p.name} khỏi phạm vi`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {selectedProducts.length === 0 ? (
                        <span className="pf-field__hint">Chưa chọn sản phẩm nào.</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <p className="pf-field__hint">
                  Mã giảm giá không áp dụng cho các sản phẩm đang flash sale.
                </p>
              </section>

              {/* -------- Nhóm 4: Giới hạn & thời gian (§3.5) -------- */}
              <section className="pform-section">
                <h4 className="pform-section__title">Giới hạn lượt &amp; thời gian hiệu lực</h4>
                <div className="pform-grid">
                  <Field label="Tổng giới hạn lượt" error={errors.totalUsageLimit}>
                    <input
                      className="pf-input"
                      type="number"
                      min="1"
                      step="1"
                      value={form.totalUsageLimit}
                      disabled={form.totalUnlimited}
                      onChange={(e) => set({ totalUsageLimit: e.target.value })}
                      placeholder="500"
                    />
                    <label className="voucher-unlimited">
                      <input
                        type="checkbox"
                        checked={form.totalUnlimited}
                        onChange={(e) => set({ totalUnlimited: e.target.checked })}
                      />
                      Không giới hạn
                    </label>
                  </Field>
                  <Field label="Giới hạn mỗi khách" error={errors.perUserLimit}>
                    <input
                      className="pf-input"
                      type="number"
                      min="1"
                      step="1"
                      value={form.perUserLimit}
                      disabled={form.perUserUnlimited}
                      onChange={(e) => set({ perUserLimit: e.target.value })}
                      placeholder="1"
                    />
                    <label className="voucher-unlimited">
                      <input
                        type="checkbox"
                        checked={form.perUserUnlimited}
                        onChange={(e) => set({ perUserUnlimited: e.target.checked })}
                      />
                      Không giới hạn
                    </label>
                    {perUserWarn ? (
                      <p className="voucher-warn-text">
                        Giới hạn mỗi khách đang lớn hơn tổng giới hạn lượt.
                      </p>
                    ) : null}
                  </Field>
                  <Field label="Bắt đầu" required error={errors.startAt}>
                    <input
                      className="pf-input"
                      type="datetime-local"
                      value={form.startAt}
                      onChange={(e) => set({ startAt: e.target.value })}
                    />
                  </Field>
                  <Field label="Kết thúc" required error={errors.endAt}>
                    <input
                      className="pf-input"
                      type="datetime-local"
                      value={form.endAt}
                      onChange={(e) => set({ endAt: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="voucher-quick-range">
                  <span className="pf-field__hint">Chọn nhanh:</span>
                  <button type="button" className="voucher-quick-btn" onClick={() => applyQuickRange(7)}>
                    7 ngày
                  </button>
                  <button type="button" className="voucher-quick-btn" onClick={() => applyQuickRange(30)}>
                    30 ngày
                  </button>
                  <button type="button" className="voucher-quick-btn" onClick={() => applyQuickRange('month')}>
                    Hết tháng này
                  </button>
                </div>
              </section>

              {/* -------- Xem trước (§3.6) -------- */}
              <section className="voucher-preview" aria-label="Xem trước mô tả cho khách">
                <h4 className="voucher-preview__title">
                  Khách sẽ thấy ở bước Mã ưu đãi (checkout)
                </h4>
                <p className="voucher-preview__text">{previewText}</p>
              </section>
            </>
          )}
        </div>
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

      {/* Tắt voucher đang chạy qua switch trong form → confirm hậu quả §4.1. */}
      <ConfirmDialog
        open={askDeactivate}
        title={`Vô hiệu hóa voucher ${original?.code || ''}?`}
        confirmLabel="Vô hiệu hóa"
        loading={saving}
        onCancel={() => setAskDeactivate(false)}
        onConfirm={() => {
          setAskDeactivate(false);
          doSave();
        }}
      >
        <p>
          Khách đang ở bước đặt hàng sẽ không áp được mã này nữa (hệ thống báo “Mã ưu đãi
          không tồn tại.”). Các đơn đã tạo trước đó không bị ảnh hưởng. Lượt đã dùng (
          {original?.usedCount || 0}) được giữ nguyên và bạn có thể bật lại voucher sau.
        </p>
      </ConfirmDialog>
    </>
  );
}
