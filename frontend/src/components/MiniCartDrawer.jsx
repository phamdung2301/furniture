import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCart, getCartSubtotal } from '../utils/cart';
import { useCartCount } from '../hooks/useCartCount';
import { formatVND } from '../utils/format';

/**
 * Mini-cart drawer — §4 spec (FR-007, US-005). Được render BÊN TRONG Header.jsx.
 * Mở từ icon giỏ: drawer trượt từ phải, overlay 40%, Esc/×/overlay để đóng.
 * Hiển thị 4 món mới nhất (item mới thêm nằm cuối mảng cart → lấy 4 cuối, đảo lại).
 * Tự refresh khi nghe event 'mocan:cart-changed' (đổi từ màn khác).
 */
export default function MiniCartDrawer({ open, onClose, onToast }) {
  const navigate = useNavigate();
  const count = useCartCount();
  const [items, setItems] = useState(() => (open ? getCart() : []));
  const [subtotal, setSubtotal] = useState(() => (open ? getCartSubtotal() : 0));
  const drawerRef = useRef(null);
  const closeRef = useRef(null);

  const refresh = useCallback(() => {
    setItems(getCart());
    setSubtotal(getCartSubtotal());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    const onStorage = () => refresh();
    window.addEventListener('mocan:cart-changed', onStorage);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('mocan:cart-changed', onStorage);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  // Esc đóng + khóa scroll body khi mở
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Focus trap nhẹ: Tab giữ focus trong drawer
  const handleTabTrap = (e) => {
    if (e.key !== 'Tab' || !drawerRef.current) return;
    const focusables = drawerRef.current.querySelectorAll(
      'button, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const recent = items.slice(-4).reverse();

  const handleOrder = () => {
    onClose?.();
    navigate('/dat-hang');
  };

  return (
    <div className="minicart" role="dialog" aria-modal="true" aria-label={`Giỏ hàng (${count})`}>
      <div
        className="minicart__overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="minicart__panel"
        ref={drawerRef}
        onKeyDown={handleTabTrap}
      >
        <div className="minicart__head">
          <h2 className="minicart__title">Giỏ hàng ({count})</h2>
          <button
            type="button"
            className="minicart__close"
            onClick={onClose}
            ref={closeRef}
            aria-label="Đóng giỏ hàng"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="minicart__empty">
            <p>Giỏ hàng đang trống</p>
            <Link to="/" className="btn btn-primary" onClick={onClose}>
              Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <>
            <ul className="minicart__list">
              {recent.map((item) => (
                <li key={item.variantId} className="minicart__item">
                  <img
                    src={item.image}
                    alt={item.productName}
                    className="minicart__img"
                    loading="lazy"
                  />
                  <div className="minicart__meta">
                    <div className="minicart__name">{item.productName}</div>
                    <div className="minicart__sub">
                      <span
                        className="minicart__dot"
                        style={{ backgroundColor: item.colorHex || 'transparent' }}
                        aria-hidden="true"
                      />
                      {item.color} · ×{item.qty}
                    </div>
                  </div>
                  <div className="minicart__line-total">
                    {formatVND(item.price * item.qty)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="minicart__foot">
              <div className="minicart__subtotal">
                <span>Tạm tính</span>
                <span className="minicart__amount">{formatVND(subtotal)}</span>
              </div>
              <div className="minicart__ctas">
                <button type="button" className="btn btn-primary" onClick={handleOrder}>
                  Đặt hàng
                </button>
                <Link to="/gio-hang" className="btn btn-secondary" onClick={onClose}>
                  Xem giỏ hàng
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
