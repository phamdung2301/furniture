import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ColorSelector from './ColorSelector';
import Button from './Button';
import Badge from './Badge';
import { formatVND, renderStars, activeFlash, formatTimeDay } from '../utils/format';
import { defaultVariant, colorSlug } from '../api/productApi';
import { useWishlist } from '../hooks/useWishlist';

/**
 * Quick view modal — §6 spec. Dùng chung cho homepage/category/search.
 * Desktop: modal 2 cột · Mobile: bottom-sheet. Đóng: ×, click ngoài, Esc.
 * KHÔNG có tabs mô tả/thông số/review ở đây.
 * Nút tim dùng useWishlist thật (FR-018) — không còn phụ thuộc props giả.
 */
export default function QuickViewModal({ product, onClose, onAddToCart, onToast }) {
  const navigate = useNavigate();
  const [variant, setVariant] = useState(() => defaultVariant(product));
  const { wished, toggle } = useWishlist(product?.id, product, onToast);

  useEffect(() => {
    setVariant(defaultVariant(product));
  }, [product]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!product) return null;
  const image = variant?.images?.[0]?.url || product.images?.[0]?.url;
  const out = !variant || variant.stock === 0;
  // Flash sale của màu đang chọn (flash-sale.md §5.3): đang áp -> giá flash;
  // sắp diễn ra -> ghi chú thời gian. Giá do backend trả trong variant.flashSale.
  const flash = variant ? activeFlash(variant) : null;
  const flashUpcoming = variant?.flashSale?.upcoming ? variant.flashSale : null;

  const goDetail = () => {
    onClose?.();
    navigate(`/san-pham/${product.slug}${variant ? `?mau=${colorSlug(variant.color)}` : ''}`);
  };

  return (
    <div className="qv-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Xem nhanh ${product.name}`}>
      <div className="qv-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="qv-modal__close" onClick={onClose} aria-label="Đóng">
          ×
        </button>
        <div className="qv-modal__img">
          {image ? (
            <img src={image} alt={product.name} />
          ) : (
            <div className="qv-modal__placeholder" aria-hidden="true">🪑</div>
          )}
        </div>
        <div className="qv-modal__info">
          <h3 className="qv-modal__name">{product.name}</h3>
          <div className="qv-modal__rating">
            <span className="stars" aria-hidden="true">{renderStars(product.ratingAvg)}</span>
            <span className="rating-count">
              {product.ratingAvg.toFixed(1)} ({product.ratingCount})
            </span>
          </div>
          {flash ? (
            <div className="qv-modal__price qv-modal__price--flash">
              {formatVND(flash.flashPrice)}
              <Badge type="sale" label={`-${flash.discountPercent}%`} />
              <s className="qv-modal__price-old">{formatVND(variant.price)}</s>
            </div>
          ) : (
            <div className="qv-modal__price">
              {variant ? formatVND(variant.price) : 'Liên hệ'}
            </div>
          )}
          {flashUpcoming && (
            <p className="qv-modal__flash-note">
              ⚡ Sắp flash sale từ {formatTimeDay(flashUpcoming.startAt)}
            </p>
          )}
          <div className="qv-modal__colors">
            <span className="qv-modal__label">Màu sắc: <strong>{variant?.color}</strong></span>
            <ColorSelector
              variants={product.variants || []}
              selectedId={variant?.id}
              onSelect={setVariant}
              size={24}
            />
          </div>
          {out && <p className="qv-modal__out">Màu này đã hết hàng — bạn chọn màu khác nhé.</p>}
          <div className="qv-modal__actions">
            <Button variant="primary" onClick={goDetail}>
              Xem chi tiết
            </Button>
            <Button
              variant="secondary"
              disabled={out}
              onClick={() => onAddToCart?.(product, variant, 1)}
            >
              Thêm vào giỏ
            </Button>
            <button
              type="button"
              className={`qv-modal__wish${wished ? ' active' : ''}`}
              onClick={toggle}
              aria-label={wished ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
              aria-pressed={wished}
              title={wished ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
            >
              ♥
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
