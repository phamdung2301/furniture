import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import HeroCarousel from '../components/HeroCarousel';
import CategoryGrid from '../components/CategoryGrid';
import ProductCard from '../components/ProductCard';
import FlashSaleCard from '../components/FlashSaleCard';
import CountdownTimer from '../components/CountdownTimer';
import SectionHeader from '../components/SectionHeader';
import Footer from '../components/Footer';
import Button from '../components/Button';
import QuickViewModal from '../components/QuickViewModal';
import { SkeletonCard, SkeletonCircle, SkeletonBanner } from '../components/Skeleton';
import useRevealRoot from '../hooks/useReveal';
import { useCartCount } from '../hooks/useCartCount';
import { addToCart } from '../utils/cart';
import {
  getBanners,
  getFeaturedCategories,
  getFeaturedProducts,
  getBestSellers,
  getNewestProducts,
} from '../api/homeApi';
import { getCurrentFlashSale } from '../api/flashSaleApi';
import { variantPrice, activeFlash } from '../utils/format';

/**
 * Trang chủ — F-001 / FR-001 / US-001.
 * Mỗi khối tự quản lý 3 trạng thái: loading (skeleton) / empty (ẩn khối) / error (thử lại).
 */
function useBlock(fetcher) {
  const [state, setState] = useState({ status: 'loading', data: [] });
  const load = async () => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const data = await fetcher();
      setState({ status: 'success', data: data || [] });
    } catch {
      setState((s) => ({ ...s, status: 'error' }));
    }
  };
  useEffect(() => { load(); }, []);
  return { ...state, retry: load };
}

