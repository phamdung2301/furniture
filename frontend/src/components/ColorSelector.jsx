/**
 * Chọn màu sắc — §3.5 spec. Biến thể theo dõi đến cấp MÀU (QĐ 2026-10-10).
 * Màu hết hàng: mờ 40% + gạch chéo, không click được. KHÔNG hiển thị SKU.
 */
export default function ColorSelector({ variants = [], selectedId, onSelect, size = 28 }) {
  return (
    <div className="pd-colors" role="radiogroup" aria-label="Chọn màu sắc">
      {variants.map((v) => {
        const out = v.stock === 0;
        const active = v.id === selectedId;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={out}
            title={out ? `${v.color} — Hết hàng` : v.color}
            aria-label={out ? `${v.color}, hết hàng` : v.color}
            className={`pd-color-dot${active ? ' active' : ''}${out ? ' out' : ''}`}
            style={{ width: size, height: size, backgroundColor: v.colorHex || '#ccc' }}
            onClick={() => onSelect(v)}
          >
            {out && <span className="pd-color-dot__cross" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
