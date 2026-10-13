import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Button from '../components/Button';
import ProductCard from '../components/ProductCard';
import ProductGallery from '../components/ProductGallery';
import ColorSelector from '../components/ColorSelector';
import QtySelector from '../components/QtySelector';
import ProductTabs from '../components/ProductTabs';
import ReviewSummary from '../components/ReviewSummary';
import ReviewCard from '../components/ReviewCard';
import ReviewFormModal from '../components/ReviewFormModal';
import QuickViewModal from '../components/QuickViewModal';
import Badge from '../components/Badge';
import CountdownTimer from '../components/CountdownTimer';
import { SkeletonCard } from '../components/Skeleton';
import Pagination from '../components/Pagination';
import {
  getProduct,
  getProductReviews,
  defaultVariant,
  colorSlug,
  REVIEW_PAGE_SIZE,
} from '../api/productApi';
import { getBestSellers } from '../api/homeApi';
import { getEligibility, deleteReview } from '../api/reviewApi';
import {
  formatVND,
  renderStars,
  activeFlash,
  variantPrice,
  formatTimeDay,
} from '../utils/format';
import { addToCart } from '../utils/cart';
import { useCartCount } from '../hooks/useCartCount';
import { useWishlist } from '../hooks/useWishlist';
import '../product.css';

/**
 * Trang Chi tiết sản phẩm — FR-005, FR-006, F-004, F-012, US-004.
 * Route /san-pham/:slug · deep-link màu ?mau=<colorSlug>.
 */