function ProductBlock({ title, block, onSelect, onQuickView, onMore, onToast }) {
  if (block.status === 'loading') {
    return (
      <section className="section">
        <div className="container">
          <div className="skeleton" style={{ height: 28, width: 220, marginBottom: 20 }} />
          <div className="product-grid">
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </section>
    );
  }
  if (block.status === 'error') {
    return (
      <section className="section">
        <div className="container">
          <div className="inline-error">
            <p>⚠️ Không tải được sản phẩm. Kiểm tra mạng rồi thử lại nhé.</p>
            <Button variant="secondary" size="sm" onClick={block.retry}>Thử lại</Button>
          </div>
        </div>
      </section>
    );
  }
  if (block.data.length === 0) return null; // empty => ẩn khối (§5)
  return (
    <section className="section reveal">
      <div className="container">
        <SectionHeader title={title} onMore={onMore} />
        <div className="product-grid">
          {block.data.slice(0, 8).map((p, i) => (
            <div key={p.id} className="reveal" style={{ transitionDelay: `${(i % 4) * 70}ms` }}>
              <ProductCard product={p} onSelect={onSelect} onQuickView={onQuickView} onToast={onToast} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage({ darkMode, onToggleDark, onToast }) {
  const rootRef = useRevealRoot();
  const banners = useBlock(getBanners);
  const categories = useBlock(getFeaturedCategories);
  const featured = useBlock(getFeaturedProducts);
  const bestSellers = useBlock(getBestSellers);
  const newest = useBlock(getNewestProducts);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Re-observe các phần tử reveal render sau khi data về
  const loadedCount = [banners, categories, featured, bestSellers, newest]
    .filter((b) => b.status !== 'loading').length;
  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.revealed)');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
      }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedCount]);

  const navigate = useNavigate();
  const cartCount = useCartCount();
  const [quickView, setQuickView] = useState(null);
  const goProduct = (p) => navigate(`/san-pham/${p.slug}`);
  const goCategory = (c) => navigate(`/danh-muc/${c.slug}`);
  const goMore = () => navigate('/danh-muc/all');
  const quickAddToCart = (p, v, q) => {
    addToCart({
      variantId: v.id, productId: p.id, productName: p.name, color: v.color,
      colorHex: v.colorHex, price: variantPrice(v), // giá flash nếu variant đang áp (flash-sale.md §6)
      image: v.images?.[0]?.url || p.images?.[0]?.url, stock: v.stock, qty: q,
      flashSaleProgramId: activeFlash(v)?.programId,
    });
    onToast?.(`Đã thêm ${q} × ${p.name} (${v.color}) vào giỏ hàng.`);
    setQuickView(null);
  };

  // Khối Flash sale (flash-sale.md §6): tự tải riêng, lỗi/không có chương trình -> ẨN khối.
  const [flash, setFlash] = useState({ status: 'loading', program: null });
  const loadFlash = async () => {
    try {
      const { program } = await getCurrentFlashSale();
      setFlash({ status: 'ready', program });
    } catch {
      setFlash({ status: 'error', program: null });
    }
  };
  useEffect(() => { loadFlash(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const flashProgram = flash.program;
  const showFlash =
    flash.status === 'ready' &&
    flashProgram &&
    (flashProgram.status === 'RUNNING' || flashProgram.status === 'UPCOMING') &&
    flashProgram.items.length > 0;

  return (
    <div ref={rootRef}>
      <Header
        cartCount={cartCount}
        darkMode={darkMode}
        onToggleDark={onToggleDark}
        onToast={onToast}
      />

      <main className="container">
        {banners.status === 'loading' && <div style={{ marginTop: 24 }}><SkeletonBanner /></div>}
        {banners.status === 'success' && banners.data.length > 0 && (
          <HeroCarousel banners={banners.data} />
        )}
        {/* empty/error banner => ẩn khối, không vỡ layout (§5) */}
      </main>

      <section className="section reveal">
        <div className="container">
          <SectionHeader title="Danh mục nổi bật" />
          {categories.status === 'loading' && (
            <div className="cat-grid">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <SkeletonCircle key={i} size={120} />)}
            </div>
          )}
          {categories.status === 'error' && (
            <div className="inline-error">
              <p>⚠️ Không tải được danh mục.</p>
              <Button variant="secondary" size="sm" onClick={categories.retry}>Thử lại</Button>
            </div>
          )}
          {categories.status === 'success' && (
            <CategoryGrid categories={categories.data} onSelect={goCategory} />
          )}
        </div>
      </section>

      {showFlash && (
        <section className="section fs-home reveal">
          <div className="container">
            <SectionHeader
              title="Flash sale"
              onMore={() => navigate('/flash-sale')}
              extra={
                <span className="fs-home-chip">
                  <span className="fs-home-chip__bolt" aria-hidden="true">⚡</span>
                  <CountdownTimer
                    compact
                    targetAt={flashProgram.status === 'RUNNING' ? flashProgram.endAt : flashProgram.startAt}
                    serverNow={flashProgram.serverNow}
                    onExpire={loadFlash}
                  />
                </span>
              }
            />
            <div className="product-grid fs-home-grid">
              {flashProgram.items.slice(0, 4).map((item) => (
                <FlashSaleCard
                  key={item.productId}
                  item={item}
                  status={flashProgram.status}
                  programId={flashProgram.id}
                  onSelect={(it) => navigate(`/san-pham/${it.slug}`)}
                  onQuickView={(it) => {
                    const detail = featured.data.find((p) => p.id === it.productId)
                      || bestSellers.data.find((p) => p.id === it.productId)
                      || newest.data.find((p) => p.id === it.productId);
                    if (detail) setQuickView(detail);
                    else navigate(`/san-pham/${it.slug}`);
                  }}
                  onToast={onToast}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <ProductBlock title="Sản phẩm nổi bật" block={featured} onSelect={goProduct} onQuickView={setQuickView} onMore={() => goMore('Sản phẩm nổi bật')} onToast={onToast} />
      <ProductBlock title="Bán chạy nhất" block={bestSellers} onSelect={goProduct} onQuickView={setQuickView} onMore={() => goMore('Bán chạy nhất')} onToast={onToast} />
      <ProductBlock title="Mới nhất" block={newest} onSelect={goProduct} onQuickView={setQuickView} onMore={() => goMore('Mới nhất')} onToast={onToast} />

      <Footer onToast={onToast} />

      {quickView && (
        <QuickViewModal
          product={quickView}
          onClose={() => setQuickView(null)}
          onAddToCart={quickAddToCart}
          onToast={onToast}
        />
      )}

      <button
        className={`back-to-top${showTop ? ' show' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Về đầu trang"
      >
        ↑
      </button>
    </div>
  );
}
