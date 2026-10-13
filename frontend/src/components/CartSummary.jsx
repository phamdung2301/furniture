import { Link, useNavigate } from 'react-router-dom';
import { formatVND } from '../utils/format';
import { isLoggedIn } from '../utils/auth';

/**
 * Cột tóm tắt đơn — §3 spec (F-005, FR-007).
 * Chưa có ô nhập voucher (F-007: voucher áp ở bước đặt hàng).
 * FR-009: checkout không cho khách vãng lai -> chưa login bấm "Đặt hàng"
 * sẽ chuyển sang /dang-nhap?returnTo=/dat-hang.
 */
export default function CartSummary({ subtotal = 0, onToast }) {
  const navigate = useNavigate();

  const handleOrder = () => {
    if (!isLoggedIn()) {
      navigate('/dang-nhap?returnTo=/dat-hang');
      return;
    }
    navigate('/dat-hang');
  };

  return (
    <>
      <aside className="cart-summary" aria-label="Tóm tắt đơn hàng">
        <h2 className="cart-summary__title">Tóm tắt đơn hàng</h2>

        <div className="cart-summary__row">
          <span>Tạm tính</span>
          <span className="cart-summary__amount">{formatVND(subtotal)}</span>
        </div>

        <div className="cart-summary__row">
          <span className="cart-summary__shiplabel">
            Phí vận chuyển
            <span
              className="cart-summary__info"
              tabIndex={0}
              role="img"
              aria-label="Phí ship được tính theo tổng diện tích đơn hàng khi bạn đặt hàng"
            >
              ⓘ
              <span className="cart-summary__tooltip">
                Phí ship được tính theo tổng diện tích đơn hàng khi bạn đặt hàng
              </span>
            </span>
          </span>
          <span className="cart-summary__muted">Tính ở bước đặt hàng</span>
        </div>

        <div className="cart-summary__divider" />

        <div className="cart-summary__row cart-summary__row--total">
          <span>Tổng cộng (tạm tính)</span>
          <span className="cart-summary__grand">{formatVND(subtotal)}</span>
        </div>

        <p className="cart-summary__voucher">
          <span aria-hidden="true">🏷️</span> Mã giảm giá sẽ được áp dụng ở bước đặt hàng
        </p>

        <button type="button" className="btn btn-primary cart-summary__cta" onClick={handleOrder}>
          Đặt hàng
        </button>
        <Link to="/" className="btn btn-secondary cart-summary__cta">
          Tiếp tục mua sắm
        </Link>
      </aside>

      {/* Sticky bottom bar chỉ hiện trên mobile */}
      <div className="cart-mobilebar" aria-label="Thanh đặt hàng nhanh">
        <div className="cart-mobilebar__subtotal">
          <span className="cart-mobilebar__label">Tạm tính</span>
          <span className="cart-mobilebar__amount">{formatVND(subtotal)}</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleOrder}>
          Đặt hàng
        </button>
      </div>
    </>
  );
}
