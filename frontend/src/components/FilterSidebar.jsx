import FilterGroups from './FilterGroups';

/** Sidebar filter desktop — sticky, rộng 260px, scroll độc lập (§1 spec). */
export default function FilterSidebar({ options, filters, onChange }) {
  return (
    <aside className="filter-sidebar" aria-label="Bộ lọc sản phẩm">
      <FilterGroups options={options} filters={filters} onChange={onChange} />
    </aside>
  );
}
