import { useRef, useState } from 'react';

/**
 * Tabs Mô tả | Thông số kỹ thuật | Đánh giá — §4 spec.
 * Header scroll ngang trên mobile; underline trượt.
 */
export default function ProductTabs({ tabs, activeId, onChange, id = 'pd-tabs' }) {
  const listRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measure = (el) => {
    if (!el || !listRef.current) return;
    const listRect = listRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setIndicator({ left: r.left - listRect.left + listRef.current.scrollLeft, width: r.width });
  };

  return (
    <div className="pd-tabs" id={id}>
      <div
        ref={listRef}
        className="pd-tabs__header"
        role="tablist"
        aria-label="Thông tin sản phẩm"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === activeId}
            ref={t.id === activeId ? measure : undefined}
            className={`pd-tabs__tab${t.id === activeId ? ' active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span
          className="pd-tabs__indicator"
          style={{ left: indicator.left, width: indicator.width }}
          aria-hidden="true"
        />
      </div>
      <div className="pd-tabs__body" role="tabpanel">
        {tabs.find((t) => t.id === activeId)?.content}
      </div>
    </div>
  );
}
