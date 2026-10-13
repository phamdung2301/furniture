import { useCallback, useEffect, useRef, useState } from 'react';
import Button from './Button';

/**
 * Hero banner carousel — §2.4 spec.
 * Autoplay 5s, pause khi hover/focus/touch; dots, prev/next, vuốt, phím ←/→.
 */
const AUTOPLAY_MS = 5000;

export default function HeroCarousel({ banners }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const count = banners.length;

  const go = useCallback(
    (next) => setIndex(((next % count) + count) % count),
    [count]
  );

  useEffect(() => {
    if (paused || count <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, count]);

  if (count === 0) return null;

  return (
    <div
      className="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? 0);
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        setPaused(false);
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Banner nổi bật"
    >
      <div
        className="hero__track"
        style={{ transform: `translateX(-${index * 100}%)` }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(index - 1);
          if (e.key === 'ArrowRight') go(index + 1);
        }}
        tabIndex={0}
      >
        {banners.map((b, i) => (
          <div
            key={b.id}
            className="hero__slide"
            aria-hidden={i !== index}
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
          >
            <img src={b.imageUrl} alt="" aria-hidden="true" />
            <div className="hero__overlay" />
            <div className="hero__text">
              <h2>{b.title}</h2>
              <p>{b.subtitle}</p>
              <Button
                variant="primary"
                onClick={() => (window.location.hash = b.linkUrl)}
                tabIndex={i === index ? 0 : -1}
              >
                {b.ctaText}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            className="hero__arrow hero__arrow--prev"
            onClick={() => go(index - 1)}
            aria-label="Banner trước"
          >
            ‹
          </button>
          <button
            className="hero__arrow hero__arrow--next"
            onClick={() => go(index + 1)}
            aria-label="Banner tiếp theo"
          >
            ›
          </button>
          <div className="hero__dots" role="tablist" aria-label="Chọn banner">
            {banners.map((b, i) => (
              <button
                key={b.id}
                role="tab"
                aria-selected={i === index}
                aria-label={`Banner ${i + 1}`}
                className={`hero__dot${i === index ? ' hero__dot--active' : ''}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
