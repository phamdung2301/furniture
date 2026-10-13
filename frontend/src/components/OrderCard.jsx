/**
 * Card 1 đơn trong trang danh sách — theo-doi-don.md §2.2 (FR-016, US-009).
 * Click card -> chi tiết; nút copy / nút hành động nhanh stopPropagation.
 */
import { useNavigate } from 'react-router-dom';
import OrderStatusBadge from './OrderStatusBadge';
import { formatVND, formatDateTime } from '../utils/format';

async function copyText(text, onToast) {
  try {
    await navigator.clipboard.writeText(text);
    onToast?.('Đã sao chép mã đơn.');
  } catch {
    onToast?.('Không sao chép được, bạn vui lòng ghi lại thủ công.');
  }
}

export default function OrderCard({ order, onToast }) {
  const navigate = useNavigate();
  const detailPath = `/don-hang/${order.orderNumber}`;
  const preview = order.itemsPreview || [];
  const extra = Math.max(0, (order.itemCount || 0) - preview.length);
  const needsPayment =
    order.status === 'MỚI' &&
    order.paymentMethod === 'MOMO' &&
    order.paymentStatus === 'CHƯA THANH TOÁN';
  const needsReview =
    order.status === 'HOÀN THÀNH' && order.hasUnreviewedItems;

  return (
    <article
      className="order-card"
      onClick={() => navigate(detailPath)}
      aria-label={`Đơn hàng ${order.orderNumber}`}
    >
      <div className="order-card__row1">
        <button
          type="button"
          className="order-card__no"
          title="Bấm để sao chép mã đơn"
          onClick={(e) => {
            e.stopPropagation();
            copyText(order.orderNumber, onToast);
          }}
        >
          {order.orderNumber}
          <span aria-hidden="true">⧉</span>
        </button>
        <OrderStatusBadge status={order.status} />
        <span className="order-card__date">{formatDateTime(order.createdAt)}</span>
      </div>

      <div className="order-card__row2">
        <div className="order-card__thumbs">
          {preview.map((it, idx) => (
            <img
              key={idx}
              src={it.image}
              alt={it.productName || ''}
              width="56"
              height="56"
              loading="lazy"
            />
          ))}
          {extra > 0 && (
            <span className="order-card__more">+{extra} món nữa</span>
          )}
        </div>
        <p className="order-card__total">
          Tổng: <strong>{formatVND(order.total)}</strong>
        </p>
      </div>

      {(needsPayment || needsReview) && (
        <div className="order-card__row3">
          {needsPayment && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/thanh-toan?order=${order.orderNumber}`);
              }}
            >
              Thanh toán ngay
            </button>
          )}
          {needsReview && (
            <button
              type="button"
              className="btn btn-text"
              onClick={(e) => {
                e.stopPropagation();
                navigate(detailPath);
              }}
            >
              Đánh giá sản phẩm →
            </button>
          )}
        </div>
      )}
    </article>
  );
}
