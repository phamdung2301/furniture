import { useEffect, useRef, useState } from 'react';
import SlideOver from './SlideOver';
import ConfirmDialog from './ConfirmDialog';
import {
  createProduct,
  getProduct,
  updateProduct,
  uploadProductImages,
} from '../../api/adminProductApi';
import { formatVND } from '../../utils/format';
import { normalizeVi } from '../../utils/search';

/**
 * Form thêm/sửa sản phẩm — slide-over §B.2, admin-san-pham.md §3 (FR-020 · F-014 · US-013).
 * 4 mục: Thông tin chung · Ảnh · Thông số (specs) · Biến thể màu.
 * Rule F-014 validate ở FE (gắn lỗi đúng trường) và chốt lại ở backend:
 * mỗi màu sku unique, price > 0, stock >= 0, lengthM/widthM > 0; >= 1 màu; <= 10 ảnh.
 */

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SPEC_SUGGESTIONS = ['Kích thước', 'Kích thước chiếm chỗ', 'Chất liệu', 'Bảo hành', 'Xuất xứ'];
const BADGE_DEFAULT_LABEL = { new: 'MỚI', bestseller: 'BÁN CHẠY', sale: '-15%' };
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** "Sofa góc L Nordic" -> "sofa-goc-l-nordic" (bỏ dấu, gạch ngang). */
export function slugify(name) {
  return normalizeVi(name || '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const stripUpper = (s) =>
  normalizeVi(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim();
const consonants = (word) => word.replace(/[AEIOU]/g, '').slice(0, 3);

/**
 * Gợi ý SKU từ tên sản phẩm + màu (admin sửa tay được):
 * "Sofa góc L Nordic" + "Xám" -> "SF-NRD-XAM" (đúng mẫu SKU mock).
 */
export function suggestSku(productName, color) {
  const words = stripUpper(productName).split(/\s+/).filter(Boolean);
  const colorWords = stripUpper(color).split(/\s+/).filter(Boolean);
  if (!words.length || !colorWords.length) return '';
  const first = consonants(words[0]) || words[0].slice(0, 3);
  const parts = [first];
  if (words.length > 1) {
    const last = consonants(words[words.length - 1]);
    if (last && last !== first) parts.push(last);
  }
  parts.push(colorWords[0].slice(0, 4));
  return parts.join('-');
}

const blankVariant = (base) => ({
  id: null,
  color: '',
  colorHex: '#9AA0A6',
  sku: '',
  autoSku: '',
  price: '',
  stock: '',
  lowStockThreshold: '5',
  lengthM: base?.lengthM || '',
  widthM: base?.widthM || '',
  sizeLabel: '',
  materialNote: '',
});

const blankForm = () => ({
  name: '',
  slug: '',
  categoryId: '',
  description: '',
  basePrice: '',
  badgeType: 'none',
  badgeLabel: '',
  featured: false,
  active: true,
  images: [],
  specs: [],
  variants: [blankVariant()],
});

function detailToForm(d) {
  return {
    name: d.name || '',
    slug: d.slug || '',
    categoryId: d.categoryId || '',
    description: d.description || '',
    basePrice: d.basePrice ? String(d.basePrice) : '',
    badgeType: d.badge?.type || 'none',
    badgeLabel: d.badge?.label || '',
    featured: Boolean(d.featured),
    active: d.active !== false,
    images: (d.images || []).map((im) => ({ url: im.url, status: 'done', file: null })),
    specs: Object.entries(d.specs || {}).map(([key, value]) => ({ key, value })),
    variants: (d.variants || []).map((v) => ({
      id: v.id,
      color: v.color || '',
      colorHex: v.colorHex || '#9AA0A6',
      sku: v.sku || '',
      autoSku: '',
      price: v.price != null ? String(v.price) : '',
      stock: v.stock != null ? String(v.stock) : '',
      lowStockThreshold: v.lowStockThreshold != null ? String(v.lowStockThreshold) : '5',
      lengthM: v.lengthM != null ? String(v.lengthM) : '',
      widthM: v.widthM != null ? String(v.widthM) : '',
      sizeLabel: v.sizeLabel || '',
      materialNote: v.materialNote || '',
    })),
  };
}

/** Chuỗi so sánh dirty — bỏ qua trạng thái upload/file object của ảnh. */
function snapshotOf(f) {
  return JSON.stringify({
    ...f,
    images: f.images.map((im) => im.url),
    variants: f.variants.map(({ autoSku, ...rest }) => rest),
  });
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

export default function ProductFormSlideOver({
  productId, // null = thêm mới
  categories = [],
  onClose,
  onSaved,
  onToast,
}) {
  const isEdit = Boolean(productId);
  const [form, setForm] = useState(blankForm);
  const [loadState, setLoadState] = useState({ loading: isEdit, error: null });
  const [fieldErrors, setFieldErrors] = useState({});
  const [variantErrors, setVariantErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [dragIdx, setDragIdx] = useState(null);
  const snapshotRef = useRef('');
  const rootRef = useRef(null);
  const fileInputRef = useRef(null);

  const dirty = snapshotRef.current !== '' && snapshotOf(form) !== snapshotRef.current;

  const loadDetail = async () => {
    setLoadState({ loading: true, error: null });
    try {
      const d = await getProduct(productId);
      const f = detailToForm(d);
      setForm(f);
      snapshotRef.current = snapshotOf(f);
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
      snapshotRef.current = snapshotOf(f);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const requestClose = () => {
    if (saving) return;
    if (dirty) setAskDiscard(true);
    else onClose?.();
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  /* ------------------------- Thông tin chung ------------------------- */

  const handleNameChange = (name) => {
    setForm((f) => {
      const next = { ...f, name };
      if (!slugTouched) next.slug = slugify(name);
      // SKU đang ở chế độ tự gợi ý -> gợi ý lại theo tên mới.
      next.variants = f.variants.map((v) =>
        v.sku && v.sku === v.autoSku
          ? { ...v, sku: suggestSku(name, v.color), autoSku: suggestSku(name, v.color) }
          : v
      );
      return next;
    });
  };

  /* ------------------------------ Ảnh ------------------------------ */

  const uploadOne = async (item) => {
    try {
      const [res] = await uploadProductImages([item.file]);
      setForm((f) => ({
        ...f,
        images: f.images.map((im) =>
          im === item || (im.file && im.file === item.file && im.status === 'uploading')
            ? { ...im, url: res?.url || im.url, status: 'done' }
            : im
        ),
      }));
    } catch {
      setForm((f) => ({
        ...f,
        images: f.images.map((im) =>
          im.file === item.file && im.status === 'uploading' ? { ...im, status: 'error' } : im
        ),
      }));
    }
  };

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const accepted = [];
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) {
        onToast?.(`Ảnh "${file.name}" không đúng định dạng (chỉ JPG, PNG, WebP).`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        onToast?.(`Ảnh "${file.name}" vượt quá 5MB.`);
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) return;
    const room = MAX_IMAGES - form.images.length;
    if (room <= 0) {
      onToast?.('Sản phẩm tối đa 10 ảnh.');
      return;
    }
    const items = accepted.slice(0, room).map((file) => ({
      url: URL.createObjectURL(file),
      status: 'uploading',
      file,
    }));
    if (accepted.length > room) onToast?.('Sản phẩm tối đa 10 ảnh.');
    setForm((f) => ({ ...f, images: [...f.images, ...items] }));
    items.forEach(uploadOne);
  };

  const retryImage = (idx) => {
    const item = form.images[idx];
    if (!item?.file) return;
    setForm((f) => ({
      ...f,
      images: f.images.map((im, i) => (i === idx ? { ...im, status: 'uploading' } : im)),
    }));
    uploadOne(item);
  };

  const removeImage = (idx) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  const reorderImage = (from, to) => {
    if (from === to || from == null || to == null) return;
    setForm((f) => {
      const images = [...f.images];
      const [moved] = images.splice(from, 1);
      images.splice(to, 0, moved);
      return { ...f, images };
    });
  };

  /* ------------------------------ Specs ------------------------------ */

  const specDupIndexes = (() => {
    const seen = new Map();
    const dups = new Set();
    form.specs.forEach((row, i) => {
      const k = row.key.trim().toLowerCase();
      if (!k) return;
      if (seen.has(k)) {
        dups.add(i);
        dups.add(seen.get(k));
      } else {
        seen.set(k, i);
      }
    });
    return dups;
  })();

  /* ----------------------------- Biến thể ----------------------------- */

  const updateVariant = (idx, field, value) => {
    setForm((f) => {
      const variants = f.variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v));
      if (field === 'color') {
        const v = variants[idx];
        if (!v.sku || v.sku === v.autoSku) {
          const s = suggestSku(f.name, value);
          variants[idx] = { ...v, sku: s, autoSku: s };
        }
      }
      return { ...f, variants };
    });
  };

  const addVariant = () =>
    setForm((f) => ({ ...f, variants: [...f.variants, blankVariant(f.variants[0])] }));

  const removeVariant = (idx) =>
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }));

  const totalStock = form.variants.reduce((s, v) => s + (parseInt(v.stock, 10) || 0), 0);
  const minPrice = (() => {
    const prices = form.variants.map((v) => parseFloat(v.price)).filter((n) => n > 0);
    return prices.length ? Math.min(...prices) : null;
  })();

  /* ------------------------------- Lưu ------------------------------- */

  const validate = () => {
    const fe = {};
    const ve = form.variants.map(() => ({}));
    if (!form.name.trim()) fe.name = 'Tên sản phẩm là bắt buộc.';
    else if (form.name.trim().length > 120) fe.name = 'Tên sản phẩm tối đa 120 ký tự.';
    if (!form.slug.trim()) fe.slug = 'Slug là bắt buộc.';
    else if (!/^[a-z0-9-]+$/.test(form.slug.trim()))
      fe.slug = 'Slug chỉ gồm chữ thường, số và dấu gạch ngang.';
    if (!form.categoryId) fe.categoryId = 'Vui lòng chọn danh mục.';
    if (form.basePrice !== '' && (Number.isNaN(Number(form.basePrice)) || Number(form.basePrice) < 0))
      fe.basePrice = 'Giá niêm yết phải lớn hơn hoặc bằng 0.';
    if (!form.variants.length) fe.variants = 'Sản phẩm cần ít nhất 1 màu.';
    const skuSeen = new Map();
    form.variants.forEach((v, i) => {
      const e = ve[i];
      if (!v.color.trim()) e.color = 'Tên màu là bắt buộc.';
      if (!HEX_RE.test(v.colorHex || '')) e.colorHex = 'Mã màu phải đúng dạng #RRGGBB.';
      if (!v.sku.trim()) e.sku = 'SKU là bắt buộc.';
      else {
        const key = v.sku.trim().toLowerCase();
        if (skuSeen.has(key)) e.sku = 'SKU đã tồn tại.';
        else skuSeen.set(key, i);
      }
      if (v.price === '' || Number.isNaN(Number(v.price)) || Number(v.price) <= 0)
        e.price = 'Giá bán phải lớn hơn 0.';
      if (v.stock === '' || !Number.isInteger(Number(v.stock)) || Number(v.stock) < 0)
        e.stock = 'Tồn kho phải là số nguyên lớn hơn hoặc bằng 0.';
      if (
        v.lowStockThreshold !== '' &&
        (!Number.isInteger(Number(v.lowStockThreshold)) || Number(v.lowStockThreshold) < 0)
      )
        e.lowStockThreshold = 'Ngưỡng phải là số nguyên lớn hơn hoặc bằng 0.';
      const l = Number(v.lengthM);
      const w = Number(v.widthM);
      if (v.lengthM === '' || Number.isNaN(l) || l <= 0 || v.widthM === '' || Number.isNaN(w) || w <= 0)
        e.dims = 'Dài và rộng đều phải lớn hơn 0.';
    });
    if (specDupIndexes.size) fe.specs = 'Tên thông số bị trùng.';
    const ok =
      !Object.keys(fe).length && ve.every((e) => !Object.keys(e).length);
    return { fe, ve, ok };
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
    slug: form.slug.trim(),
    categoryId: form.categoryId,
    description: form.description,
    specs: Object.fromEntries(
      form.specs
        .filter((r) => r.key.trim() || r.value.trim())
        .map((r) => [r.key.trim(), r.value.trim()])
    ),
    basePrice: form.basePrice === '' ? null : Number(form.basePrice),
    badge:
      form.badgeType === 'none'
        ? null
        : {
            type: form.badgeType,
            label: form.badgeLabel.trim() || BADGE_DEFAULT_LABEL[form.badgeType],
          },
    images: form.images
      .filter((im) => im.status === 'done')
      .map((im, i) => ({ url: im.url, sortOrder: i + 1 })),
    featured: form.featured,
    active: form.active,
    variants: form.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      sku: v.sku.trim(),
      color: v.color.trim(),
      colorHex: v.colorHex,
      price: Number(v.price),
      stock: Number(v.stock),
      lowStockThreshold: v.lowStockThreshold === '' ? 5 : Number(v.lowStockThreshold),
      lengthM: Number(v.lengthM),
      widthM: Number(v.widthM),
      sizeLabel: v.sizeLabel,
      materialNote: v.materialNote,
    })),
  });

  const handleSave = async () => {
    if (form.images.some((im) => im.status === 'uploading')) {
      onToast?.('Vui lòng đợi ảnh tải lên xong rồi mới lưu.');
      return;
    }
    const { fe, ve, ok } = validate();
    setFieldErrors(fe);
    setVariantErrors(ve);
    if (!ok) {
      scrollToFirstError();
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) await updateProduct(productId, payload);
      else await createProduct(payload);
      onSaved?.();
    } catch (e) {
      if (e?.field === 'slug') {
        setFieldErrors((prev) => ({ ...prev, slug: e.message }));
        scrollToFirstError();
      } else if (e?.field === 'sku') {
        const m = /SKU\s+(\S+)\s+đã tồn tại/.exec(e.message || '');
        const target = m?.[1]?.toLowerCase();
        setVariantErrors((prev) =>
          form.variants.map((v, i) =>
            target && v.sku.trim().toLowerCase() === target
              ? { ...(prev[i] || {}), sku: 'SKU đã tồn tại.' }
              : prev[i] || {}
          )
        );
        scrollToFirstError();
      } else {
        // field "variant" (xóa màu đã có đơn) và lỗi còn lại: toast message cụ thể từ API (§B.3).
        onToast?.(e?.message || 'Không lưu được sản phẩm. Vui lòng thử lại.');
        if (e?.field === 'variant') {
          setFieldErrors((prev) => ({ ...prev, variants: e.message }));
        }
      }
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ Render ------------------------------ */

  const categoryOptions = (() => {
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
        {saving ? 'Đang lưu…' : 'Lưu sản phẩm'}
      </button>
    </>
  );

  return (
    <>
      <SlideOver
        open
        title={isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
        onClose={requestClose}
        footer={footer}
        dirty={false}
      >
        <div ref={rootRef} className="pform">
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
              <p>Không tải được thông tin sản phẩm.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadDetail}>
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {isEdit ? <p className="pform__editing-name">{form.name}</p> : null}

              {/* -------- Mục 1: Thông tin chung -------- */}
              <section className="pform-section">
                <h4 className="pform-section__title">Thông tin chung</h4>
                <div className="pform-grid">
                  <Field label="Tên sản phẩm" required error={fieldErrors.name} wide>
                    <input
                      className="pf-input"
                      value={form.name}
                      maxLength={120}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="VD: Sofa góc L Nordic"
                    />
                  </Field>
                  <Field
                    label="Slug"
                    required
                    error={fieldErrors.slug}
                    hint={`mocan.vn/san-pham/${form.slug || '…'}`}
                    wide
                  >
                    <input
                      className="pf-input"
                      value={form.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        set({ slug: e.target.value });
                      }}
                      placeholder="sofa-goc-l-nordic"
                    />
                  </Field>
                  <Field label="Danh mục" required error={fieldErrors.categoryId}>
                    <select
                      className="pf-input"
                      value={form.categoryId}
                      onChange={(e) => set({ categoryId: e.target.value })}
                    >
                      <option value="">Chọn danh mục</option>
                      {categoryOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Giá niêm yết (đ)" error={fieldErrors.basePrice}>
                    <input
                      className="pf-input"
                      type="number"
                      min="0"
                      value={form.basePrice}
                      onChange={(e) => set({ basePrice: e.target.value })}
                      placeholder="0"
                    />
                  </Field>
                  <p className="pf-note pf-field--wide">
                    Giá tham khảo. Giá bán thực tế lấy theo từng màu; khách hàng thấy “giá từ” =
                    giá màu rẻ nhất.
                  </p>
                  <Field label="Badge hiển thị">
                    <select
                      className="pf-input"
                      value={form.badgeType}
                      onChange={(e) => {
                        const t = e.target.value;
                        set({
                          badgeType: t,
                          badgeLabel: t === 'none' ? '' : BADGE_DEFAULT_LABEL[t],
                        });
                      }}
                    >
                      <option value="none">Không gắn</option>
                      <option value="new">MỚI</option>
                      <option value="bestseller">BÁN CHẠY</option>
                      <option value="sale">Giảm giá</option>
                    </select>
                  </Field>
                  {form.badgeType !== 'none' ? (
                    <Field label="Nhãn badge">
                      <input
                        className="pf-input"
                        value={form.badgeLabel}
                        onChange={(e) => set({ badgeLabel: e.target.value })}
                        placeholder={BADGE_DEFAULT_LABEL[form.badgeType]}
                      />
                    </Field>
                  ) : null}
                  <Field label="Mô tả" wide>
                    <textarea
                      className="pf-input pf-textarea"
                      rows={6}
                      value={form.description}
                      onChange={(e) => set({ description: e.target.value })}
                      placeholder="Mô tả hiển thị ở tab Mô tả trên trang chi tiết sản phẩm"
                    />
                  </Field>
                </div>
                <Switch
                  label="Sản phẩm nổi bật"
                  hint="Hiện trong mục Sản phẩm nổi bật ở trang chủ."
                  checked={form.featured}
                  onChange={(v) => set({ featured: v })}
                />
                <Switch
                  label="Đang bán"
                  hint="Tắt = ngừng bán, sản phẩm ẩn khỏi cửa hàng nhưng đơn cũ không bị ảnh hưởng."
                  checked={form.active}
                  onChange={(v) => set({ active: v })}
                />
              </section>

              {/* -------- Mục 2: Ảnh sản phẩm -------- */}
              <section className="pform-section">
                <h4 className="pform-section__title">Ảnh sản phẩm</h4>
                <div
                  className="img-grid"
                  onDragOver={(e) => {
                    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (e.dataTransfer?.files?.length) {
                      e.preventDefault();
                      handleFiles(e.dataTransfer.files);
                    }
                  }}
                >
                  {form.images.map((im, idx) => (
                    <div
                      key={`${im.url}-${idx}`}
                      className={`img-cell${im.status === 'error' ? ' is-error' : ''}`}
                      draggable
                      onDragStart={() => setDragIdx(idx)}
                      onDragEnd={() => setDragIdx(null)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragIdx != null && dragIdx !== idx) {
                          reorderImage(dragIdx, idx);
                          setDragIdx(idx);
                        }
                      }}
                    >
                      <img src={im.url} alt="" />
                      {idx === 0 ? <span className="img-cell__main">Ảnh chính</span> : null}
                      {im.status === 'uploading' ? (
                        <span className="img-cell__status">Đang tải…</span>
                      ) : null}
                      {im.status === 'error' ? (
                        <button
                          type="button"
                          className="img-cell__retry"
                          onClick={() => retryImage(idx)}
                        >
                          Thử lại
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="img-cell__remove"
                        onClick={() => removeImage(idx)}
                        aria-label="Xóa ảnh"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {form.images.length < MAX_IMAGES ? (
                    <button
                      type="button"
                      className="img-add"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      + Thêm ảnh
                    </button>
                  ) : (
                    <p className="pf-field__hint img-grid__full">Đã đủ tối đa 10 ảnh.</p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                {form.images.length === 0 ? (
                  <p className="pf-warn-hint">Sản phẩm chưa có ảnh sẽ khó bán hơn.</p>
                ) : null}
                <p className="pf-field__hint">
                  Kéo thả để sắp xếp — ảnh đầu tiên là ảnh chính. JPG/PNG/WebP, tối đa 5MB/ảnh.
                </p>
              </section>

              {/* -------- Mục 3: Thông số kỹ thuật -------- */}
              <section className="pform-section">
                <h4 className="pform-section__title">Thông số kỹ thuật</h4>
                {form.specs.map((row, i) => (
                  <div className="spec-row" key={i}>
                    <input
                      className="pf-input"
                      list="spec-name-suggestions"
                      value={row.key}
                      onChange={(e) =>
                        set({
                          specs: form.specs.map((r, j) =>
                            j === i ? { ...r, key: e.target.value } : r
                          ),
                        })
                      }
                      placeholder="Tên thông số"
                      aria-label="Tên thông số"
                    />
                    <input
                      className="pf-input"
                      value={row.value}
                      onChange={(e) =>
                        set({
                          specs: form.specs.map((r, j) =>
                            j === i ? { ...r, value: e.target.value } : r
                          ),
                        })
                      }
                      placeholder="Giá trị"
                      aria-label="Giá trị thông số"
                    />
                    <button
                      type="button"
                      className="spec-row__remove"
                      onClick={() => set({ specs: form.specs.filter((_, j) => j !== i) })}
                      aria-label="Xóa thông số"
                    >
                      ×
                    </button>
                    {specDupIndexes.has(i) ? (
                      <p className="pf-field__error spec-row__error">Tên thông số bị trùng.</p>
                    ) : null}
                  </div>
                ))}
                <datalist id="spec-name-suggestions">
                  {SPEC_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => set({ specs: [...form.specs, { key: '', value: '' }] })}
                >
                  + Thêm thông số
                </button>
              </section>

              {/* -------- Mục 4: Biến thể màu -------- */}
              <section className="pform-section">
                <h4 className="pform-section__title">Biến thể màu</h4>
                {fieldErrors.variants ? (
                  <p className="pf-field__error" data-invalid="true">
                    {fieldErrors.variants}
                  </p>
                ) : null}
                {form.variants.map((v, i) => {
                  const e = variantErrors[i] || {};
                  const area = Number(v.lengthM) * Number(v.widthM);
                  const hasArea = v.lengthM !== '' && v.widthM !== '' && area > 0;
                  return (
                    <div
                      className="variant-block"
                      key={v.id || `new-${i}`}
                      data-invalid={Object.keys(e).length ? 'true' : undefined}
                    >
                      <div className="variant-block__head">
                        <span
                          className="variant-block__dot"
                          style={{ background: HEX_RE.test(v.colorHex) ? v.colorHex : '#ccc' }}
                          aria-hidden="true"
                        />
                        <span className="variant-block__name">{v.color || 'Màu mới'}</span>
                        <button
                          type="button"
                          className="variant-block__remove"
                          onClick={() => removeVariant(i)}
                          aria-label="Xóa màu"
                        >
                          ×
                        </button>
                      </div>
                      <div className="pform-grid">
                        <Field label="Tên màu" required error={e.color}>
                          <input
                            className="pf-input"
                            value={v.color}
                            onChange={(ev) => updateVariant(i, 'color', ev.target.value)}
                            placeholder="VD: Xám"
                          />
                        </Field>
                        <Field label="Mã màu" required error={e.colorHex}>
                          <div className="pf-color-row">
                            <input
                              type="color"
                              className="pf-color-picker"
                              value={HEX_RE.test(v.colorHex) ? v.colorHex : '#000000'}
                              onChange={(ev) => updateVariant(i, 'colorHex', ev.target.value)}
                              aria-label="Chọn màu"
                            />
                            <input
                              className="pf-input"
                              value={v.colorHex}
                              onChange={(ev) => updateVariant(i, 'colorHex', ev.target.value)}
                              placeholder="#RRGGBB"
                            />
                          </div>
                        </Field>
                        <Field label="SKU" required error={e.sku}>
                          <input
                            className="pf-input"
                            value={v.sku}
                            onChange={(ev) => updateVariant(i, 'sku', ev.target.value)}
                            placeholder="Tự gợi ý theo tên + màu"
                          />
                        </Field>
                        <Field label="Giá bán (đ)" required error={e.price}>
                          <input
                            className="pf-input"
                            type="number"
                            min="0"
                            value={v.price}
                            onChange={(ev) => updateVariant(i, 'price', ev.target.value)}
                          />
                        </Field>
                        <Field label="Tồn kho" required error={e.stock}>
                          <input
                            className="pf-input"
                            type="number"
                            min="0"
                            step="1"
                            value={v.stock}
                            onChange={(ev) => updateVariant(i, 'stock', ev.target.value)}
                          />
                        </Field>
                        <Field
                          label="Ngưỡng cảnh báo"
                          error={e.lowStockThreshold}
                          hint="Cảnh báo sắp hết khi tồn ≤ ngưỡng này."
                        >
                          <input
                            className="pf-input"
                            type="number"
                            min="0"
                            step="1"
                            value={v.lowStockThreshold}
                            onChange={(ev) =>
                              updateVariant(i, 'lowStockThreshold', ev.target.value)
                            }
                          />
                        </Field>
                        <Field label="Dài (m) × Rộng (m)" required error={e.dims} wide>
                          <div className="pf-dims-row">
                            <input
                              className="pf-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={v.lengthM}
                              onChange={(ev) => updateVariant(i, 'lengthM', ev.target.value)}
                              placeholder="Dài"
                              aria-label="Dài (m)"
                            />
                            <span aria-hidden="true">×</span>
                            <input
                              className="pf-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={v.widthM}
                              onChange={(ev) => updateVariant(i, 'widthM', ev.target.value)}
                              placeholder="Rộng"
                              aria-label="Rộng (m)"
                            />
                            <span className="pf-dims-area">
                              {hasArea
                                ? `= ${area.toLocaleString('vi-VN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} m²`
                                : ''}
                            </span>
                          </div>
                        </Field>
                        <Field label="Nhãn kích thước">
                          <input
                            className="pf-input"
                            value={v.sizeLabel}
                            onChange={(ev) => updateVariant(i, 'sizeLabel', ev.target.value)}
                            placeholder="VD: 2.0m x 1.9m"
                          />
                        </Field>
                        <Field label="Ghi chú chất liệu">
                          <input
                            className="pf-input"
                            value={v.materialNote}
                            onChange={(ev) => updateVariant(i, 'materialNote', ev.target.value)}
                            placeholder="VD: Vải bố cao cấp"
                          />
                        </Field>
                      </div>
                    </div>
                  );
                })}
                <button type="button" className="btn btn-secondary btn-sm" onClick={addVariant}>
                  + Thêm màu
                </button>
                <div className="variant-summary">
                  Số màu: {form.variants.length} · Tổng tồn: {totalStock} · Giá từ:{' '}
                  {minPrice != null ? formatVND(minPrice) : '—'}
                </div>
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
        <p>Bạn có thay đổi chưa lưu. Đóng mà không lưu sẽ làm mất các thay đổi này.</p>
      </ConfirmDialog>
    </>
  );
}
