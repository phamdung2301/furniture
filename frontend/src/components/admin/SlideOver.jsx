import { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * Panel trượt từ phải cho form dài (sản phẩm nhiều biến thể/ảnh) — §B.2:
 * rộng 560px, mobile full-screen. Đóng bằng ×/Esc/click overlay;
 * nếu `dirty` (đã sửa chưa lưu) → confirm trước khi đóng.
 */
export default function SlideOver({ open, title, onClose, children, footer, dirty = false, wide = false, panelClassName = '' }) {
  const [askDiscard, setAskDiscard] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty]);

  if (!open) return null;

  function handleClose() {
    if (dirty) {
      setAskDiscard(true);
    } else {
      onClose?.();
    }
  }

  return (
    <>
      <div className="admin-overlay" onMouseDown={handleClose} role="presentation">
        <aside
          className={`admin-slideover${wide ? ' admin-slideover--wide' : ''}${panelClassName ? ` ${panelClassName}` : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="admin-slideover__head">
            <h3 className="admin-slideover__title">{title}</h3>
            <button
              type="button"
              className="admin-icon-btn"
              onClick={handleClose}
              aria-label="Đóng"
            >
              ×
            </button>
          </div>
          <div className="admin-slideover__body">{children}</div>
          {footer ? <div className="admin-slideover__foot">{footer}</div> : null}
        </aside>
      </div>
      <ConfirmDialog
        open={askDiscard}
        title="Đóng mà không lưu?"
        confirmLabel="Đóng"
        onCancel={() => setAskDiscard(false)}
        onConfirm={() => {
          setAskDiscard(false);
          onClose?.();
        }}
      >
        <p>
          Bạn có thay đổi chưa lưu. Đóng mà không lưu sẽ làm mất các thay đổi này.
        </p>
      </ConfirmDialog>
    </>
  );
}
