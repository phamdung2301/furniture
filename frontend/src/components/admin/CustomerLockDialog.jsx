import { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { lockCustomer } from '../../api/adminCustomerApi';
import { formatPhoneVN } from '../../utils/format';
import { formatAutoUnlock } from './CustomerAccountBadge';

/**
 * Dialog khóa tài khoản — admin-khach-hang.md §4.2. Dùng chung cho icon ở
 * bảng danh sách và nút ở đầu slide-over chi tiết.
 * Nêu rõ hậu quả: khách không đăng nhập/đặt hàng mới được, đơn đang xử lý
 * KHÔNG bị ảnh hưởng, lịch sử được giữ nguyên. Có ô Lý do khóa (không bắt
 * buộc). Khách đang tạm khóa tự động → thêm cảnh báo khóa admin sẽ thay
 * thế và không tự mở. KHÔNG cập nhật lạc quan: chỉ gọi onLocked(updatedRow)
 * sau khi API xác nhận (§4.2).
 */
export default function CustomerLockDialog({ customer, onClose, onLocked, onToast }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (customer) {
      setReason('');
      setBusy(false);
    }
  }, [customer]);

  const handleConfirm = async () => {
    if (!customer) return;
    setBusy(true);
    try {
      const updated = await lockCustomer(customer.id, { reason: reason.trim() || undefined });
      onLocked?.(updated);
      onToast?.(`Đã khóa tài khoản của ${customer.fullName}.`);
      onClose?.();
    } catch (e) {
      onToast?.(e?.message || 'Không khóa được tài khoản. Vui lòng thử lại.');
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(customer)}
      title="Khóa tài khoản?"
      confirmLabel="Khóa tài khoản"
      loading={busy}
      onCancel={onClose}
      onConfirm={handleConfirm}
    >
      {customer ? (
        <>
          <p>
            Khách hàng <strong>{customer.fullName}</strong> ·{' '}
            {formatPhoneVN(customer.phone)}
          </p>
          <ul className="customer-lock__effects">
            <li>Khách sẽ không đăng nhập được và không đặt hàng mới được.</li>
            <li>
              Các đơn đang xử lý của khách không bị ảnh hưởng — vẫn xác nhận, giao và hoàn
              thành bình thường.
            </li>
            <li>Lịch sử đơn hàng và dữ liệu của khách được giữ nguyên.</li>
          </ul>
          {customer.lockSource === 'AUTO' ? (
            <p className="customer-lock__warn">
              Tài khoản này đang tạm khóa tự động đến{' '}
              {formatAutoUnlock(customer.lockedUntil)}. Khóa bởi quản trị viên sẽ thay thế
              và không tự mở.
            </p>
          ) : null}
          <label className="customer-lock__field">
            <span>Lý do khóa (không bắt buộc)</span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Khách yêu cầu khóa tài khoản qua hotline…"
              aria-label="Lý do khóa"
            />
          </label>
        </>
      ) : null}
    </ConfirmDialog>
  );
}
