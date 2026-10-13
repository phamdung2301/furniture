/** Dropdown sắp xếp — 4 kiểu theo F-002 sort (§0 spec).
 *  Prop showRelevance: thêm option "Liên quan nhất" ở đầu, chỉ dùng ở màn Tìm kiếm. */
const BASE_OPTIONS = [
  { id: 'popular', label: 'Bán chạy nhất' },
  { id: 'price_asc', label: 'Giá: Thấp đến cao' },
  { id: 'price_desc', label: 'Giá: Cao đến thấp' },
  { id: 'newest', label: 'Mới nhất' },
];

export default function SortDropdown({ value, onChange, showRelevance = false, options }) {
  const list = options || (showRelevance
    ? [{ id: 'relevance', label: 'Liên quan nhất' }, ...BASE_OPTIONS]
    : BASE_OPTIONS);
  return (
    <label className="sort-dropdown">
      <span className="sort-dropdown__label">Sắp xếp:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Sắp xếp sản phẩm"
      >
        {list.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
