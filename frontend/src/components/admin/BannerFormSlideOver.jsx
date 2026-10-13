import { useEffect, useRef, useState } from 'react';
import SlideOver from './SlideOver';
import ConfirmDialog from './ConfirmDialog';
import {
  createBanner,
  getBanner,
  updateBanner,
  uploadBannerImage,
} from '../../api/adminBannerApi';
import { listCategories } from '../../api/adminCategoryApi';
import { listProducts } from '../../api/adminProductApi';
import { mockAllProducts, mockBanners, mockCategories } from '../../mocks/homeMock';

/**
 * Form thêm / sửa banner — slide-over 560px, admin-banner.md §4 (FR-027 · F-021).
 * Slide-over thay cho modal §B.2 vì form có khối XEM TRƯỚC hero trực tiếp (§5)
 * — tiền lệ màn Voucher. Các trường khớp 1-1 entity Banner (8 trường, KHÔNG có
 * startAt/endAt) và cách HeroCarousel hiển thị phía khách.
 * Validate inline khớp AdminBannerService; lỗi API kèm field gắn đúng trường.
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_EXTS = /\.(jpe?g|png|webp)$/i;

/** Ảnh "đã có trong hệ thống" cho tab Thư viện có sẵn (§4.3): banner + danh mục + sản phẩm, bỏ trùng. */
const LIBRARY_IMAGES = (() => {
  const urls = [];
  const seen = new Set();
  const add = (u) => {
    if (u && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  };
  mockBanners.forEach((b) => add(b.imageUrl));
  mockCategories.forEach((c) => add(c.imageUrl));
  mockAllProducts.forEach((p) => (p.images || []).forEach((im) => add(im.url)));
  return urls;
})();

const blankForm = (suggestedSortOrder) => ({
  imageUrl: '',
  title: '',
  subtitle: '',
  ctaText: '',
  linkUrl: '',
  sortOrder: String(suggestedSortOrder),
  active: true,
});

function detailToForm(d) {
  return {
    imageUrl: d.imageUrl || '',
    title: d.title || '',
    subtitle: d.subtitle || '',
    ctaText: d.ctaText || '',
    linkUrl: d.linkUrl || '',
    sortOrder: d.sortOrder != null ? String(d.sortOrder) : '',
    active: d.active !== false,
  };
}

function Field({ label, required, error, hint, counter, children }) {
  return (
    <div
      className={`pf-field${error ? ' has-error' : ''}`}
      data-invalid={error ? 'true' : undefined}
    >
      <label className="pf-field__label">
        {label}
        {required ? <span className="pf-required"> *</span> : null}
        {counter ? <span className="banner-field__counter">{counter}</span> : null}
      </label>
      {children}
      {error ? <p className="pf-field__error">{error}</p> : null}
      {!error && hint ? <p className="pf-field__hint">{hint}</p> : null}
    </div>
  );
}

export default function BannerFormSlideOver({
  bannerId, // null = thêm mới
  banners = [], // danh sách hiện tại (gợi ý thứ tự + vị trí chèn)
  onClose,
  onSaved,
  onToast,
}) {
  const isEdit = Boolean(bannerId);
  const suggestedSortOrder = banners.length + 1;
  const [form, setForm] = useState(() => blankForm(suggestedSortOrder));
  const [loadState, setLoadState] = useState({ loading: isEdit, error: null });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewFrame, setPreviewFrame] = useState('desktop'); // desktop | mobile
  const [linkMode, setLinkMode] = useState(''); // '' | 'category' | 'product'
  const [categories, setCategories] = useState([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);
  const snapshotRef = useRef('');
  const formRef = useRef(form);
  formRef.current = form;
  const rootRef = useRef(null);
  const fileInputRef = useRef(null);
  const productDebounceRef = useRef(null);

  const snapshotOf = (f) =>
    JSON.stringify({
      imageUrl: f.imageUrl,
      title: f.title,
      subtitle: f.subtitle,
      ctaText: f.ctaText,
      linkUrl: f.linkUrl,
      sortOrder: String(f.sortOrder),
      active: f.active,
    });
  const isDirty = () =>
    snapshotRef.current !== '' && snapshotOf(formRef.current) !== snapshotRef.current;

  const loadDetail = async () => {
    setLoadState({ loading: true, error: null });
    try {
      const d = await getBanner(bannerId);
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
      snapshotRef.current = snapshotOf(formRef.current);
    }
    listCategories()
      .then((cats) =>
        setCategories((cats || []).filter((c) => !c.parentId && c.active !== false))
      )
      .catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerId]);

  // Đóng khi đã sửa chưa lưu → confirm §B.2 (dùng ref để Esc/overlay của
  // SlideOver — vốn giữ closure lần render đầu — vẫn đọc đúng trạng thái).
  const requestClose = () => {
    if (isDirty()) setAskDiscard(true);
    else onClose?.();
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  /* ------------------------------ Ảnh (§4.3) ------------------------------ */

  const handleFile = async (file) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) && !IMAGE_EXTS.test(file.name)) {
      onToast?.(`Ảnh "${file.name}" không đúng định dạng (chỉ JPG, PNG, WebP).`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onToast?.(`Ảnh "${file.name}" vượt quá 5MB.`);
      return;
    }
    setUploading(true);
    try {
      const res = await uploadBannerImage(file);
      setImgBroken(false);
      set({ imageUrl: res?.url || '' });
      setPickerOpen(false);
    } catch (e) {
      onToast?.(e?.message || `Không tải được ảnh "${file.name}".`);
    } finally {
      setUploading(false);
    }
  };

  /* --------------------------- Link đích (§4.4) --------------------------- */

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

  const pickQuickLink = (kind) => {
    if (kind === 'home') {
      setLinkMode('');
      set({ linkUrl: '/' });
    } else if (kind === 'flash') {
      setLinkMode('');
      set({ linkUrl: '/flash-sale' });
    } else if (kind === 'category') {
      setLinkMode('category');
    } else if (kind === 'product') {
      setLinkMode('product');
    } else {
      setLinkMode('');
    }
  };

  /* ------------------------------- Lưu (§4.5) ------------------------------- */

  const validate = () => {
    const fe = {};
    if (!form.imageUrl.trim()) fe.imageUrl = 'Ảnh banner là bắt buộc.';
    if (!form.title.trim()) fe.title = 'Tiêu đề là bắt buộc.';
    else if (form.title.trim().length > 80) fe.title = 'Tiêu đề tối đa 80 ký tự.';
    if (form.subtitle.trim().length > 120) fe.subtitle = 'Mô tả phụ tối đa 120 ký tự.';
    if (form.ctaText.trim().length > 20) fe.ctaText = 'Chữ trên nút tối đa 20 ký tự.';
    const link = form.linkUrl.trim();
    if (!link) fe.linkUrl = 'Link đích là bắt buộc.';
    else if (!link.startsWith('/') && !/^https?:\/\//i.test(link))
      fe.linkUrl =
        'Link đích phải bắt đầu bằng / (trang trong cửa hàng) hoặc là địa chỉ web đầy đủ bắt đầu bằng http.';
    if (
      form.sortOrder !== '' &&
      (!Number.isInteger(Number(form.sortOrder)) || Number(form.sortOrder) < 1)
    )
      fe.sortOrder = 'Thứ tự hiển thị phải là số nguyên từ 1 trở lên.';
    return fe;
  };

  const focusFirstError = () => {
    window.requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector('[data-invalid="true"]');
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.querySelector('input, select, textarea')?.focus({ preventScroll: true });
      }
    });
  };

  const handleSave = async () => {
    if (uploading) {
      onToast?.('Vui lòng đợi ảnh tải lên xong rồi mới lưu.');
      return;
    }
    const fe = validate();
    setErrors(fe);
    if (Object.keys(fe).length) {
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      const payload = {
        imageUrl: form.imageUrl.trim(),
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        ctaText: form.ctaText.trim(),
        linkUrl: form.linkUrl.trim(),
        sortOrder:
          form.sortOrder === '' ? suggestedSortOrder : Number(form.sortOrder),
        active: form.active,
      };
      const saved = isEdit
        ? await updateBanner(bannerId, payload)
        : await createBanner(payload);
      onSaved?.(saved, !isEdit);
    } catch (e) {
      if (e?.field) {
        setErrors((prev) => ({ ...prev, [e.field]: e.message }));
        focusFirstError();
      } else {
        onToast?.(e?.message || 'Không lưu được banner. Vui lòng thử lại.');
      }
    } finally {
      setSaving(false);
    }
  };

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
        {saving ? 'Đang lưu…' : 'Lưu banner'}
      </button>
    </>
  );

  const editingBanner = banners.find((b) => b.id === bannerId) || null;

  return (
    <>
      <SlideOver
        open
        title={isEdit ? 'Sửa banner' : 'Thêm banner'}
        onClose={requestClose}
        footer={footer}
        dirty={false}
      >
        <div ref={rootRef} className="pform banner-form">
          {loadState.loading ? (
            <div className="pform__loading" aria-busy="true">
              <div className="skeleton" style={{ height: 150 }} />
              <div className="skeleton" style={{ height: 40 }} />
              <div className="skeleton" style={{ height: 40 }} />
              <div className="skeleton" style={{ height: 40 }} />
              <div className="skeleton" style={{ height: 180 }} />
            </div>
          ) : loadState.error ? (
            <div className="data-table__state">
              <p>Không tải được thông tin banner.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadDetail}>
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {isEdit && editingBanner?.title ? (
                <p className="pform__editing-name">{editingBanner.title}</p>
              ) : null}

              {/* -------- Ảnh banner (§4.2/§4.3) -------- */}
              <Field
                label="Ảnh banner"
                required
                error={errors.imageUrl}
                hint="Ảnh hiển thị ở khung 21:8 trên máy tính và 16:10 trên điện thoại, hệ thống tự cắt giữa ảnh — hãy để nội dung quan trọng ở vùng giữa. Khuyến nghị 2100 × 800px."
              >
                <div className="banner-img">
                  {form.imageUrl && !imgBroken ? (
                    <div className="banner-img__preview">
                      <img src={form.imageUrl} alt="" onError={() => setImgBroken(true)} />
                      <span className="banner-img__actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setPickerOpen((v) => !v)}
                        >
                          Đổi ảnh
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => set({ imageUrl: '' })}
                        >
                          Xóa ảnh
                        </button>
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="banner-img__empty"
                      onClick={() => setPickerOpen((v) => !v)}
                    >
                      {form.imageUrl
                        ? 'Ảnh lỗi — bấm để chọn ảnh khác'
                        : 'Chưa có ảnh — bấm để chọn ảnh'}
                    </button>
                  )}
                  {uploading ? <p className="pf-field__hint">Đang tải ảnh lên…</p> : null}

                  {pickerOpen ? (
                    <div className="cat-picker">
                      <div className="cat-picker__tabs" role="tablist" aria-label="Chọn ảnh banner">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={pickerTab === 'upload'}
                          className={pickerTab === 'upload' ? 'is-active' : ''}
                          onClick={() => setPickerTab('upload')}
                        >
                          Tải ảnh lên
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={pickerTab === 'library'}
                          className={pickerTab === 'library' ? 'is-active' : ''}
                          onClick={() => setPickerTab('library')}
                        >
                          Thư viện có sẵn
                        </button>
                      </div>
                      {pickerTab === 'upload' ? (
                        <div
                          className={`cat-picker__drop${dragOver ? ' is-over' : ''}`}
                          onDragOver={(e) => {
                            if (e.dataTransfer?.types?.includes('Files')) {
                              e.preventDefault();
                              setDragOver(true);
                            }
                          }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            handleFile(e.dataTransfer?.files?.[0]);
                          }}
                        >
                          <p>Kéo thả ảnh vào đây hoặc</p>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                          >
                            {uploading ? 'Đang tải…' : 'Chọn file ảnh'}
                          </button>
                          <p className="pf-field__hint">JPG/PNG/WebP, tối đa 5MB/ảnh.</p>
                        </div>
                      ) : (
                        <div className="cat-picker__grid">
                          {LIBRARY_IMAGES.map((url, i) => (
                            <button
                              key={url}
                              type="button"
                              className={`cat-picker__cell${form.imageUrl === url ? ' is-selected' : ''}`}
                              onClick={() => {
                                setImgBroken(false);
                                set({ imageUrl: url });
                                setPickerOpen(false);
                              }}
                              aria-label={`Chọn ảnh có sẵn ${i + 1}`}
                            >
                              <img src={url} alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={(e) => {
                          handleFile(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </Field>

              {/* -------- Chữ trên hero (§4.2) -------- */}
              <Field
                label="Tiêu đề"
                required
                error={errors.title}
                counter={`${form.title.length}/80`}
              >
                <input
                  className="pf-input"
                  value={form.title}
                  maxLength={80}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="VD: Khai trương — Giảm đến 20% sofa phòng khách"
                />
              </Field>

              <Field
                label="Mô tả phụ"
                error={errors.subtitle}
                counter={`${form.subtitle.length}/120`}
              >
                <input
                  className="pf-input"
                  value={form.subtitle}
                  maxLength={120}
                  onChange={(e) => set({ subtitle: e.target.value })}
                  placeholder="VD: Từ 12/10 đến 31/10 · Áp dụng cho 50+ mẫu sofa"
                />
              </Field>

              <Field
                label="Chữ trên nút"
                error={errors.ctaText}
                counter={`${form.ctaText.length}/20`}
                hint="Để trống → trang chủ hiển thị mặc định “Mua ngay”."
              >
                <input
                  className="pf-input"
                  value={form.ctaText}
                  maxLength={20}
                  onChange={(e) => set({ ctaText: e.target.value })}
                  placeholder="Mua ngay"
                />
              </Field>

              {/* -------- Link đích (§4.4) -------- */}
              <Field
                label="Link đích"
                required
                error={errors.linkUrl}
                hint={
                  form.linkUrl.trim()
                    ? `Khách bấm nút trên banner sẽ tới: ${form.linkUrl.trim()}`
                    : undefined
                }
              >
                <div className="banner-link-chips" role="group" aria-label="Chọn nhanh link đích">
                  <button type="button" className="banner-chip" onClick={() => pickQuickLink('home')}>
                    Trang chủ
                  </button>
                  <button type="button" className="banner-chip" onClick={() => pickQuickLink('flash')}>
                    Flash sale
                  </button>
                  <button
                    type="button"
                    className={`banner-chip${linkMode === 'category' ? ' is-active' : ''}`}
                    onClick={() => pickQuickLink('category')}
                  >
                    Danh mục…
                  </button>
                  <button
                    type="button"
                    className={`banner-chip${linkMode === 'product' ? ' is-active' : ''}`}
                    onClick={() => pickQuickLink('product')}
                  >
                    Sản phẩm…
                  </button>
                  <button type="button" className="banner-chip" onClick={() => pickQuickLink('custom')}>
                    Tự nhập
                  </button>
                </div>
                {linkMode === 'category' ? (
                  <select
                    className="pf-input"
                    value=""
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value);
                      if (cat) set({ linkUrl: `/danh-muc/${cat.slug}` });
                    }}
                    aria-label="Chọn danh mục làm link đích"
                  >
                    <option value="">Chọn danh mục…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — /danh-muc/{c.slug}
                      </option>
                    ))}
                  </select>
                ) : null}
                {linkMode === 'product' ? (
                  <div className="banner-product-picker">
                    <input
                      className="pf-input"
                      type="search"
                      value={productQuery}
                      onChange={(e) => handleProductQuery(e.target.value)}
                      placeholder="Tìm sản phẩm để lấy link…"
                      aria-label="Tìm sản phẩm để lấy link đích"
                    />
                    {productSearching ? <p className="pf-field__hint">Đang tìm…</p> : null}
                    {productResults.length > 0 ? (
                      <ul className="voucher-product-results">
                        {productResults.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => {
                                set({ linkUrl: `/san-pham/${p.slug}` });
                                setProductQuery('');
                                setProductResults([]);
                              }}
                            >
                              {p.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                <input
                  className="pf-input banner-link-input"
                  value={form.linkUrl}
                  onChange={(e) => set({ linkUrl: e.target.value })}
                  placeholder="/danh-muc/sofa"
                  aria-label="Link đích"
                />
              </Field>

              {/* -------- Thứ tự + trạng thái (§4.2) -------- */}
              <div className="pform-grid">
                <Field
                  label="Thứ tự hiển thị"
                  error={errors.sortOrder}
                  hint="Số nhỏ hiện trước trên trang chủ. Cũng có thể kéo-thả trực tiếp ở danh sách."
                >
                  <input
                    className="pf-input"
                    type="number"
                    min="1"
                    step="1"
                    value={form.sortOrder}
                    onChange={(e) => set({ sortOrder: e.target.value })}
                  />
                </Field>
              </div>

              <div className="pf-switch-row">
                <div className="pf-switch-row__text">
                  <span className="pf-switch-row__label">Đang hiện trên trang chủ</span>
                  <span className="pf-field__hint">
                    Tắt = banner không xuất hiện ở trang chủ nhưng vẫn giữ trong danh sách này để
                    bật lại sau.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  aria-label="Đang hiện trên trang chủ"
                  className={`pf-switch${form.active ? ' is-on' : ''}`}
                  onClick={() => set({ active: !form.active })}
                >
                  <span className="pf-switch__dot" />
                </button>
              </div>

              {/* -------- Xem trước (§5) -------- */}
              <section className="banner-preview" aria-label="Xem trước trên trang chủ">
                <div className="banner-preview__head">
                  <h4 className="banner-preview__title">Xem trước trên trang chủ</h4>
                  <div className="banner-preview__frames" role="group" aria-label="Khung xem trước">
                    <button
                      type="button"
                      className={previewFrame === 'desktop' ? 'is-active' : ''}
                      onClick={() => setPreviewFrame('desktop')}
                      aria-pressed={previewFrame === 'desktop'}
                    >
                      Máy tính
                    </button>
                    <button
                      type="button"
                      className={previewFrame === 'mobile' ? 'is-active' : ''}
                      onClick={() => setPreviewFrame('mobile')}
                      aria-pressed={previewFrame === 'mobile'}
                    >
                      Điện thoại
                    </button>
                  </div>
                </div>
                <div
                  className={`banner-preview__frame is-${previewFrame}`}
                  aria-hidden={!form.imageUrl}
                >
                  {form.imageUrl && !imgBroken ? (
                    <>
                      <img src={form.imageUrl} alt="" />
                      <div className="banner-preview__overlay" />
                      <div className="banner-preview__text">
                        <h5 className={form.title.trim() ? '' : 'is-placeholder'}>
                          {form.title.trim() || 'Tiêu đề banner'}
                        </h5>
                        {form.subtitle.trim() ? <p>{form.subtitle.trim()}</p> : null}
                        <span className="btn btn-primary btn-sm banner-preview__cta">
                          {form.ctaText.trim() || 'Mua ngay'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="banner-preview__empty">Chọn ảnh để xem trước</div>
                  )}
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
