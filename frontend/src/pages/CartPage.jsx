import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CartLineItem from '../components/CartLineItem';
import CartSummary from '../components/CartSummary';
import { useCartCount } from '../hooks/useCartCount';
import {
  getCart,
  updateQty,
  removeItem,
  restoreItem,
  updatePrice,
  validateCart,
} from '../utils/cart';
import { lookupVariants } from '../api/productApi';

const UNDO_MS = 5000;

/**
 * Màn Giỏ hàng — route /gio-hang. US-005 · FR-007 · FR-008 · F-005 · F-006.
 * Vào trang: validate giỏ với stock/giá/trạng thái mới nhất, loại dòng hết hàng,
 * cảnh báo giá đổi, cho phép hoàn tác khi xóa dòng.
 */
export default function CartPage({ darkMode, onToggleDark, onToast }) {
  const cartCount = useCartCount();
  const [items, setItems] = useState([]);
  const [slugByVariant, setSlugByVariant] = useState({});
  const [priceChanges, setPriceChanges] = useState({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);
  const toastTimers = useRef([]);

  const refreshItems = useCallback(() => setItems(getCart()), []);

  /** Toast nối đuôi từng món bị loại (toast App chỉ hiện 1 tin một lúc). */
  const queueRemovedToasts = useCallback(
    (removed) => {
      toastTimers.current.forEach(clearTimeout);
      toastTimers.current = removed.map((item, i) =>
        setTimeout(() => {
          onToast?.(
            `"${item.productName} — ${item.color}" không còn kinh doanh, đã được bỏ khỏi giỏ hàng`
          );
        }, i * 2800)
      );
    },
    [onToast]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const ids = getCart().map((i) => i.variantId);
      if (ids.length > 0) {
        // Tra cứu 1 lần rồi tái dùng map cho validateCart (tránh gọi API 2 lần).
        const infoMap = await lookupVariants(ids);
        setSlugByVariant(
          Object.fromEntries(
            Object.entries(infoMap)
              .filter(([, info]) => info?.productSlug)
              .map(([id, info]) => [id, info.productSlug])
          )
        );
        const { removed, priceChanges: changes } = await validateCart(() =>
          Promise.resolve(infoMap)
        );
        if (removed.length > 0) queueRemovedToasts(removed);
        setPriceChanges(
          Object.fromEntries(changes.map((c) => [c.variantId, c.newPrice]))
        );
      }
      refreshItems();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [queueRemovedToasts, refreshItems]);

  useEffect(() => {
    load();
    return () => {
      toastTimers.current.forEach(clearTimeout);
      clearTimeout(undoTimer.current);
    };
  }, [load]);

  const handleQtyChange = (variantId, qty) => {
    updateQty(variantId, qty);
    refreshItems();
  };

  const handleRemove = (variantId) => {
    const { removed } = removeItem(variantId);
    if (!removed) return;
    clearTimeout(undoTimer.current);
    setUndo({ name: removed.item.productName, removed });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
    refreshItems();
  };

  const handleUndo = () => {
    if (!undo) return;
    clearTimeout(undoTimer.current);
    restoreItem(undo.removed);
    setUndo(null);
    refreshItems();
  };

  const handleUpdatePrice = (variantId, newPrice) => {
    updatePrice(variantId, newPrice);
    setPriceChanges((prev) => {
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
    refreshItems();
    onToast?.('Đã cập nhật giá mới cho sản phẩm.');
  };

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div className="cart-page">
      <Header
        cartCount={cartCount}
        darkMode={darkMode}
        onToggleDark={onToggleDark}
        onToast={onToast}
      />

      <main className="container cart-main">
        <nav className="cart-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Giỏ hàng</span>
        </nav>

        <h1 className="cart-title">
          Giỏ hàng <span className="cart-title__count">({totalQty} sản phẩm)</span>
        </h1>

        {loading ? (
          <div className="cart-grid" aria-label="Đang tải giỏ hàng">
            <section className="cart-lines">
              {[0, 1, 2].map((i) => (
                <div className="skeleton cart-line-skeleton" key={i} aria-hidden="true">
                  <div className="skeleton cart-line-skeleton__img" />
                  <div className="cart-line-skeleton__body">
                    <div className="skeleton" style={{ height: 16, width: '70%' }} />
                    <div className="skeleton" style={{ height: 14, width: '40%' }} />
                    <div className="skeleton" style={{ height: 20, width: '50%' }} />
                  </div>
                  <div className="skeleton" style={{ height: 36, width: 120 }} />
                </div>
              ))}
            </section>
            <aside className="cart-summary cart-summary--skeleton" aria-hidden="true">
              <div className="skeleton" style={{ height: 20, width: '60%' }} />
              <div className="skeleton" style={{ height: 16, width: '100%' }} />
              <div className="skeleton" style={{ height: 16, width: '80%' }} />
              <div className="skeleton" style={{ height: 44, width: '100%' }} />
            </aside>
          </div>
        ) : failed ? (
          <div className="cart-error" role="alert">
            <div className="cart-error__icon" aria-hidden="true">⚠</div>
            <h2>Không tải được giỏ hàng</h2>
            <p>Đã có lỗi xảy ra, bạn vui lòng thử lại.</p>
            <button type="button" className="btn btn-secondary" onClick={load}>
              Thử lại
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="cart-empty">
            <svg
              className="cart-empty__art"
              width="120"
              height="120"
              viewBox="0 0 120 120"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M20 30h14l8 44h52l8-32H38"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="48" cy="94" r="6" stroke="currentColor" strokeWidth="4" />
              <circle cx="86" cy="94" r="6" stroke="currentColor" strokeWidth="4" />
              <path
                d="M48 48h40"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="2 8"
              />
            </svg>
            <h2>Giỏ hàng trống</h2>
            <p>Hãy khám phá hàng trăm mẫu nội thất cho tổ ấm của bạn.</p>
            <Link to="/" className="btn btn-primary">
              Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <div className="cart-grid">
            <section className="cart-lines" aria-label="Danh sách sản phẩm trong giỏ">
              {items.map((item) => (
                <CartLineItem
                  key={item.variantId}
                  item={item}
                  productSlug={slugByVariant[item.variantId]}
                  newPrice={priceChanges[item.variantId] ?? null}
                  onQtyChange={handleQtyChange}
                  onRemove={handleRemove}
                  onUpdatePrice={handleUpdatePrice}
                />
              ))}
            </section>
            <CartSummary subtotal={subtotal} onToast={onToast} />
          </div>
        )}
      </main>

      <Footer onToast={onToast} />

      {/* Toast hoàn tác local — không dùng toast App để không lẫn tin hệ thống */}
      {undo && (
        <div className="cart-undo" role="status">
          <span>Đã xóa {undo.name}</span>
          <button type="button" className="cart-undo__btn" onClick={handleUndo}>
            Hoàn tác
          </button>
        </div>
      )}
    </div>
  );
}
