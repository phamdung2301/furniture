import { useState } from 'react';
import Badge from './Badge';
import { formatVND, renderStars, getCardInfo } from '../utils/format';
import { defaultVariant } from '../api/productApi';
import { useWishlist } from '../hooks/useWishlist';
import { highlightParts } from '../utils/search';

/** Product Card — §3 spec: ảnh 4/3, badge, tên, sao, "Giá từ", chấm màu, overlay hết hàng.
 *  Prop highlightQuery (optional): bọc từ khóa khớp trong tên bằng <mark> (§2.2 spec tim-kiem).
 *  Prop onToast (optional): toast cho nút tim.
 *  Prop priceAtSave (optional, trang /yeu-thich): nếu giá hiện tại < priceAtSave
 *    -> Badge "Đã giảm giá" + dòng "Đã giảm từ ...".
 *  Prop onWishToggle (optional): nếu truyền, nút tim gọi hàm này thay vì toggle
 *    nội bộ (trang /yeu-thich cần fade-out + rollback riêng). */
function ProductName({ name, highlightQuery }) {
  if (!highlightQuery || !highlightQuery.trim()) return <>{name}</>;
  const parts = highlightParts(name, highlightQuery);
  return (
    <>
      {parts.map((part, i) =>
        part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>
      )}
    </>
  );
}

export default function ProductCard({
  product,
  onSelect,
  onQuickView,
  highlightQuery,
  onToast,
  priceAtSave,
  onWishToggle,
}) {
  const info = getCardInfo(product);
  const { wished, toggle } = useWishlist(product?.id, product, onToast);
  const [popKey, setPopKey] = useState(0);

  const currentPrice = defaultVariant(product)?.price ?? info.price;
  const showDiscount =
    Number.isFinite(priceAtSave) && priceAtSave > 0 && currentPrice < priceAtSave;
  const inactive = product?.active === false;

  const handleQuickView = (e) => {
    e.stopPropagation();
    onQuickView?.(product);
  };

  const handleWish = (e) => {
    e.stopPropagation();
    setPopKey((k) => k + 1); // chạy lại animation pop
    if (onWishToggle) onWishToggle(product);
    else toggle();
  };

  return (
    <article
      className="product-card"
      onClick={() => onSelect?.(product)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.(product)}
      tabIndex={0}
      aria-label={product.name}
    >
      <div className={`product-card__imgwrap${inactive ? ' is-inactive' : ''}`}>
        {(info.badge || showDiscount) && (
          <span className="product-card__badge">
            {info.badge && <Badge type={info.badge.type} label={info.badge.label} />}
            {showDiscount && <Badge type="sale" label="Đã giảm giá" />}
          </span>
        )}
        {info.image ? (
          <img src={info.image} alt={product.name} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%' }} aria-hidden="true" />
        )}
        {inactive ? (
          <div className="product-card__inactive" aria-hidden="true">
            <span>Ngừng kinh doanh</span>
          </div>
        ) : (
          info.outOfStock && <div className="product-card__outstock">Hết hàng</div>
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
        {onQuickView && !info.outOfStock && !inactive && (
          <button
            type="button"
            className="product-card__quickview"
            onClick={handleQuickView}
            aria-label={`Xem nhanh ${product.name}`}
          >
            Xem nhanh
          </button>
        )}
      </div>
      <div className="product-card__body">
        <h3 className="product-card__name">
          <ProductName name={info.name} highlightQuery={highlightQuery} />
        </h3>
        <div className="product-card__rating">
          <span className="stars" aria-hidden="true">
            {renderStars(info.ratingAvg)}
          </span>
          <span className="rating-count">
            {info.ratingAvg.toFixed(1)} ({info.ratingCount})
          </span>
        </div>
        {info.showFrom && <div className="product-card__from">Giá từ</div>}
        <div className="product-card__price">{formatVND(info.price)}</div>
        {showDiscount && (
          <div className="product-card__discount">
            Đã giảm từ <s>{formatVND(priceAtSave)}</s>
          </div>
        )}
        {info.colors.length > 0 && (
          <div className="product-card__colors" aria-label="Các màu có sẵn">
            {info.colors.map((c) => (
              <span
                key={c.id}
                className={`color-dot${c.stock === 0 ? ' dim' : ''}`}
                style={{ backgroundColor: c.colorHex }}
                title={c.color}
              />
            ))}
            {info.extraColors > 0 && (
              <span className="color-more">+{info.extraColors} màu</span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
