import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';
import { renderStars } from '../utils/format';
import '../review.css';

/**
 * Tóm tắt đánh giá — §4.3 spec màn 4 + §2 spec viet-danh-gia (F-012, 5 case).
 * Nút "Viết đánh giá"/"Sửa đánh giá" LUÔN hiển thị — click xử lý theo case:
 *   1. NOT_LOGGED_IN  → chuyển /dang-nhap?returnTo=…?review=open
 *   2. NOT_PURCHASED   → tooltip: chỉ khách đã mua và nhận hàng mới được đánh giá
 *   3. NOT_COMPLETED   → tooltip: đánh giá sau khi nhận hàng (+ link theo dõi đơn)
 *   4. ALREADY_REVIEWED → nút "Sửa đánh giá" → mở modal chế độ sửa
 *   5. OK              → nút "Viết đánh giá" → mở modal viết mới
 * Tooltip: popover dưới nút, nền --text, chữ trắng 13px, tự đóng 4s / click ngoài.
 *
 * Props: summary, eligibility {canReview, hasReviewed, reason, purchasedColors[]},
 *   slug, onOpenModal(mode), onToast, nudgeTip (deep-link ?review=open không đủ
 *   điều kiện → page tăng nonce để hiện tooltip lý do).
 */
export default function ReviewSummary({
  summary,
  eligibility,
  slug,
  onOpenModal,
  onToast,
  nudgeTip,
}) {
  const navigate = useNavigate();
  const [tip, setTip] = useState(null); // { text, track }
  const tipTimer = useRef(null);
  const actionRef = useRef(null);

  const { average = 0, total = 0, distribution = {} } = summary || {};
  const reason = eligibility ? eligibility.reason : 'LOADING';
  const hasReviewed = Boolean(eligibility?.hasReviewed);

  const closeTip = () => {
    setTip(null);
    if (tipTimer.current) {
      clearTimeout(tipTimer.current);
      tipTimer.current = null;
    }
  };

  const showTip = (kind) => {
    closeTip();
    if (kind === 'NOT_PURCHASED') {
      setTip({
        text: 'Chỉ khách hàng đã mua và nhận hàng mới có thể đánh giá sản phẩm này.',
      });
    } else if (kind === 'NOT_COMPLETED') {
      setTip({ text: 'Bạn có thể đánh giá sau khi nhận hàng.', track: true });
    }
    tipTimer.current = setTimeout(closeTip, 4000);
  };

  const handleClick = () => {
    if (reason === 'LOADING') return;
    if (reason === 'OK') {
      closeTip();
      onOpenModal?.('new');
      return;
    }
    if (reason === 'ALREADY_REVIEWED') {
      closeTip();
      onOpenModal?.('edit');
      return;
    }
    if (reason === 'NOT_LOGGED_IN') {
      navigate(
        `/dang-nhap?returnTo=${encodeURIComponent(`/san-pham/${slug}?review=open`)}`
      );
      return;
    }
    showTip(reason);
  };

  /* Click ngoài → đóng tooltip. */
  useEffect(() => {
    const onDoc = (e) => {
      if (actionRef.current && !actionRef.current.contains(e.target)) closeTip();
    };
    document.addEventListener('click', onDoc);
    return () => {
      document.removeEventListener('click', onDoc);
      if (tipTimer.current) clearTimeout(tipTimer.current);
    };
  }, []);

  /* Deep-link ?review=open nhưng không đủ điều kiện → hiện tooltip lý do. */
  useEffect(() => {
    if (nudgeTip && (reason === 'NOT_PURCHASED' || reason === 'NOT_COMPLETED')) {
      showTip(reason);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudgeTip]);

  return (
    <div className="pd-review-summary">
      <div className="pd-review-summary__score">
        <div className="pd-review-summary__avg">{average.toFixed(1)}</div>
        <div className="stars" aria-hidden="true">
          {renderStars(average)}
        </div>
        <div className="pd-review-summary__total">dựa trên {total} đánh giá</div>
      </div>
      <div className="pd-review-summary__dist" aria-label="Phân bố đánh giá">
        {[5, 4, 3, 2, 1].map((star) => (
          <div key={star} className="pd-dist-row">
            <span className="pd-dist-row__label">{star}★</span>
            <div className="pd-dist-row__bar">
              <div
                className="pd-dist-row__fill"
                style={{ width: `${distribution[star] || 0}%` }}
              />
            </div>
            <span className="pd-dist-row__pct">{distribution[star] || 0}%</span>
          </div>
        ))}
      </div>
      <div className="pd-review-summary__action" ref={actionRef}>
        <Button variant="secondary" onClick={handleClick} disabled={reason === 'LOADING'}>
          {hasReviewed ? 'Sửa đánh giá' : 'Viết đánh giá'}
        </Button>
        {tip && (
          <div className="rs-tip" role="note">
            <p className="rs-tip__text">{tip.text}</p>
            {tip.track && (
              <button
                type="button"
                className="rs-tip__link"
                onClick={() =>
                  onToast?.('Khi nhận được hàng, bạn quay lại đây để đánh giá nhé.')
                }
              >
                Theo dõi đơn hàng →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
