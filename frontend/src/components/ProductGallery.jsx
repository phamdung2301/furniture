import { useCallback, useEffect, useRef, useState } from 'react';
import Badge from './Badge';

/**
 * Gallery ảnh sản phẩm — §2 spec chi-tiet-san-pham.
 * Ảnh chính 4/3 + thumbnails; hover zoom theo cursor (desktop);
 * arrows/vuốt/phím ←/→; 1 ảnh → ẩn điều khiển.
 */
export default function ProductGallery({ images = [], badge, productName }) {
  const [index, setIndex] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const mainRef = useRef(null);
  const touchX = useRef(null);

  const list = images.length > 0 ? images : [];
  const current = list[index] || null;

  // Reset khi đổi màu (images đổi)
  useEffect(() => {
    setIndex(0);
  }, [images]);

  const go = useCallback(
    (dir) => {
      if (list.length < 2) return;
      setIndex((i) => (i + dir + list.length) % list.length);
    },
    [list.length]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const onMouseMove = (e) => {
    const rect = mainRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  };

  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  return (
    <div className="pd-gallery">
      <div
        ref={mainRef}
        className={`pd-gallery__main${zooming ? ' zooming' : ''}`}
        onMouseEnter={() => setZooming(true)}
        onMouseLeave={() => setZooming(false)}
        onMouseMove={onMouseMove}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="img"
        aria-label={productName}
      >
        {badge && (
          <span className="pd-gallery__badge">
            <Badge type={badge.type} label={badge.label} />
          </span>
        )}
        {current ? (
          <img
            key={current.url}
            src={current.url}
            alt={productName}
            style={zooming ? { transformOrigin: origin } : undefined}
            draggable={false}
          />
        ) : (
          <div className="pd-gallery__placeholder" aria-hidden="true">
            🪑
          </div>
        )}
        {list.length > 1 && (
          <>
            <button
              type="button"
              className="pd-gallery__arrow left"
              onClick={() => go(-1)}
              aria-label="Ảnh trước"
            >
              ‹
            </button>
            <button
              type="button"
              className="pd-gallery__arrow right"
              onClick={() => go(1)}
              aria-label="Ảnh tiếp"
            >
              ›
            </button>
          </>
        )}
      </div>
      {list.length > 1 && (
        <div className="pd-gallery__thumbs" role="tablist" aria-label="Ảnh thu nhỏ">
          {list.map((im, i) => (
            <button
              key={`${im.url}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`pd-gallery__thumb${i === index ? ' active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Xem ảnh ${i + 1}`}
            >
              <img src={im.url} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
