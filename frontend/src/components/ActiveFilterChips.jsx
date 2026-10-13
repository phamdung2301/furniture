/**
 * Chips các filter đang áp dụng (§2.3 spec) + link "Xóa tất cả".
 * chips: [{ key, label, onRemove }]
 */
export default function ActiveFilterChips({ chips, onClearAll }) {
  if (!chips || chips.length === 0) return null;
  return (
    <div className="active-chips" aria-label="Bộ lọc đang áp dụng">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="filter-chip"
          onClick={chip.onRemove}
          aria-label={`Bỏ lọc ${chip.label}`}
        >
          <span>{chip.label}</span>
          <span aria-hidden="true">✕</span>
        </button>
      ))}
      <button type="button" className="link-btn" onClick={onClearAll}>
        Xóa tất cả
      </button>
    </div>
  );
}
