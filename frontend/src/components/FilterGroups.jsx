import { useEffect, useRef, useState } from 'react';
import { formatVND } from '../utils/format';

/**
 * Các nhóm filter dùng chung cho FilterSidebar (desktop) và FilterDrawer (mobile).
 * Thứ tự theo spec §3: Tình trạng → Khoảng giá → Màu sắc → Chất liệu → Kích thước.
 *
 * Props:
 *   options: { colors: [{name, colorHex, inStock}], materials: string[] }
 *   filters: { priceMin, priceMax, colors[], materials[], sizes[], inStock }
 *   onChange(patch) — merge patch vào filters
 */
const PRICE_PRESETS = [
  { id: 'duoi-1', label: 'Dưới 1 triệu', min: null, max: 1000000 },
  { id: '1-5', label: '1 – 5 triệu', min: 1000000, max: 5000000 },
  { id: '5-10', label: '5 – 10 triệu', min: 5000000, max: 10000000 },
  { id: '10-20', label: '10 – 20 triệu', min: 10000000, max: 20000000 },
  { id: 'tren-20', label: 'Trên 20 triệu', min: 20000000, max: null },
];

const SIZE_OPTIONS = [
  { id: 'nho', label: 'Nhỏ (dưới 1m)' },
  { id: 'vua', label: 'Vừa (1 – 2m)' },
  { id: 'lon', label: 'Lớn (trên 2m)', hint: 'sofa góc, giường 1m8…' },
];

function matchPreset(priceMin, priceMax) {
  const p = PRICE_PRESETS.find((x) => x.min === priceMin && x.max === priceMax);
  return p ? p.id : null;
}

