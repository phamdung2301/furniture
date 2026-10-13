import { useEffect, useMemo, useRef, useState } from 'react';
import AdminModal from './AdminModal';
import ConfirmDialog from './ConfirmDialog';
import {
  createCategory,
  getCategory,
  updateCategory,
  uploadCategoryImage,
} from '../../api/adminCategoryApi';
import { slugify } from './ProductFormSlideOver';
import { mockAllProducts, mockCategories } from '../../mocks/homeMock';

/**
 * Form thêm/sửa danh mục — modal 520px §B.2 (admin-danh-muc.md §3, FR-021 · F-015).
 * 6 trường: tên · slug (tự sinh + preview URL) · danh mục cha (chỉ danh mục gốc) ·
 * ảnh (tải lên / thư viện có sẵn) · thứ tự hiển thị · toggle Đang hiển thị.
 * Cây đúng 2 cấp: danh mục đang có con thì khóa trường cha (không sinh cấp 3).
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_EXTS = /\.(jpe?g|png|webp)$/i;

/** Ảnh "đã có trong hệ thống" cho tab Thư viện có sẵn (§3.1): gộp ảnh danh mục + ảnh sản phẩm, bỏ trùng. */
const LIBRARY_IMAGES = (() => {
  const urls = [];
  const seen = new Set();
  const add = (u) => {
    if (u && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  };
  mockCategories.forEach((c) => add(c.imageUrl));
  mockAllProducts.forEach((p) => (p.images || []).forEach((im) => add(im.url)));
  return urls;
})();

const blankForm = (presetParentId = null) => ({
  name: '',
  slug: '',
  parentId: presetParentId || '',
  imageUrl: '',
  sortOrder: '',
  active: true,
});

function Field({ label, required, error, hint, children }) {
  return (
    <div className={`pf-field${error ? ' has-error' : ''}`} data-invalid={error ? 'true' : undefined}>
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

export default function CategoryFormModal({
  categoryId, // null = thêm mới
  presetParentId = null, // mở từ nút "Thêm danh mục con" ở dòng gốc
  categories = [], // toàn bộ danh mục (đã kèm productCount/hasChildren từ trang cha)
  onClose,
  onSaved,
  onToast,
}) {
  const isEdit = Boolean(categoryId);
  const editing = categories.find((c) => c.id === categoryId) || null;
  const hasChildren = Boolean(editing?.hasChildren);
  const childNames = useMemo(
    () => categories.filter((c) => c.parentId === categoryId).map((c) => c.name),
    [categories, categoryId]
  );

  // Gợi ý thứ tự khi thêm mới = max sortOrder trong nhóm anh em + 1 (§3) —
  // tính ngay từ lần render đầu để snapshot dirty-check không bị lệch.
  const suggestedFor = (parentId) => {
    const sibs = categories.filter((c) => (c.parentId || null) === (parentId || null));
    return sibs.length ? Math.max(...sibs.map((c) => c.sortOrder || 0)) + 1 : 1;
  };
  const [form, setForm] = useState(() => {
    const f = blankForm(presetParentId);
    if (!isEdit) f.sortOrder = String(suggestedFor(presetParentId));
    return f;
  });
  const [loadState, setLoadState] = useState({ loading: isEdit, error: null });
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const snapshotRef = useRef('');
  const rootRef = useRef(null);
  const fileInputRef = useRef(null);

  const snapshotOf = (f) =>
    JSON.stringify({
      name: f.name,
      slug: f.slug,
      parentId: f.parentId,
      imageUrl: f.imageUrl,
      sortOrder: String(f.sortOrder),
      active: f.active,
    });
  const dirty = snapshotRef.current !== '' && snapshotOf(form) !== snapshotRef.current;

  const loadDetail = async () => {
    setLoadState({ loading: true, error: null });
    try {
      const d = await getCategory(categoryId);
      const f = {
        name: d.name || '',
        slug: d.slug || '',
        parentId: d.parentId || '',
        imageUrl: d.imageUrl || '',
        sortOrder: d.sortOrder != null ? String(d.sortOrder) : '',
        active: d.active !== false,
      };
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
      snapshotRef.current = snapshotOf(form);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const roots = useMemo(
    () =>
      categories
        .filter((c) => !c.parentId && c.id !== categoryId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, categoryId]
  );

  // Gợi ý thứ tự cho nhóm anh em hiện tại (dùng khi lưu mà trường để trống).
  const suggestedSortOrder = useMemo(
    () => suggestedFor(form.parentId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, form.parentId]
  );

  // Đổi danh mục cha khi thêm mới → gợi ý lại thứ tự theo nhóm anh em mới.
  const prevParentRef = useRef(form.parentId);
  useEffect(() => {
    if (isEdit) return;
    if (prevParentRef.current !== form.parentId) {
      prevParentRef.current = form.parentId;
      setForm((f) => ({ ...f, sortOrder: String(suggestedFor(f.parentId)) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.parentId, isEdit]);

  const requestClose = () => {
    if (saving) return;
    if (dirty) setAskDiscard(true);
    else onClose?.();
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleNameChange = (name) => {
    setForm((f) => {
      const next = { ...f, name };
      if (!slugTouched) next.slug = slugify(name);
      return next;
    });
  };

  /* ------------------------------ Ảnh ------------------------------ */

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
      const res = await uploadCategoryImage(file);
      set({ imageUrl: res?.url || '' });
      setPickerOpen(false);
    } catch (e) {
      onToast?.(e?.message || `Không tải được ảnh "${file.name}".`);
    } finally {
      setUploading(false);
    }
  };

  /* ------------------------------- Lưu ------------------------------- */

  const validate = () => {
    const fe = {};
    if (!form.name.trim()) fe.name = 'Tên danh mục là bắt buộc.';
    else if (form.name.trim().length > 60) fe.name = 'Tên danh mục tối đa 60 ký tự.';
    if (!form.slug.trim()) fe.slug = 'Slug là bắt buộc.';
    else if (!/^[a-z0-9-]+$/.test(form.slug.trim()))
      fe.slug = 'Slug chỉ gồm chữ thường, số và dấu gạch ngang.';
    if (
      form.sortOrder !== '' &&
      (!Number.isInteger(Number(form.sortOrder)) || Number(form.sortOrder) < 0)
    )
      fe.sortOrder = 'Thứ tự hiển thị phải là số nguyên lớn hơn hoặc bằng 0.';
    return fe;
  };

  const focusFirstError = () => {
    window.requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector('[data-invalid="true"]');
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.querySelector('input, select')?.focus({ preventScroll: true });
      }
    });
  };

  const handleSave = async () => {
    if (uploading) {
      onToast?.('Vui lòng đợi ảnh tải lên xong rồi mới lưu.');
      return;
    }
    const fe = validate();
    setFieldErrors(fe);
    if (Object.keys(fe).length) {
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        parentId: form.parentId || null,
        imageUrl: form.imageUrl || null,
        sortOrder: form.sortOrder === '' ? suggestedSortOrder : Number(form.sortOrder),
        active: form.active,
      };
      if (isEdit) await updateCategory(categoryId, payload);
      else await createCategory(payload);
      onSaved?.();
    } catch (e) {
      if (e?.field) {
        setFieldErrors((prev) => ({ ...prev, [e.field]: e.message }));
        focusFirstError();
      } else {
        // 422 vi phạm cây 2 cấp và lỗi còn lại: toast message cụ thể từ API (§B.3).
        onToast?.(e?.message || 'Không lưu được danh mục. Vui lòng thử lại.');
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
        {saving ? 'Đang lưu…' : 'Lưu danh mục'}
      </button>
    </>
  );

  // Chú thích khi tắt hiển thị 1 danh mục gốc đang có con (§3).
  const showChildrenHiddenHint = !form.active && !form.parentId && hasChildren;

  return (
    <>
      <AdminModal
        open
        title={isEdit ? 'Sửa danh mục' : 'Thêm danh mục'}
        onClose={requestClose}
        footer={footer}
      >
        <div ref={rootRef} className="cform">
          {loadState.loading ? (
            <div className="pform__loading" aria-busy="true">
              <div className="skeleton" style={{ height: 40 }} />
              <div className="skeleton" style={{ height: 40 }} />
              <div className="skeleton" style={{ height: 140 }} />
              <div className="skeleton" style={{ height: 40 }} />
            </div>
          ) : loadState.error ? (
            <div className="data-table__state">
              <p>Không tải được thông tin danh mục.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadDetail}>
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {isEdit ? <p className="pform__editing-name">{form.name}</p> : null}

              <Field label="Tên danh mục" required error={fieldErrors.name}>
                <input
                  className="pf-input"
                  value={form.name}
                  maxLength={60}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="VD: Sofa"
                />
              </Field>

              <Field
                label="Slug"
                error={fieldErrors.slug}
                hint={`mocan.vn/danh-muc/${form.slug || '…'}`}
              >
                <input
                  className="pf-input"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: e.target.value });
                  }}
                  placeholder="sofa"
                />
              </Field>

              <Field
                label="Danh mục cha"
                error={fieldErrors.parentId}
                hint={
                  hasChildren
                    ? 'Danh mục đang có danh mục con nên không thể chuyển thành danh mục con.'
                    : undefined
                }
              >
                <select
                  className="pf-input"
                  value={form.parentId}
                  disabled={hasChildren}
                  onChange={(e) => set({ parentId: e.target.value })}
                >
                  <option value="">Không có (danh mục gốc)</option>
                  {roots.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Ảnh danh mục">
                <div className="cat-img">
                  {form.imageUrl ? (
                    <div className="cat-img__preview">
                      <img src={form.imageUrl} alt="" />
                      <span className="cat-img__actions">
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
                      className="cat-img__empty"
                      onClick={() => setPickerOpen((v) => !v)}
                    >
                      Chưa có ảnh — bấm để chọn ảnh
                    </button>
                  )}
                  {uploading ? <p className="pf-field__hint">Đang tải ảnh lên…</p> : null}

                  {pickerOpen ? (
                    <div className="cat-picker">
                      <div className="cat-picker__tabs" role="tablist" aria-label="Chọn ảnh danh mục">
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

              <Field
                label="Thứ tự hiển thị"
                error={fieldErrors.sortOrder}
                hint="Số nhỏ hiện trước. Chỉ so sánh trong cùng cấp (cùng danh mục cha)."
              >
                <input
                  className="pf-input"
                  type="number"
                  min="0"
                  step="1"
                  value={form.sortOrder}
                  onChange={(e) => set({ sortOrder: e.target.value })}
                />
              </Field>

              <div className="pf-switch-row">
                <div className="pf-switch-row__text">
                  <span className="pf-switch-row__label">Đang hiển thị</span>
                  <span className="pf-field__hint">
                    Tắt = ẩn khỏi trang chủ và menu cửa hàng; sản phẩm trong danh mục không bị
                    ảnh hưởng.
                  </span>
                  {showChildrenHiddenHint ? (
                    <span className="pf-field__hint">
                      Các danh mục con ({childNames.join(', ')}) cũng sẽ bị ẩn phía khách hàng.
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  aria-label="Đang hiển thị"
                  className={`pf-switch${form.active ? ' is-on' : ''}`}
                  onClick={() => set({ active: !form.active })}
                >
                  <span className="pf-switch__dot" />
                </button>
              </div>
            </>
          )}
        </div>
      </AdminModal>

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
