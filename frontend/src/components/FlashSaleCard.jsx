import { useState } from 'react';
import Badge from './Badge';
import { formatVND, renderStars } from '../utils/format';
import { addToCart } from '../utils/cart';
import { useWishlist } from '../hooks/useWishlist';

/**
 * Card sản phẩm flash sale — flash-sale.md §4 (mở rộng khung ProductCard §0.4).
 * Props:
 *   item       — FlashSaleProgram item (§9): đã có flashPrice/discountPercent
 *                do BACKEND tính; component này không tự nhân %.
 *   status     — 'RUNNING' | 'UPCOMING' (trạng thái chương trình)
 *   programId  — id chương trình (gắn vào dòng giỏ khi mua trực tiếp)
 *   onSelect(item)   — click card -> trang chi tiết
 *   onQuickView(item) — mở QuickView khi món có nhiều màu thuộc chương trình
 *   onToast(msg)
 * Nút "Mua ngay": đúng 1 màu thuộc chương trình còn hàng -> thêm thẳng vào giỏ;
 * nhiều màu -> mở QuickView chọn màu (§4.3).
 */
export default function FlashSaleCard({ item, status, programId, onSelect, onQuickView, onToast }) {
  const pseudoProduct = {
    id: item.productId,
    slug: item.slug,
    name: item.name,
    images: item.image ? [{ url: item.image }] : [],
    variants: [],
  };
  const { wished, toggle } = useWishlist(item.productId, pseudoProduct, onToast);
  const [popKey, setPopKey] = useState(0);

  const upcoming = status === 'UPCOMING';
  const flashColorsInStock = (item.colors || []).filter(
    (c) => (item.flashVariantIds || []).includes(c.variantId) && c.stock > 0
  );
  const buyDirect = !upcoming && !item.soldOut && flashColorsInStock.length === 1;

  const buyLabel = upcoming
    ? 'Sắp mở bán'
    : item.soldOut
      ? item.stockOut && !item.itemSoldOut
        ? 'Hết hàng'
        : 'Hết hàng flash sale'
      : 'Mua ngay';
  const buyDisabled = upcoming || item.soldOut;

  const handleBuy = (e) => {
    e.stopPropagation();
    if (buyDisabled) return;
    if (buyDirect) {
      const c = flashColorsInStock[0];
      addToCart({
        variantId: c.variantId,
        productId: item.productId,
        productName: item.name,
        color: c.color,
        colorHex: c.colorHex,
        price: item.flashPrice,
        image: item.image,
        stock: c.stock,
        qty: 1,
        flashSaleProgramId: programId,
      });
      onToast?.(`Đã thêm ${item.name} (${c.color}) vào giỏ hàng.`);
    } else {
      onQuickView?.(item);
    }
  };

  const handleWish = (e) => {
    e.stopPropagation();
    setPopKey((k) => k + 1);
    toggle();
  };

  const handleQuickView = (e) => {
    e.stopPropagation();
    onQuickView?.(item);
  };

  const quota = item.itemQuota;
  const sold = item.itemSoldCount || 0;
  const showProgress = !upcoming && quota != null && quota > 0;
  const soldPct = showProgress ? Math.min(100, Math.round((sold / quota) * 100)) : 0;
  const lowQuota = showProgress && quota - sold <= quota * 0.2;

  return (
    <article
      className="product-card flash-card"
      onClick={() => onSelect?.(item)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.(item)}
      tabIndex={0}
      aria-label={item.name}
    >
      <div className="product-card__imgwrap">
        <span className="product-card__badge">
          <Badge type="sale" label={`-${item.discountPercent}%`} />
        </span>
        {item.image ? (
          <img src={item.image} alt={item.name} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%' }} aria-hidden="true" />
        )}
        {item.soldOut && (
          <div className="product-card__outstock">
            {item.stockOut && !item.itemSoldOut ? 'Hết hàng' : 'Hết hàng flash sale'}
          </div>
        )}
        <button
          type="button"
          className={`product-card__wish${wished ? ' active' : ''}`}
          onClick={handleWish}
          aria-label={wished ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
          aria-pressed={wished}
          title={wished ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
        >
          <span key={popKey} className={popKey > 0 ? 'wish-pop' : undefined}>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill={wished ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </span>
        </button>
        {onQuickView && !item.soldOut && (
          <button
            type="button"
            className="product-card__quickview"
            onClick={handleQuickView}
            aria-label={`Xem nhanh ${item.name}`}
          >
            Xem nhanh
          </button>
        )}
      </div>

      <div className="product-card__body">
        <h3 className="product-card__name">{item.name}</h3>
        <div className="product-card__rating">
          <span className="stars" aria-hidden="true">
            {renderStars(item.ratingAvg || 0)}
          </span>
          <span className="rating-count">
            {(item.ratingAvg || 0).toFixed(1)} ({item.ratingCount || 0})
          </span>
        </div>

        <div className="flash-card__pricelabel">
          {item.hasMultipleFlashPrices ? 'Giá từ' : 'Giá flash sale'}
        </div>
        <div className="flash-card__price">{formatVND(item.flashPrice)}</div>
        <s className="flash-card__original">{formatVND(item.originalPrice)}</s>

        {(item.colors || []).length > 0 && (
          <div className="product-card__colors" aria-label="Các màu có sẵn">
            {item.colors.slice(0, 4).map((c) => (
              <span
                key={c.variantId}
                className={`color-dot${c.stock === 0 ? ' dim' : ''}`}
                style={{ backgroundColor: c.colorHex }}
                title={c.color}
              />
            ))}
            {item.colors.length > 4 && (
              <span className="color-more">+{item.colors.length - 4} màu</span>
            )}
          </div>
        )}

        {showProgress && (
          <div className="flash-card__progress">
            <div
              className="flash-progress"
              role="progressbar"
              aria-valuenow={sold}
              aria-valuemin={0}
              aria-valuemax={quota}
              aria-label={`Đã bán ${sold}/${quota} suất`}
            >
              <div
                className={`flash-progress__fill${lowQuota ? ' is-low' : ''}`}
                style={{ width: `${soldPct}%` }}
              />
            </div>
            <div className={`flash-card__sold${lowQuota ? ' is-low' : ''}`}>
              Đã bán {sold}/{quota} suất{lowQuota && !item.soldOut ? ' — sắp hết!' : ''}
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary flash-card__buy"
          disabled={buyDisabled}
          onClick={handleBuy}
        >
          {buyLabel}
        </button>
      </div>
    </article>
  );
}