function Group({ title, onClear, children }) {
  return (
    <section className="filter-group">
      <div className="filter-group__head">
        <h3>{title}</h3>
        {onClear && (
          <button type="button" className="filter-group__clear" onClick={onClear}>
            Xóa
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export default function FilterGroups({ options, filters, onChange }) {
  const activePreset = matchPreset(filters.priceMin ?? null, filters.priceMax ?? null);
  const [customMin, setCustomMin] = useState(
    activePreset ? '' : filters.priceMin != null ? String(Math.round(filters.priceMin / 1000000)) : ''
  );
  const [customMax, setCustomMax] = useState(
    activePreset ? '' : filters.priceMax != null ? String(Math.round(filters.priceMax / 1000000)) : ''
  );
  const debounceRef = useRef(null);

  // Khi filter giá đổi từ ngoài (preset/chip/xóa), đồng bộ ô nhập tay
  useEffect(() => {
    const p = matchPreset(filters.priceMin ?? null, filters.priceMax ?? null);
    if (p) {
      setCustomMin('');
      setCustomMax('');
    }
  }, [filters.priceMin, filters.priceMax]);

  // Debounce 500ms cho ô nhập tay (§3.1 spec).
  // Bỏ qua khi cả 2 ô trống (= đang dùng preset hoặc chưa nhập) để không xóa nhầm filter.
  useEffect(() => {
    if (customMin === '' && customMax === '') return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const min = customMin !== '' ? Math.max(0, Number(customMin) * 1000000) : null;
      const max = customMax !== '' ? Math.max(0, Number(customMax) * 1000000) : null;
      if (Number.isNaN(min) || Number.isNaN(max)) return;
      if ((min ?? null) !== (filters.priceMin ?? null) || (max ?? null) !== (filters.priceMax ?? null)) {
        onChange({ priceMin: min, priceMax: max });
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customMin, customMax]);

  const toggleList = (key, value) => {
    const cur = filters[key] || [];
    onChange({
      [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value],
    });
  };

  const toggleSize = (id) => {
    const cur = filters.sizes || [];
    onChange({ sizes: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  const pickPreset = (preset) => {
    setCustomMin('');
    setCustomMax('');
    onChange({ priceMin: preset.min, priceMax: preset.max });
  };

  const { colors = [], materials = [] } = options;

  return (
    <div className="filter-groups">
      {/* Tình trạng còn hàng — §2.6 spec */}
      <section className="filter-group">
        <label className="switch-row">
          <span className="switch-row__label">Chỉ hiện sản phẩm còn hàng</span>
          <button
            type="button"
            role="switch"
            aria-checked={!!filters.inStock}
            className={`switch${filters.inStock ? ' switch--on' : ''}`}
            onClick={() => onChange({ inStock: !filters.inStock })}
          >
            <span className="switch__knob" />
          </button>
        </label>
      </section>

      {/* Khoảng giá */}
      <Group
        title="Khoảng giá"
        onClear={filters.priceMin != null || filters.priceMax != null ? () => onChange({ priceMin: null, priceMax: null }) : null}
      >
        <div className="filter-options" role="radiogroup" aria-label="Khoảng giá">
          {PRICE_PRESETS.map((preset) => (
            <label key={preset.id} className="radio-row">
              <input
                type="radio"
                name="price-preset"
                checked={activePreset === preset.id}
                onChange={() => pickPreset(preset)}
              />
              <span>{preset.label}</span>
            </label>
          ))}
        </div>
        <div className="price-custom">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Từ (triệu)"
            aria-label="Giá từ (triệu đồng)"
            value={customMin}
            onChange={(e) => setCustomMin(e.target.value)}
          />
          <span aria-hidden="true">–</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Đến (triệu)"
            aria-label="Giá đến (triệu đồng)"
            value={customMax}
            onChange={(e) => setCustomMax(e.target.value)}
          />
        </div>
        {(filters.priceMin != null || filters.priceMax != null) && (
          <p className="filter-hint">
            Đang lọc: {filters.priceMin != null ? formatVND(filters.priceMin) : '0đ'}
            {' – '}
            {filters.priceMax != null ? formatVND(filters.priceMax) : 'không giới hạn'}
          </p>
        )}
      </Group>

      {/* Màu sắc */}
      {colors.length > 0 && (
        <Group
          title="Màu sắc"
          onClear={filters.colors?.length ? () => onChange({ colors: [] }) : null}
        >
          <div className="color-picker">
            {colors.map((c) => {
              const selected = (filters.colors || []).includes(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  className={`color-pick${selected ? ' color-pick--selected' : ''}${!c.inStock ? ' color-pick--oos' : ''}`}
                  disabled={!c.inStock}
                  title={c.inStock ? c.name : `${c.name} (hết hàng)`}
                  aria-pressed={selected}
                  aria-label={`Lọc màu ${c.name}`}
                  onClick={() => toggleList('colors', c.name)}
                >
                  <span className="color-pick__dot" style={{ backgroundColor: c.colorHex || '#ccc' }} />
                  <span className="color-pick__name">{c.name}</span>
                  {selected && <span className="color-pick__tick" aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        </Group>
      )}

      {/* Chất liệu */}
      {materials.length > 0 && (
        <Group
          title="Chất liệu"
          onClear={filters.materials?.length ? () => onChange({ materials: [] }) : null}
        >
          <div className="filter-options">
            {materials.map((m) => (
              <label key={m} className="check-row">
                <input
                  type="checkbox"
                  checked={(filters.materials || []).includes(m)}
                  onChange={() => toggleList('materials', m)}
                />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </Group>
      )}

      {/* Kích thước */}
      <Group
        title="Kích thước"
        onClear={filters.sizes?.length ? () => onChange({ sizes: [] }) : null}
      >
        <div className="filter-options">
          {SIZE_OPTIONS.map((s) => (
            <label key={s.id} className="check-row">
              <input
                type="checkbox"
                checked={(filters.sizes || []).includes(s.id)}
                onChange={() => toggleSize(s.id)}
              />
              <span>
                {s.label}
                {s.hint && <span className="filter-hint"> ({s.hint})</span>}
              </span>
            </label>
          ))}
        </div>
      </Group>
    </div>
  );
}
