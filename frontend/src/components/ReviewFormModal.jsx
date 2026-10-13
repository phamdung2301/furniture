import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';
import { createReview, updateReview, deleteReview, uploadImages } from '../api/reviewApi';
import '../review.css';

/**
 * Modal viết/sửa đánh giá — §3/§4 spec viet-danh-gia.
 * Pattern modal tái dùng từ QuickViewModal: overlay 40%, đóng bằng ×/click
 * ngoài/Esc, mobile bottom-sheet. Desktop 520px căn giữa.
 *
 * Props:
 *   mode: "new" | "edit"
 *   product, existingReview, purchasedColors[], orderId
 *   onClose, onSuccess(review, summary, mode), onDeleted(reviewId, summary),
 *   onConflict(serverReview?) — 409 race 2 tab: page chuyển sang mode sửa
 *   onToast — toast 1 chuỗi (mạng lỗi giữ nguyên form)
 */
const STAR_LABELS = ['Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Rất tốt'];
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ReviewFormModal({
  mode = 'new',
  product,
  existingReview,
  purchasedColors = [],
  orderId,
  onClose,
  onSuccess,
  onDeleted,
  onConflict,
  onToast,
}) {
  const navigate = useNavigate();
  const isEdit = mode === 'edit' && existingReview;
  const fileRef = useRef(null);

  const draftKey = `mocan_review_draft:${product?.slug || ''}`;

  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hover, setHover] = useState(0);
  const [color, setColor] = useState(() => {
    if (existingReview?.color && purchasedColors.includes(existingReview.color)) {
      return existingReview.color;
    }
    return purchasedColors[0] || '';
  });
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [images, setImages] = useState(() =>
    (existingReview?.images || []).map((url, i) => ({ id: `old-${i}`, url }))
  );
  const [fileErrors, setFileErrors] = useState([]);
  const [uploading, setUploading] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [starError, setStarError] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [profanityError, setProfanityError] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  /* Khôi phục draft khi quay lại từ màn đăng nhập (401 giữ draft trong memory). */
  useEffect(() => {
    if (isEdit) return;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.rating) setRating(d.rating);
      if (d.comment) setComment(d.comment);
      if (d.color) setColor(d.color);
      if (Array.isArray(d.images) && d.images.length > 0) {
        setImages(d.images.map((url, i) => ({ id: `draft-${i}`, url })));
      }
    } catch {
      // Draft hỏng thì bỏ qua, mở form trắng.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDraft = () => {
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          rating,
          color,
          comment,
          images: images.filter((i) => i.url).map((i) => i.url),
        })
      );
    } catch {
      // Storage đầy/bị chặn: bỏ qua, vẫn chuyển login.
    }
  };

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // Bỏ qua.
    }
  };

  const hasContent = rating > 0 || comment.trim() !== '' || images.length > 0;
  const closeRef = useRef(null);

  const handleClose = () => {
    if ((submitting || deleting) && hasContent) {
      if (!window.confirm('Bỏ qua đánh giá đang viết?')) return;
    }
    onClose?.();
  };
  closeRef.current = handleClose;

  /* × / click ngoài / Esc đóng modal (QuickViewModal pattern). */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []);

  /* ---------- upload ảnh: ngay khi chọn ---------- */
  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    const errs = [];
    const valid = [];
    for (const f of files) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        errs.push('Định dạng không hỗ trợ, vui lòng chọn JPG/PNG/WebP.');
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        errs.push(`Ảnh ${f.name} vượt quá 5MB.`);
        continue;
      }
      if (images.length + valid.length >= MAX_IMAGES) {
        errs.push(`Chỉ được thêm tối đa ${MAX_IMAGES} ảnh.`);
        break;
      }
      valid.push(f);
    }
    setFileErrors(errs);
    valid.forEach((f) => {
      const id = `up-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setImages((prev) => [...prev, { id, uploading: true }]);
      setUploading((n) => n + 1);
      uploadImages([f])
        .then(({ urls }) => {
          setImages((prev) =>
            prev.map((img) => (img.id === id ? { id, url: urls[0] } : img))
          );
        })
        .catch(() => {
          setImages((prev) => prev.filter((img) => img.id !== id));
          setFileErrors((prev) => [...prev, `Không tải được ảnh ${f.name}, bạn thử lại nhé.`]);
        })
        .finally(() => setUploading((n) => n - 1));
    });
  };

  const removeImage = (id) => {
    // Xóa trước khi gửi: chỉ gỡ khỏi form, không gọi API (spec §4).
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  /* ---------- gửi ---------- */
  const handleSubmit = async () => {
    let ok = true;
    if (rating === 0) {
      setStarError(true);
      ok = false;
    }
    const c = comment.trim();
    if (c && c.length < 10) {
      setCommentError('Bình luận cần ít nhất 10 ký tự.');
      ok = false;
    } else {
      setCommentError('');
    }
    if (!ok) return;

    setSubmitting(true);
    setFormError('');
    setProfanityError('');
    const payload = {
      rating,
      comment: c,
      imageUrls: images.filter((i) => i.url).map((i) => i.url),
      color: color || undefined,
      orderId,
    };
    try {
      const { review, summary } = isEdit
        ? await updateReview(existingReview.id, payload)
        : await createReview(product.slug, payload);
      clearDraft();
      onSuccess?.(review, summary, isEdit ? 'edit' : 'new');
    } catch (e) {
      const status = e?.status ?? e?.response?.status;
      if (status === 422) {
        setProfanityError('Bình luận chứa từ ngữ không phù hợp. Vui lòng chỉnh sửa lại.');
      } else if (status === 409) {
        onConflict?.(e?.review ?? e?.response?.data?.review);
      } else if (status === 401) {
        saveDraft();
        navigate(`/dang-nhap?returnTo=${encodeURIComponent(`/san-pham/${product.slug}?review=open`)}`);
      } else if (status === 403) {
        setFormError('Bạn cần mua và nhận hàng trước khi đánh giá.');
      } else {
        // Lỗi mạng: giữ nguyên form, cho gửi lại (spec §6).
        setFormError('Gửi đánh giá thất bại, vui lòng thử lại.');
        onToast?.('Gửi đánh giá thất bại, vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- xóa (chế độ sửa) ---------- */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { summary } = await deleteReview(existingReview.id);
      onDeleted?.(existingReview.id, summary);
    } catch {
      setFormError('Xóa đánh giá thất bại, vui lòng thử lại.');
      onToast?.('Xóa đánh giá thất bại, vui lòng thử lại.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const sendDisabled = rating === 0 || uploading > 0 || submitting;

  return (
    <div
      className="rf-overlay"
      onClick={() => {
        if (!submitting && !deleting) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Sửa đánh giá của bạn' : 'Đánh giá sản phẩm'}
    >
      <div className="rf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rf-head">
          <div>
            <h3 className="rf-title">{isEdit ? 'Sửa đánh giá của bạn' : 'Đánh giá sản phẩm'}</h3>
            {!isEdit && product?.name && <p className="rf-product">{product.name}</p>}
          </div>
          <button type="button" className="rf-close" onClick={handleClose} aria-label="Đóng">
            ×
          </button>
        </div>

        <div className="rf-body">
          {/* 3.1 Chọn sao — bắt buộc */}
          <div className="rf-field">
            <span className="rf-label">Đánh giá của bạn</span>
            <div className="rf-stars" role="radiogroup" aria-label="Chọn số sao">
              {[1, 2, 3, 4, 5].map((s) => {
                const lit = (hover || rating) >= s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={rating === s}
                    aria-label={`${s} sao — ${STAR_LABELS[s - 1]}`}
                    className={`rf-star${lit ? ' lit' : ''}`}
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(0)}
                    onFocus={() => setHover(s)}
                    onBlur={() => setHover(0)}
                    onClick={() => {
                      setRating(s);
                      setStarError(false);
                    }}
                    disabled={submitting}
                  >
                    ★
                  </button>
                );
              })}
              <span className="rf-star__label" aria-hidden="true">
                {STAR_LABELS[(hover || rating) - 1] || ''}
              </span>
            </div>
            {starError && <p className="rf-error">Vui lòng chọn số sao đánh giá.</p>}
          </div>

          {/* 3.2 Màu đã mua */}
          {purchasedColors.length > 1 ? (
            <div className="rf-field">
              <span className="rf-label">Màu bạn đã mua</span>
              <div className="rf-chips" role="radiogroup" aria-label="Màu bạn đã mua">
                {purchasedColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    className={`rf-chip${color === c ? ' selected' : ''}`}
                    onClick={() => setColor(c)}
                    disabled={submitting}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : purchasedColors.length === 1 ? (
            <div className="rf-field">
              <span className="rf-chip readonly" aria-label={`Màu đã mua: ${purchasedColors[0]}`}>
                Màu: {purchasedColors[0]}
              </span>
            </div>
          ) : null}

          {/* 3.3 Bình luận */}
          <div className="rf-field">
            <label className="rf-label" htmlFor="rf-comment">
              Chia sẻ cảm nhận
            </label>
            <div className="rf-textarea-wrap">
              <textarea
                id="rf-comment"
                className={`rf-textarea${profanityError ? ' invalid' : ''}`}
                rows={4}
                maxLength={1000}
                placeholder="Chia sẻ cảm nhận của bạn về chất lượng, màu sắc, trải nghiệm giao hàng…"
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (commentError) setCommentError('');
                  if (profanityError) setProfanityError('');
                }}
                disabled={submitting}
              />
              <span className="rf-counter" aria-hidden="true">
                {comment.length}/1000
              </span>
            </div>
            {commentError && <p className="rf-error">{commentError}</p>}
            {profanityError && <p className="rf-error">{profanityError}</p>}
          </div>

          {/* 3.4 Ảnh minh họa */}
          <div className="rf-field">
            <span className="rf-label">Ảnh minh họa (không bắt buộc)</span>
            <div
              className={`rf-upload${dragOver ? ' dragover' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              role="button"
              tabIndex={0}
              aria-label="Thêm ảnh đánh giá"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
            >
              <span className="rf-upload__icon" aria-hidden="true">
                🖼️
              </span>
              <span className="rf-upload__text">Thêm ảnh (tối đa 5)</span>
              <span className="rf-upload__hint">JPG, PNG, WebP · mỗi ảnh ≤ 5MB</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
            {images.length > 0 && (
              <div className="rf-thumbs">
                {images.map((img) => (
                  <div key={img.id} className="rf-thumb">
                    {img.uploading ? (
                      <span className="rf-thumb__loading" role="status" aria-label="Đang tải ảnh lên" />
                    ) : (
                      <img src={img.url} alt="Ảnh đánh giá" />
                    )}
                    <button
                      type="button"
                      className="rf-thumb__remove"
                      onClick={() => removeImage(img.id)}
                      aria-label="Xóa ảnh này"
                      disabled={img.uploading || submitting}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {fileErrors.map((msg, i) => (
              <p key={i} className="rf-error">
                {msg}
              </p>
            ))}
          </div>

          {formError && (
            <p className="rf-error rf-form-error" role="alert">
              {formError}
            </p>
          )}

          {/* Xác nhận xóa inline (chế độ sửa) */}
          {isEdit && confirmDelete && (
            <div className="rf-confirm" role="alertdialog" aria-label="Xác nhận xóa đánh giá">
              <p>Bạn chắc chắn muốn xóa đánh giá này?</p>
              <div className="rf-confirm__actions">
                <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Giữ lại
                </Button>
                <button
                  type="button"
                  className="rf-confirm__delete"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Đang xóa…' : 'Xóa'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rf-footer">
          {isEdit && !confirmDelete && (
            <button
              type="button"
              className="rf-delete-link"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting}
            >
              Xóa đánh giá
            </button>
          )}
          <div className="rf-footer__actions">
            <Button variant="text" onClick={handleClose} disabled={submitting}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={sendDisabled}>
              {submitting ? 'Đang gửi…' : isEdit ? 'Lưu thay đổi' : 'Gửi đánh giá'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
