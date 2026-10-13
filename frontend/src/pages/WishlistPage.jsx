import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import SortDropdown from '../components/SortDropdown';
import Button from '../components/Button';
import { SkeletonCard } from '../components/Skeleton';
import { getCardInfo } from '../utils/format';
import { isLoggedIn } from '../utils/auth';
import { removeWish } from '../utils/wishlist';
import {
  getWishlistItems,
  removeFromWishlist,
} from '../api/wishlistApi';
import { useCartCount } from '../hooks/useCartCount';

const SORT_OPTIONS = [
  { id: 'newest', label: 'Mới nhất' },
  { id: 'price_asc', label: 'Giá tăng dần' },
  { id: 'price_desc', label: 'Giá giảm dần' },
];

function priceOf(item) {
  return item.product ? getCardInfo(item.product).price ?? 0 : 0;
}

/**
 * Trang Sản phẩm yêu thích — FR-018 / F-013.
 * Route /yeu-thich. Guest xem wishlist local (không yêu cầu đăng nhập).
 */
export default function WishlistPage({ darkMode, onToggleDark, onToast }) {
  const navigate = useNavigate();
  const cartCount = useCartCount();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [items, setItems] = useState([]);
  const [sort, setSort] = useState('newest');
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const busyRef = useRef(false); // đang xóa optimistic -> bỏ qua event refetch

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await getWishlistItems();
      setItems((data || []).filter((i) => i.product));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
    const onChanged = () => {
      if (busyRef.current) return; // thao tác của chính trang -> đã optimistic
      load();
    };
    window.addEventListener('mocan:wishlist-changed', onChanged);
    window.addEventListener('mocan:auth-changed', onChanged);
    return () => {
      window.removeEventListener('mocan:wishlist-changed', onChanged);
      window.removeEventListener('mocan:auth-changed', onChanged);
    };
  }, [load]);

  /** Xóa khỏi wishlist: optimistic fade-out 200ms, rollback khi lỗi. */
  const handleRemove = useCallback(
    (product) => {
      const productId = product?.id;
      if (!productId || busyRef.current) return;
      busyRef.current = true;
      setRemovingIds((prev) => new Set(prev).add(productId));
      const snapshot = items;
      setTimeout(async () => {
        setItems((cur) => cur.filter((i) => i.productId !== productId));
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        onToast?.('Đã bỏ khỏi danh sách yêu thích.');
        try {
          if (isLoggedIn()) await removeFromWishlist(productId);
          else removeWish(productId);
        } catch {
          setItems(snapshot); // rollback
          onToast?.('Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
          busyRef.current = false;
        }
      }, 200);
    },
    [items, onToast]
  );

  const sorted = [...items].sort((a, b) => {
    if (sort === 'price_asc') return priceOf(a) - priceOf(b);
    if (sort === 'price_desc') return priceOf(b) - priceOf(a);
    return new Date(b.addedAt) - new Date(a.addedAt); // newest
  });

  const goProduct = (p) => navigate(`/san-pham/${p.slug}`);

  return (
    <div className="wishlist-page">
      <Header
        cartCount={cartCount}
        darkMode={darkMode}
        onToggleDark={onToggleDark}
        onToast={onToast}
      />

      <main className="container">
        <nav className="wishlist-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">→</span>
          <span aria-current="page">Sản phẩm yêu thích</span>
        </nav>

        <div className="wishlist-head">
          <h1>
            Sản phẩm yêu thích
            <span className="wishlist-count">({items.length} sản phẩm)</span>
          </h1>
          {status === 'ready' && items.length > 0 && (
            <SortDropdown value={sort} onChange={setSort} options={SORT_OPTIONS} />
          )}
        </div>

        {status === 'loading' && (
          <div className="wishlist-grid" aria-label="Đang tải">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="wishlist-error" role="alert">
            <div className="wishlist-error__icon" aria-hidden="true">⚠</div>
            <h2>Không tải được danh sách yêu thích</h2>
            <p>Đã có lỗi xảy ra, bạn vui lòng thử lại.</p>
            <Button variant="secondary" onClick={load}>
              Thử lại
            </Button>
          </div>
        )}

        {status === 'ready' && items.length === 0 && (
          <div className="wishlist-empty">
            <svg
              className="wishlist-empty__art"
              width="120"
              height="120"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <h2>Chưa có sản phẩm yêu thích</h2>
            <p>Lưu lại những món bạn thích để xem lại sau nhé.</p>
            <Button variant="primary" onClick={() => navigate('/')}>
              Khám phá sản phẩm
            </Button>
          </div>
        )}

        {status === 'ready' && items.length > 0 && (
          <div className="wishlist-grid">
            {sorted.map((item) => (
              <div
                key={item.productId}
                className={removingIds.has(item.productId) ? 'wishlist-item--removing' : undefined}
              >
                <ProductCard
                  product={item.product}
                  priceAtSave={item.priceAtSave}
                  onSelect={goProduct}
                  onToast={onToast}
                  onWishToggle={handleRemove}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer onToast={onToast} />
    </div>
  );
}
