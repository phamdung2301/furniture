/**
 * Badge trạng thái tài khoản khách — admin-khach-hang.md §2.2/§4.3.
 * Phân biệt 2 nguồn khóa cùng ghi status=LOCKED bằng `lockSource` do BE trả:
 * ADMIN → "Đã khóa" (không tự mở) · AUTO → "Tạm khóa" kèm dòng nhỏ
 * "Tự mở lúc {HH:mm dd/MM}". Dùng chung bảng danh sách + slide-over chi tiết.
 */

const pad2 = (n) => String(n).padStart(2, '0');

export function formatAutoUnlock(lockedUntil) {
  if (!lockedUntil) return '';
  const d = new Date(lockedUntil);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(
    d.getMonth() + 1
  )}`;
}

export default function CustomerAccountBadge({ customer }) {
  if (!customer) return null;
  if (customer.status !== 'LOCKED') {
    return <span className="customer-badge is-active">Hoạt động</span>;
  }
  if (customer.lockSource === 'AUTO') {
    return (
      <span className="customer-status-cell">
        <span className="customer-badge is-locked">Tạm khóa</span>
        {customer.lockedUntil ? (
          <span className="customer-status-sub">
            Tự mở lúc {formatAutoUnlock(customer.lockedUntil)}
          </span>
        ) : null}
      </span>
    );
  }
  return <span className="customer-badge is-locked">Đã khóa</span>;
}
