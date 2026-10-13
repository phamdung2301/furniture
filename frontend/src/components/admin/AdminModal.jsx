import { useEffect } from 'react';

/**
 * Modal giữa màn hình cho form ngắn (≤6 trường) — quy ước §B.2:
 * rộng 520px, mobile thành bottom-sheet. Đóng bằng ×/Esc/click overlay.
 * Form dài dùng SlideOver thay thế.
 */
export default function AdminModal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="admin-overlay" onMouseDown={onClose} role="presentation">
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="admin-modal__head">
          <h3 className="admin-modal__title">{title}</h3>
          <button type="button" className="admin-icon-btn" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="admin-modal__body">{children}</div>
        {footer ? <div className="admin-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