export default function ProductDetailPage({ darkMode, onToggleDark, onToast }) {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const cartCount = useCartCount();
  const { wished, toggle: toggleWish } = useWishlist(product?.id, product, onToast);

  const [state, setState] = useState('loading'); // loading | ready | notfound | error
  const [product, setProduct] = useState(null);
  const [variant, setVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState('desc');
  const [reviews, setReviews] = useState({ content: [], totalPages: 1, page: 1 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [quickView, setQuickView] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showStickyBar, setShowStickyBar] = useState(false);
  /* ---------- đánh giá: eligibility F-012 + modal viết/sửa ---------- */
  const [eligibility, setEligibility] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'new' | 'edit', review? }
  const [tipNonce, setTipNonce] = useState(0); // deep-link ?review=open không đủ điều kiện → hiện tooltip lý do
  const deepLinkHandled = useRef(false);

  const tabsRef = useRef(null);
  const ctaRef = useRef(null);

  /* ---------- tải sản phẩm ---------- */
  useEffect(() => {
    let alive = true;
    setState('loading');
    setProduct(null);
    setVariant(null);
    setQty(1);
    setActiveTab('desc');
    setEligibility(null);
    setModal(null);
    deepLinkHandled.current = false;
    getProduct(slug)
      .then((data) => {
        if (!alive) return;
        setProduct(data);
        const mauParam = searchParams.get('mau');
        const fromUrl = mauParam
          ? (data.variants || []).find((v) => colorSlug(v.color) === mauParam)
          : null;
        setVariant(fromUrl || defaultVariant(data));
        setState('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setState(e?.status === 404 ? 'notfound' : 'error');
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /* ---------- tải đánh giá ---------- */
  const loadReviews = useCallback(
    (page) => {
      setReviewsLoading(true);
      getProductReviews(slug, page, REVIEW_PAGE_SIZE)
        .then((data) => setReviews(data))
        .catch(() => onToast?.('Không tải được đánh giá, bạn thử lại sau nhé.'))
        .finally(() => setReviewsLoading(false));
    },
    [slug, onToast]
  );

  useEffect(() => {
    if (state === 'ready') loadReviews(1);
  }, [state, loadReviews]);

  /* ---------- eligibility F-012 (§2 spec viet-danh-gia) ---------- */
  useEffect(() => {
    if (state !== 'ready') return;
    let alive = true;
    getEligibility(slug)
      .then((e) => {
        if (alive) setEligibility(e);
      })
      .catch(() => {
        if (alive) {
          setEligibility({
            canReview: false,
            hasReviewed: false,
            reason: 'NOT_PURCHASED',
            purchasedColors: [],
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [state, slug]);

  /* ---------- sticky bar mobile: hiện khi scroll qua khối CTA ---------- */
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [state]);

  /* ---------- đổi màu ---------- */
  const selectVariant = (v) => {
    if (!v || v.stock === 0) return;
    setVariant(v);
    setQty((q) => Math.min(q, Math.max(1, v.stock)));
    const next = new URLSearchParams(searchParams);
    next.set('mau', colorSlug(v.color));
    setSearchParams(next, { replace: true });
  };

  const galleryImages = useMemo(() => {
    if (!product) return [];
    return variant?.images?.length > 0 ? variant.images : product.images || [];
  }, [product, variant]);

  const stockInfo = useMemo(() => {
    if (!variant) return null;
    if (variant.stock === 0) return { level: 'out', text: 'Hết hàng' };
    if (variant.stock <= (variant.lowStockThreshold || 5))
      return { level: 'low', text: `Chỉ còn ${variant.stock} sản phẩm` };
    return { level: 'in', text: 'Còn hàng' };
  }, [variant]);

  const outOfStock = !variant || variant.stock === 0;

  const handleAddToCart = useCallback(
    (p = product, v = variant, q = qty) => {
      if (!p || !v || v.stock === 0) return;
      addToCart({
        variantId: v.id,
        productId: p.id,
        productName: p.name,
        color: v.color,
        colorHex: v.colorHex,
        price: variantPrice(v), // giá flash nếu màu đang áp (flash-sale.md §5.3)
        flashSaleProgramId: activeFlash(v)?.programId,
        image: v.images?.[0]?.url || p.images?.[0]?.url,
        stock: v.stock,
        qty: q,
      });
      onToast?.(`Đã thêm ${q} × ${p.name} (${v.color}) vào giỏ hàng.`);
    },
    [product, variant, qty, onToast]
  );

  const handleBuyNow = () => {
    handleAddToCart();
    onToast?.('Đã thêm vào giỏ — bạn tiếp tục đặt hàng ở màn tiếp theo nhé.');
  };

  /* ---------- summary optimistic sau viết/sửa/xóa (§5 spec) ---------- */
  const distToCounts = (summary) => {
    const total = summary?.total || 0;
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    [5, 4, 3, 2, 1].forEach((s) => {
      counts[s] =
        total > 0 ? Math.round(((summary?.distribution?.[s] || 0) / 100) * total) : 0;
    });
    return counts;
  };

  const countsToSummary = (counts, total, average) => {
    const distribution = {};
    [5, 4, 3, 2, 1].forEach((s) => {
      distribution[s] = total > 0 ? Math.round(((counts[s] || 0) / total) * 100) : 0;
    });
    return { average, total, distribution };
  };

  /** Viết mới: avg=(avg*total+rating)/(total+1), total+1, phân bố cập nhật. */
  const summaryAfterAdd = (summary, rating) => {
    const total = (summary?.total || 0) + 1;
    const average = (((summary?.average || 0) * (total - 1)) + rating) / total;
    const counts = distToCounts(summary);
    counts[rating] = (counts[rating] || 0) + 1;
    return countsToSummary(counts, total, average);
  };

  /** Sửa: avg=(avg*total-oldRating+newRating)/total, total giữ nguyên. */
  const summaryAfterEdit = (summary, oldRating, newRating) => {
    const total = summary?.total || 0;
    const average = total > 0
      ? (((summary?.average || 0) * total) - oldRating + newRating) / total
      : 0;
    const counts = distToCounts(summary);
    if (counts[oldRating] > 0) counts[oldRating] -= 1;
    counts[newRating] = (counts[newRating] || 0) + 1;
    return countsToSummary(counts, total, average);
  };

  /** Xóa: avg=(avg*total-rating)/(total-1), total-1. */
  const summaryAfterRemove = (summary, rating) => {
    const total = Math.max(0, (summary?.total || 0) - 1);
    const average = total > 0
      ? (((summary?.average || 0) * (total + 1)) - rating) / total
      : 0;
    const counts = distToCounts(summary);
    if (counts[rating] > 0) counts[rating] -= 1;
    return countsToSummary(counts, total, average);
  };

  /* ---------- mở modal viết/sửa ---------- */
  const handleOpenModal = (mode) => {
    if (mode === 'edit') {
      openEditModal();
    } else {
      setModal({ mode: 'new', review: null });
    }
  };

  const openEditModal = () => {
    const id = eligibility?.reviewId;
    const found = id ? reviews.content.find((r) => r.id === id) : null;
    if (found) {
      setModal({ mode: 'edit', review: found });
      return;
    }
    // Bài của user có thể nằm ở trang khác → tải thêm rồi tìm.
    getProductReviews(slug, 1, 50)
      .then((d) => {
        const mine = (d.content || []).find((r) => r.id === id);
        if (mine) setModal({ mode: 'edit', review: mine });
        else onToast?.('Không tìm thấy bài đánh giá của bạn, bạn thử lại nhé.');
      })
      .catch(() => onToast?.('Không tải được đánh giá của bạn, bạn thử lại nhé.'));
  };

  /* ---------- sau khi gửi thành công ---------- */
  const handleReviewSuccess = (review, summary, mode) => {
    if (mode === 'edit') {
      const old = reviews.content.find((r) => r.id === review.id);
      setReviews((prev) => ({
        ...prev,
        content: prev.content.map((r) => (r.id === review.id ? review : r)),
      }));
      setProduct((p) =>
        p && old
          ? { ...p, reviewSummary: summaryAfterEdit(p.reviewSummary, old.rating, review.rating) }
          : p
      );
      onToast?.('Đã lưu thay đổi.');
    } else {
      setReviews((prev) => ({
        ...prev,
        page: 1,
        content: [review, ...prev.content.filter((r) => r.id !== review.id)].slice(
          0,
          REVIEW_PAGE_SIZE
        ),
      }));
      setProduct((p) =>
        p ? { ...p, reviewSummary: summaryAfterAdd(p.reviewSummary, review.rating) } : p
      );
      onToast?.('Cảm ơn bạn đã chia sẻ đánh giá!');
      setEligibility((e) =>
        e
          ? {
              ...e,
              canReview: false,
              hasReviewed: true,
              reason: 'ALREADY_REVIEWED',
              reviewId: review.id,
            }
          : e
      );
    }
    setTimeout(() => setModal(null), 600); // đóng modal sau toast 600ms
  };

  /* ---------- xóa (từ modal hoặc từ ReviewCard) ---------- */
  const handleReviewDeleted = (reviewId) => {
    const doomed = reviews.content.find((r) => r.id === reviewId);
    setReviews((prev) => ({
      ...prev,
      content: prev.content.filter((r) => r.id !== reviewId),
    }));
    if (doomed) {
      setProduct((p) =>
        p ? { ...p, reviewSummary: summaryAfterRemove(p.reviewSummary, doomed.rating) } : p
      );
    }
    // Xóa xong user được đánh giá lại — eligibility quay về OK (§5).
    setEligibility((e) =>
      e
        ? {
            ...e,
            canReview: true,
            hasReviewed: false,
            reason: 'OK',
            reviewId: undefined,
            purchasedColors: e.purchasedColors?.length ? e.purchasedColors : ['Xám', 'Be'],
          }
        : e
    );
    onToast?.('Đã xóa đánh giá.');
    setModal(null);
  };

  const handleDeleteReview = async (reviewId) => {
    await deleteReview(reviewId);
    handleReviewDeleted(reviewId);
  };

  /* ---------- 409 race 2 tab: chuyển modal sang mode sửa với dữ liệu server ---------- */
  const handleConflict = (serverReview) => {
    if (serverReview) {
      setReviews((prev) => {
        const exists = prev.content.some((r) => r.id === serverReview.id);
        const content = exists
          ? prev.content.map((r) => (r.id === serverReview.id ? serverReview : r))
          : [serverReview, ...prev.content];
        return { ...prev, content };
      });
      setEligibility((e) =>
        e
          ? {
              ...e,
              canReview: false,
              hasReviewed: true,
              reason: 'ALREADY_REVIEWED',
              reviewId: serverReview.id,
            }
          : e
      );
      setModal({ mode: 'edit', review: serverReview });
      onToast?.('Bạn đã có một bài đánh giá — mình chuyển sang chế độ sửa nhé.');
    } else {
      getEligibility(slug)
        .then((e) => {
          setEligibility(e);
          if (e.hasReviewed) openEditModal();
        })
        .catch(() => onToast?.('Có lỗi xảy ra, bạn thử lại nhé.'));
    }
  };

  const goToReviews = () => {
    setActiveTab('reviews');
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ---------- deep-link ?review=open (entry từ Theo dõi đơn / sau login) ---------- */
  useEffect(() => {
    if (state !== 'ready' || !eligibility || deepLinkHandled.current) return;
    if (searchParams.get('review') !== 'open') return;
    deepLinkHandled.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('review');
    setSearchParams(next, { replace: true }); // xóa param để F5 không mở lại
    const r = eligibility.reason;
    if (r === 'OK') {
      setModal({ mode: 'new', review: null });
    } else if (r === 'ALREADY_REVIEWED') {
      openEditModal();
    } else if (r === 'NOT_LOGGED_IN') {
      navigate(`/dang-nhap?returnTo=${encodeURIComponent(`/san-pham/${slug}?review=open`)}`);
    } else {
      setTipNonce((n) => n + 1); // không đủ điều kiện → hiện tooltip lý do
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, eligibility, searchParams]);

  const goProduct = (p) => navigate(`/san-pham/${p.slug}`);

  /* ---------- render theo trạng thái ---------- */
  if (state === 'loading') {
    return (
      <div>
        <Header cartCount={cartCount} darkMode={darkMode} onToggleDark={onToggleDark} onToast={onToast} />
        <main className="container pd-loading">
          <div className="pd-buybox">
            <div className="skeleton pd-loading__gallery" />
            <div className="pd-loading__panel">
              <div className="skeleton" style={{ height: 28, width: '70%' }} />
              <div className="skeleton" style={{ height: 20, width: '40%' }} />
              <div className="skeleton" style={{ height: 36, width: '50%' }} />
              <div className="skeleton" style={{ height: 48 }} />
            </div>
          </div>
        </main>
        <Footer onToast={onToast} />
      </div>
    );
  }

  if (state === 'notfound') return <NotFoundPage cartCount={cartCount} darkMode={darkMode} onToggleDark={onToggleDark} onToast={onToast} goProduct={goProduct} />;

  if (state === 'error' || !product) {
    return (
      <div>
        <Header cartCount={cartCount} darkMode={darkMode} onToggleDark={onToggleDark} onToast={onToast} />
        <main className="container pd-error">
          <div className="pd-error__box">
            <span aria-hidden="true">⚠️</span>
            <p>Không tải được thông tin sản phẩm.</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Thử lại
            </Button>
          </div>
        </main>
        <Footer onToast={onToast} />
      </div>
    );
  }

  const summary = product.reviewSummary || { average: 0, total: 0, distribution: {} };
  const tabs = [
    {
      id: 'desc',
      label: 'Mô tả',
      content: (
        <div className="pd-desc">
          {(product.description || '').split('\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ),
    },
    {
      id: 'specs',
      label: 'Thông số kỹ thuật',
      content: (
        <table className="pd-specs">
          <tbody>
            {Object.entries(product.specs || {}).map(([k, val]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
    {
      id: 'reviews',
      label: `Đánh giá (${summary.total})`,
      content: (
        <div className="pd-reviews">
          <ReviewSummary
            summary={summary}
            eligibility={eligibility}
            slug={slug}
            onOpenModal={handleOpenModal}
            onToast={onToast}
            nudgeTip={tipNonce}
          />
          {reviewsLoading ? (
            <p className="pd-reviews__loading">Đang tải đánh giá…</p>
          ) : reviews.content.length === 0 ? (
            <p className="pd-reviews__empty">
              Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ cảm nhận!
            </p>
          ) : (
            <>
              {reviews.content.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  onEdit={(rev) => setModal({ mode: 'edit', review: rev })}
                  onDelete={handleDeleteReview}
                />
              ))}
              {reviews.totalPages > 1 && (
                <Pagination
                  page={reviews.page}
                  totalPages={reviews.totalPages}
                  onChange={(p) => {
                    loadReviews(p);
                    tabsRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Header cartCount={cartCount} darkMode={darkMode} onToggleDark={onToggleDark} onToast={onToast} />
      <main className="container pd-page">
        <nav className="pd-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/danh-muc/${product.categorySlug}`}>{product.categoryName}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <section className="pd-buybox">
          <ProductGallery
            images={galleryImages}
            badge={product.badge}
            productName={product.name}
          />
          <div className="pd-info">
            <h1 className="pd-info__name">{product.name}</h1>
            <div className="pd-info__rating">
              <span className="stars" aria-hidden="true">{renderStars(summary.average)}</span>
              <span className="pd-info__rating-num">{summary.average.toFixed(1)}</span>
              <button type="button" className="btn-text pd-info__rating-link" onClick={goToReviews}>
                ({summary.total} đánh giá)
              </button>
              <span className="pd-info__sold">Đã bán {product.soldCount || 0}</span>
            </div>
            {(() => {
              // Flash sale của màu đang chọn (flash-sale.md §5.3) — giá backend trả.
              const flash = variant ? activeFlash(variant) : null;
              const flashUpcoming = variant?.flashSale?.upcoming ? variant.flashSale : null;
              const flashSoldOut =
                variant?.flashSale && !variant.flashSale.upcoming && variant.flashSale.itemSoldOut
                  ? variant.flashSale
                  : null;
              return (
                <>
                  {flash ? (
                    <div className="pd-info__price pd-info__price--flash">
                      {formatVND(flash.flashPrice)}
                      <Badge type="sale" label={`-${flash.discountPercent}%`} />
                      <s className="pd-info__price-old">{formatVND(variant.price)}</s>
                    </div>
                  ) : (
                    <div className="pd-info__price">
                      {variant ? formatVND(variant.price) : 'Liên hệ'}
                    </div>
                  )}
                  {flash && (
                    <div className="pd-info__flash">
                      <span>⚡ Flash sale kết thúc sau</span>
                      <CountdownTimer compact targetAt={flash.endAt} />
                      {flash.itemQuota != null && (
                        <span className="pd-info__flash-progress">
                          <span
                            className="flash-progress"
                            role="progressbar"
                            aria-valuenow={flash.itemSoldCount || 0}
                            aria-valuemin={0}
                            aria-valuemax={flash.itemQuota}
                          >
                            <span
                              className="flash-progress__fill"
                              style={{
                                display: 'block',
                                height: '100%',
                                width: `${Math.min(100, Math.round(((flash.itemSoldCount || 0) / flash.itemQuota) * 100))}%`,
                              }}
                            />
                          </span>
                          <span className="pd-info__flash-progress-text">
                            Đã bán {flash.itemSoldCount || 0}/{flash.itemQuota} suất
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                  {flashUpcoming && (
                    <p className="pd-info__flash-note">
                      ⚡ Sắp flash sale từ {formatTimeDay(flashUpcoming.startAt)}
                    </p>
                  )}
                  {flashSoldOut && (
                    <p className="pd-info__flash-note">
                      ⚡ Hết hàng flash sale — giá đã về giá thường.
                    </p>
                  )}
                </>
              );
            })()}

            <div className="pd-info__colors">
              <span className="pd-info__label">
                Màu sắc: <strong>{variant?.color}</strong>
              </span>
              <ColorSelector
                variants={product.variants || []}
                selectedId={variant?.id}
                onSelect={selectVariant}
              />
            </div>

            {stockInfo && (
              <p className={`pd-info__stock ${stockInfo.level}`}>
                {stockInfo.level === 'in' ? '✓ ' : ''}{stockInfo.text}
              </p>
            )}

            <div ref={ctaRef} className="pd-info__cta">
              <QtySelector
                qty={qty}
                max={variant?.stock || 1}
                onChange={setQty}
                disabled={outOfStock}
              />
              <div className="pd-info__buttons">
                <Button
                  variant="primary"
                  disabled={outOfStock}
                  onClick={() => handleAddToCart()}
                >
                  Thêm vào giỏ hàng
                </Button>
                <Button variant="secondary" disabled={outOfStock} onClick={handleBuyNow}>
                  Mua ngay
                </Button>
                <button
                  type="button"
                  className={`pd-info__wish${wished ? ' active' : ''}`}
                  onClick={toggleWish}
                  aria-label={wished ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                  aria-pressed={wished}
                  title={wished ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                >
                  ♥
                </button>
              </div>
              {outOfStock && (
                <p className="pd-info__out-note">
                  Màu này đã hết hàng — bạn chọn màu khác nhé.
                </p>
              )}
            </div>

            <ul className="pd-info__commitments">
              <li>🚚 Miễn phí vận chuyển cho đơn từ 10.000.000đ</li>
              <li>🛡️ Bảo hành {product.specs?.['Bảo hành'] || '12 tháng'}</li>
              <li>↩️ Đổi trả trong 7 ngày</li>
            </ul>
            <div className="pd-info__meta">
              <span>Danh mục: <Link to={`/danh-muc/${product.categorySlug}`}>{product.categoryName}</Link></span>
              {product.specs?.['Chất liệu'] && <span>Chất liệu: {product.specs['Chất liệu']}</span>}
            </div>
          </div>
        </section>

        <div ref={tabsRef}>
          <ProductTabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
        </div>

        {(product.related || []).length > 0 && (
          <section className="pd-related">
            <h2 className="pd-related__title">Sản phẩm liên quan</h2>
            <div className="pd-related__grid">
              {product.related.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onSelect={goProduct}
                  onQuickView={setQuickView}
                  onToast={onToast}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {showStickyBar && !outOfStock && (
        <div className="pd-stickybar">
          <span className="pd-stickybar__price">
            {variant ? formatVND(variantPrice(variant)) : ''}
          </span>
          <Button variant="primary" size="sm" onClick={() => handleAddToCart()}>
            Thêm vào giỏ
          </Button>
        </div>
      )}

      {quickView && (
        <QuickViewModal
          product={quickView}
          onClose={() => setQuickView(null)}
          onAddToCart={(p, v, q) => {
            handleAddToCart(p, v, q);
            setQuickView(null);
          }}
          onToast={onToast}
        />
      )}

      {modal && (
        <ReviewFormModal
          key={`${modal.mode}-${modal.review?.id || 'new'}`}
          mode={modal.mode}
          product={product}
          existingReview={modal.review || undefined}
          purchasedColors={eligibility?.purchasedColors || []}
          orderId={eligibility?.orderId}
          onClose={() => setModal(null)}
          onSuccess={handleReviewSuccess}
          onDeleted={handleReviewDeleted}
          onConflict={handleConflict}
          onToast={onToast}
        />
      )}

      <Footer onToast={onToast} />
    </div>
  );
}

function NotFoundPage({ cartCount, darkMode, onToggleDark, onToast, goProduct }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    getBestSellers().then((d) => setItems((d.content || d).slice(0, 4))).catch(() => {});
  }, []);
  return (
    <div>
      <Header cartCount={cartCount} darkMode={darkMode} onToggleDark={onToggleDark} onToast={onToast} />
      <main className="container pd-notfound">
        <div className="pd-notfound__box">
          <span className="pd-notfound__icon" aria-hidden="true">🔍</span>
          <h1>Không tìm thấy sản phẩm</h1>
          <p>Sản phẩm có thể đã ngừng bán hoặc đường link không đúng.</p>
          <Link to="/" className="btn btn-primary">Về trang chủ</Link>
        </div>
        {items.length > 0 && (
          <section className="pd-related">
            <h2 className="pd-related__title">Có thể bạn thích</h2>
            <div className="pd-related__grid">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} onSelect={goProduct} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer onToast={onToast} />
    </div>
  );
}
