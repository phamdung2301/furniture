import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Button from '../components/Button';
import ProductCard from '../components/ProductCard';
import FlashSaleCard from '../components/FlashSaleCard';
import CountdownTimer from '../components/CountdownTimer';
import QuickViewModal from '../components/QuickViewModal';
import { SkeletonCard, SkeletonBanner } from '../components/Skeleton';
import { getCurrentFlashSale } from '../api/flashSaleApi';
import { getBestSellers } from '../api/homeApi';
import { getProduct } from '../api/productApi';
import { useCartCount } from '../hooks/useCartCount';
import { addToCart } from '../utils/cart';
import { formatDateTime, variantPrice, activeFlash } from '../utils/format';

/**
 * Trang Flash sale — FR-028 / F-022 / US-018 (spec flash-sale.md).
 * Route /flash-sale. 3 trạng thái chương trình: đang diễn ra / sắp diễn ra /
 * đã kết thúc (empty + gợi ý bán chạy). Countdown về 0 -> refetch, không reload.
 * Giá flash do backend trả — trang này không tự tính %.
 */
export default function FlashSalePage({ darkMode, onToggleDark, onToast }) {
  const navigate = useNavigate();
  const cartCount = useCartCount();
  const [state, setState] = useState({ status: 'loading', program: null });
  const [suggestions, setSuggestions] = useState([]);
  const [quickView, setQuickView] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(async () => {
    try {
      const { program } = await getCurrentFlashSale();
      if (!program || program.status === 'ENDED') {
        setState({ status: 'empty', program: null });
      } else {
        setState({ status: 'ready', program });
      }
    } catch {
      // Lỗi khi refetch nền (đang có dữ liệu) -> giữ nguyên, chỉ báo khi tải lần đầu.
      if (stateRef.current.status === 'loading') {
        setState({ status: 'error', program: null });
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Đang diễn ra: refetch nhẹ mỗi 60s để bắt thay đổi suất (§8.1).
  const programStatus = state.program?.status;
  useEffect(() => {
    if (programStatus !== 'RUNNING') return;
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [programStatus, load]);

  // Empty state: gợi ý bán chạy (tái dùng API trang chủ — §7.2).
  useEffect(() => {
    if (state.status !== 'empty') return;
    let alive = true;
    getBestSellers()
      .then((d) => {
        if (alive) setSuggestions((d.content || d || []).slice(0, 4));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [state.status]);

  const goProductBySlug = (slug) => navigate(`/san-pham/${slug}`);
  const openQuickView = async (item) => {
    try {
      const detail = await getProduct(item.slug);
      setQuickView(detail);
    } catch {
      onToast?.('Không tải được sản phẩm, bạn thử lại nhé.');
    }
  };
  const quickAddToCart = (p, v, q) => {
    addToCart({
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      color: v.color,
      colorHex: v.colorHex,
      price: variantPrice(v),
      image: v.images?.[0]?.url || p.images?.[0]?.url,
      stock: v.stock,
      qty: q,
      flashSaleProgramId: activeFlash(v)?.programId,
    });
    onToast?.(`Đã thêm ${q} × ${p.name} (${v.color}) vào giỏ hàng.`);
    setQuickView(null);
  };

  const { program } = state;
  const running = program?.status === 'RUNNING';
  const upcoming = program?.status === 'UPCOMING';
  const usedPct =
    program && program.totalUsageLimit > 0
      ? Math.round((program.usedCount / program.totalUsageLimit) * 100)
      : 0;
  const lowProgramQuota =
    program && program.totalUsageLimit > 0 &&
    program.totalUsageLimit - program.usedCount <= program.totalUsageLimit * 0.1;

  return (
    <div>
      <Header cartCount={cartCount} darkMode={darkMode} onToggleDark={onToggleDark} onToast={onToast} />
      <main className="container fs-page">
        <nav className="pd-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Flash sale</span>
        </nav>

        {state.status === 'loading' && (
          <>
            <div style={{ marginTop: 8 }}>
              <SkeletonBanner />
            </div>
            <div className="product-grid" style={{ marginTop: 24 }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </>
        )}

        {state.status === 'error' && (
          <div className="inline-error" style={{ marginTop: 24 }}>
            <p>⚠️ Không tải được chương trình flash sale. Kiểm tra mạng rồi thử lại nhé.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setState({ status: 'loading', program: null });
                load();
              }}
            >
              Thử lại
            </Button>
          </div>
        )}

        {state.status === 'ready' && program && (
          <>
            <section className="fs-banner">
              <div className="fs-banner__top">
                <span className="fs-banner__icon" aria-hidden="true">⚡</span>
                <h1 className="fs-banner__title">Flash sale</h1>
                {running && <span className="fs-badge fs-badge--running">ĐANG DIỄN RA</span>}
                {upcoming && <span className="fs-badge fs-badge--upcoming">SẮP DIỄN RA</span>}
              </div>
              <div className="fs-banner__mid">
                <div className="fs-banner__info">
                  <p className="fs-banner__range">
                    Diễn ra từ {formatDateTime(program.startAt)} đến {formatDateTime(program.endAt)}
                  </p>
                  <p className="fs-banner__sub">
                    {running
                      ? 'Nhanh tay kẻo hết — số lượng có hạn.'
                      : `Chương trình bắt đầu lúc ${formatDateTime(program.startAt)}.`}
                  </p>
                </div>
                <div className="fs-banner__count">
                  <span className="fs-banner__countlabel">
                    {running ? 'Kết thúc sau' : 'Bắt đầu sau'}
                  </span>
                  <CountdownTimer
                    targetAt={running ? program.endAt : program.startAt}
                    serverNow={program.serverNow}
                    onExpire={load}
                  />
                </div>
              </div>
              {running && (
                <div className="fs-banner__progress">
                  <div
                    className="fs-program-progress"
                    role="progressbar"
                    aria-valuenow={program.usedCount}
                    aria-valuemin={0}
                    aria-valuemax={program.totalUsageLimit}
                    aria-label={`Đã bán ${program.usedCount}/${program.totalUsageLimit} suất`}
                  >
                    <div
                      className={`fs-program-progress__fill${lowProgramQuota ? ' is-low' : ''}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                  <span className="fs-banner__progresstext">
                    Đã bán {program.usedCount}/{program.totalUsageLimit} suất · {usedPct}%
                    {lowProgramQuota ? ' — sắp hết suất!' : ''}
                  </span>
                </div>
              )}
            </section>

            {running && (
              <p className="fs-note">
                Giá flash sale áp dụng khi thêm vào giỏ trong thời gian chương trình. Không áp
                dụng cùng mã giảm giá khác.
              </p>
            )}
            {upcoming && (
              <p className="fs-note">
                Giá hiển thị là giá flash sale dự kiến, áp dụng khi chương trình bắt đầu.
              </p>
            )}

            <div className="product-grid fs-grid">
              {program.items.map((item) => (
                <FlashSaleCard
                  key={item.productId}
                  item={item}
                  status={program.status}
                  programId={program.id}
                  onSelect={(it) => goProductBySlug(it.slug)}
                  onQuickView={openQuickView}
                  onToast={onToast}
                />
              ))}
            </div>
          </>
        )}

        {state.status === 'empty' && (
          <>
            <section className="fs-empty">
              <span className="fs-empty__icon" aria-hidden="true">⚡</span>
              <h2>Chương trình đã kết thúc</h2>
              <p>
                Đợt flash sale này đã khép lại. Xem thêm nhiều ưu đãi khác đang chờ bạn nhé.
              </p>
              <Button variant="primary" onClick={() => navigate('/')}>
                Khám phá sản phẩm
              </Button>
            </section>
            {suggestions.length > 0 && (
              <section className="section">
                <div className="section-head">
                  <h2>Gợi ý cho bạn</h2>
                  <button className="btn btn-text" onClick={() => navigate('/danh-muc/all')}>
                    Xem tất cả →
                  </button>
                </div>
                <div className="product-grid">
                  {suggestions.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onSelect={(prod) => goProductBySlug(prod.slug)}
                      onQuickView={async (prod) => {
                        try {
                          setQuickView(await getProduct(prod.slug));
                        } catch {
                          onToast?.('Không tải được sản phẩm, bạn thử lại nhé.');
                        }
                      }}
                      onToast={onToast}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Footer onToast={onToast} />

      {quickView && (
        <QuickViewModal
          product={quickView}
          onClose={() => setQuickView(null)}
          onAddToCart={quickAddToCart}
          onToast={onToast}
        />
      )}
    </div>
  );
}
