/**
 * 1 dòng địa chỉ đã lưu trong radio list — spec §2.1.
 * Địa chỉ mặc định gắn tag "Mặc định". Action nhỏ: Sửa / Xóa.
 * selectable=false (tab Sổ địa chỉ, màn Hồ sơ): bỏ radio chọn, không bấm cả card;
 * truyền onSetDefault -> thêm nút "Đặt làm mặc định" cho card chưa mặc định.
 */
export function addressLine(a) {
  return [a?.detail, a?.ward, a?.district, a?.province].filter(Boolean).join(', ');
}

export default function AddressCard({
  address,
  checked,
  onSelect,
  onEdit,
  onDelete,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  selectable = true,
  onSetDefault,
}) {
  return (
    <div
      className={`co-addr${selectable && checked ? ' co-addr--checked' : ''}`}
      role={selectable ? 'radio' : undefined}
      aria-checked={selectable ? checked : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? () => onSelect?.(address.id) : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(address.id);
              }
            }
          : undefined
      }
    >
      {selectable && <span className="co-addr__radio" aria-hidden="true" />}
      <div className="co-addr__body">
        <div className="co-addr__head">
          <strong className="co-addr__name">{address.receiverName}</strong>
          <span className="co-addr__phone">{address.phone}</span>
          <span className="co-addr__label">{address.label}</span>
          {address.isDefault && <span className="badge badge-new">Mặc định</span>}
        </div>
        <p className="co-addr__line">{addressLine(address)}</p>
        {address.note && <p className="co-addr__note">Ghi chú: {address.note}</p>}
        {confirmDelete ? (
          <div className="co-addr__confirm" onClick={(e) => e.stopPropagation()}>
            <span>Xóa địa chỉ này?</span>
            <button
              type="button"
              className="btn btn-secondary co-addr__confirmbtn"
              onClick={onConfirmDelete}
            >
              Xóa
            </button>
            <button
              type="button"
              className="co-addr__link"
              onClick={onCancelDelete}
            >
              Hủy
            </button>
          </div>
        ) : (
          <div className="co-addr__actions">
            <button
              type="button"
              className="co-addr__link"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(address);
              }}
            >
              Sửa
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              className="co-addr__link co-addr__link--danger"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(address.id);
              }}
            >
              Xóa
            </button>
            {onSetDefault && !address.isDefault && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  className="co-addr__link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDefault(address);
                  }}
                >
                  Đặt làm mặc định
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
