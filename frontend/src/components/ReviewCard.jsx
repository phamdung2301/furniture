import { useState } from 'react';
import { renderStars } from '../utils/format';
import { getUser } from '../utils/auth';
import '../review.css';

/** Thẻ đánh giá — avatar chữ cái, tên, sao, ngày, badge "Đã mua hàng", ảnh. */
export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Props mới (§5 spec viet-danh-gia):
 *   - review.color → dòng muted "Màu: Xám" dưới hàng sao
 *   - review.userId trùng user đang login → nút text "Sửa" / "Xóa" (Xóa confirm inline)
 *   - review mới < 5 phút → nhãn "Mới"
 *   - onEdit(review), onDelete(reviewId) — page xử lý API + cập nhật list
 */
export default function ReviewCard({ review, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initial = (review.userName || '?').trim().charAt(0).toUpperCase();
  const me = getUser();
  const isMine = Boolean(review.userId && me && review.userId === me.id);
  const created = new Date(review.createdAt).getTime();
  const isNew =
    !Number.isNaN(created) && Date.now() - created >= 0 && Date.now() - created < FIVE_MINUTES;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete?.(review.id);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <article className="pd-review-card">
      <div className="pd-review-card__avatar" aria-hidden="true">
        {initial}
      </div>
      <div className="pd-review-card__main">
        <div className="pd-review-card__head">
          <span className="pd-review-card__name">{review.userName}</span>
          {review.verifiedPurchase && (
            <span className="pd-review-card__verified">Đã mua hàng</span>
          )}
          {isNew && <span className="rc-new">Mới</span>}
        </div>
        <div className="pd-review-card__meta">
          <span className="stars" aria-label={`${review.rating} trên 5 sao`}>
            {renderStars(review.rating)}
          </span>
          <span className="pd-review-card__date">{formatDate(review.createdAt)}</span>
        </div>
        {review.color && <p className="rc-color">Màu: {review.color}</p>}
        <p className="pd-review-card__comment">{review.comment}</p>
        {(review.images || []).length > 0 && (
          <div className="pd-review-card__images">
            {review.images.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" aria-label={`Xem ảnh đánh giá ${i + 1}`}>
                <img src={url} alt={`Ảnh đánh giá ${i + 1} của ${review.userName}`} loading="lazy" />
              </a>
            ))}
          </div>
        )}
        {isMine && (
          <div className="rc-actions">
            {!confirming ? (
              <>
                <button type="button" className="rc-action" onClick={() => onEdit?.(review)}>
                  Sửa
                </button>
                <button
                  type="button"
                  className="rc-action danger"
                  onClick={() => setConfirming(true)}
                >
                  Xóa
                </button>
              </>
            ) : (
              <span className="rc-confirm" role="alertdialog" aria-label="Xác nhận xóa đánh giá">
                Bạn chắc chắn muốn xóa đánh giá này?
                <button
                  type="button"
                  className="rc-action danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Đang xóa…' : 'Xóa'}
                </button>
                <button
                  type="button"
                  className="rc-action"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                >
                  Giữ lại
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
