/** Danh mục nổi bật (≤8) — §2.5 spec */
export default function CategoryGrid({ categories, onSelect }) {
  if (!categories || categories.length === 0) return null;
  return (
    <div className="cat-grid">
      {categories.slice(0, 8).map((c) => (
        <button
          key={c.id}
          className="cat-item"
          onClick={() => onSelect?.(c)}
          aria-label={`Xem danh mục ${c.name}`}
        >
          <span className="cat-item__img">
            {c.imageUrl ? (
              <img src={c.imageUrl} alt="" loading="lazy" />
            ) : null}
          </span>
          <span className="cat-item__name">{c.name}</span>
        </button>
      ))}
    </div>
  );
}
