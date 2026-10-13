import AdminModal from './AdminModal';

/**
 * Confirm cho thao tác xóa/ngừng bán — quy ước §B.3:
 * tiêu đề là hành động, nội dung nêu rõ TÊN đối tượng (in đậm, truyền qua
 * children) + hậu quả; nút nguy hiểm nền --error, nhãn đúng hành động.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Xóa',
  cancelLabel = 'Hủy',
  confirmDisabled = false,
  onConfirm,
  onCancel,
  loading = false,
}) {
  return (
    <AdminModal
      open={open}
      title={title}
      onClose={loading ? undefined : onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
          >
            {loading ? 'Đang xử lý…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-dialog__body">{children}</div>
    </AdminModal>
  );
}
