import { useEffect } from 'react';
import FilterGroups from './FilterGroups';
import Button from './Button';

/**
 * Drawer bottom-sheet cho mobile (§1 spec):
 * trượt từ dưới lên, cao 85vh; footer sticky: "Xóa tất cả" + "Xem N sản phẩm".
 */
export default function FilterDrawer({
  open,
  onClose,
  options,
  filters,
  onChange,
  onClearAll,
  resultCount,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose} role="presentation">
      <div
        className="filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Bộ lọc sản phẩm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="filter-drawer__grab" aria-hidden="true" />
        <div className="filter-drawer__head">
          <h2>Bộ lọc</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng bộ lọc">
            ✕
          </button>
        </div>
        <div className="filter-drawer__body">
          <FilterGroups options={options} filters={filters} onChange={onChange} />
        </div>
        <div className="filter-drawer__foot">
          <Button variant="secondary" onClick={onClearAll}>
            Xóa tất cả
          </Button>
          <Button variant="primary" onClick={onClose}>
            Xem {resultCount} sản phẩm
          </Button>
        </div>
      </div>
    </div>
  );
}
