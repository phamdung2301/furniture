import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QtySelector from './QtySelector';
import { formatVND } from '../utils/format';

/**
 * 1 dòng hàng trong giỏ — §2 spec (F-005, FR-007): mỗi dòng = 1 biến thể (màu).
 * Props:
 *   item         — { variantId, productName, color, colorHex, price, image, stock, qty }
 *   productSlug  — slug để link tới trang chi tiết (optional; không có → không link)
 *   newPrice     — giá hiện tại khác giá lúc thêm (optional; hiện dải cảnh báo vàng)
 *   onQtyChange(variantId, qty)
 *   onRemove(variantId)
 *   onUpdatePrice(variantId, newPrice)
 */
export default function CartLineItem({
  item,
  productSlug,
  newPrice = null,
  onQtyChange,
  onRemove,
  onUpdatePrice,
}) {
  const [maxTip, setMaxTip] = useState(false);
  const tipTimer = useRef(null);

  useEffect(() => () => clearTimeout(tipTimer.current), []);

  const maxQty = Math.max(1, Math.min(99, item.stock || 1));

  const handleMaxAttempt = () => {
    setMaxTip(true);
    clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setMaxTip(false), 2500);
  };

  const imageEl = (
    <img src={item.image} alt={item.productName} className="cart-line__img" loading="lazy" />
  );
  const nameEl = <span className="cart-line__name">{item.productName}</span>;

  return (
    <article className="cart-line">
      <div className="cart-line__media">
        {productSlug ? <Link to={`/san-pham/${productSlug}`}>{imageEl}</Link> : imageEl}
      </div>

      <div className="cart-line__info">
        {productSlug ? (
          <Link to={`/san-pham/${productSlug}`} className="cart-line__title">
            {nameEl}
          </Link>
        ) : (
          <span className="cart-line__title">{nameEl}</span>
        )}
        <div className="cart-line__color">
          <span
            className="cart-line__dot"
            style={{ backgroundColor: item.colorHex || 'transparent' }}
            aria-hidden="true"
          />
          <span>Màu: {item.color}</span>
        </div>
        <div className="cart-line__unitprice">
          {formatVND(item.price)}
          {item.flashSaleProgramId && <span className="cart-line__flash">⚡ Flash sale</span>}
        </div>
        {newPrice != null && newPrice !== item.price && (
          <div className="cart-line__pricealert" role="alert">
            <span>
              ⚠ Giá đã thay đổi: {formatVND(item.price)} → {formatVND(newPrice)}
            </span>
            <button
              type="button"
              className="cart-line__priceupdate"
              onClick={() => onUpdatePrice?.(item.variantId, newPrice)}
            >
              Cập nhật giá
            </button>
          </div>
        )}
      </div>

      <div className="cart-line__qty">
        <div className="cart-line__stepperwrap">
          {maxTip && (
            <span className="cart-line__maxtip" role="status">
              Chỉ còn {item.stock} sản phẩm
            </span>
          )}
          <QtySelector
            qty={item.qty}
            max={maxQty}
            onChange={(q) => onQtyChange?.(item.variantId, q)}
            onMaxAttempt={handleMaxAttempt}
          />
        </div>
      </div>

      <div className="cart-line__total">{formatVND(item.price * item.qty)}</div>

      <button
        type="button"
        className="cart-line__remove"
        onClick={() => onRemove?.(item.variantId)}
        aria-label={`Xóa ${item.productName} khỏi giỏ hàng`}
        title="Xóa khỏi giỏ hàng"
      >
        <span aria-hidden="true">🗑️</span>
      </button>
    </article>
  );
}
