/**
 * Timeline trạng thái đơn — theo-doi-don.md §3.2 (US-009, F-009).
 * Dựng từ statusHistory[] + khối payment. 5 mốc chuẩn:
 * Đặt hàng → Thanh toán → Đóng gói → Đang giao → Hoàn thành.
 * Đơn ĐÃ HỦY: chỉ hiện mốc đã đạt + mốc đỏ kèm lý do.
 */
import { formatTimeDay } from '../utils/format';

const RANK = { 'MỚI': 0, 'ĐÃ XÁC NHẬN': 2, 'ĐANG GIAO': 3, 'HOÀN THÀNH': 4, 'HOÀN TRẢ': 4 };

function hhmm(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Mốc "Thanh toán" render theo phương thức (spec §3.2 mục 2). */
function paymentMilestone(order, rank) {
  const payment = order.payment || {};
  const paid = payment.status === 'ĐÃ THANH TOÁN';
  if (order.paymentMethod === 'MOMO') {
    return paid
      ? {
          label: 'Thanh toán',
          at: payment.paidAt,
          note: `Đã thanh toán qua Ví MoMo lúc ${hhmm(payment.paidAt)}`,
          state: 'done',
        }
      : {
          label: 'Thanh toán',
          at: null,
          note: 'Đang chờ thanh toán',
          state: order.status === 'MỚI' ? 'current' : 'upcoming',
        };
  }
  if (order.paymentMethod === 'BANK_TRANSFER') {
    return paid
      ? {
          label: 'Thanh toán',
          at: payment.paidAt,
          note: 'Đã chuyển khoản — shop đang xác nhận',
          state: 'done',
        }
      : { label: 'Thanh toán', at: null, note: 'Chờ xác nhận chuyển khoản', state: 'current' };
  }
  // COD
  return {
    label: 'Thanh toán',
    at: paid ? payment.paidAt : null,
    note: 'Thanh toán khi nhận hàng',
    state: paid || rank >= 2 ? 'done' : 'upcoming',
  };
}

/**
 * @param {boolean} [adminView] — phía admin (màn 17, admin-don-hang.md §3.7):
 *   hiện ĐẦY ĐỦ note của từng mốc trong statusHistory (lý do, ghi chú khi
 *   chuyển trạng thái) + nhãn "Hệ thống" cho mốc do hệ thống tạo (bySystem).
 *   Phía khách giữ nguyên hành vi mặc định (note rút gọn theo spec màn 11).
 */
export default function OrderTimeline({ order, adminView = false }) {
  const history = order.statusHistory || [];
  const byStatus = {};
  history.forEach((h) => {
    byStatus[h.status] = h;
  });
  const rank = RANK[order.status] ?? 0;
  const cancelled = order.status === 'ĐÃ HỦY';

  const flow = [
    { key: 'MỚI', label: 'Đặt hàng', milestoneRank: 0, note: null },
    { key: '__PAYMENT__', label: 'Thanh toán', milestoneRank: 1 },
    { key: 'ĐÃ XÁC NHẬN', label: 'Đóng gói', milestoneRank: 2, note: 'Shop đã xác nhận đơn' },
    { key: 'ĐANG GIAO', label: 'Đang giao', milestoneRank: 3, note: 'Đang giao đến bạn' },
    { key: 'HOÀN THÀNH', label: 'Hoàn thành', milestoneRank: 4, note: 'Đã giao thành công' },
  ];

  let milestones;
  if (cancelled) {
    // Chỉ mốc đã đạt được (có trong history) + payment nếu đã trả.
    milestones = flow
      .filter((m) =>
        m.key === '__PAYMENT__'
          ? order.payment?.status === 'ĐÃ THANH TOÁN'
          : Boolean(byStatus[m.key])
      )
      .map((m) => {
        if (m.key === '__PAYMENT__') return { ...paymentMilestone(order, rank), state: 'done' };
        return {
          label: m.label,
          at: byStatus[m.key]?.at,
          note: m.note,
          state: 'done',
        };
      });
    const cancelEntry = byStatus['ĐÃ HỦY'];
    milestones.push({
      label: 'Đã hủy',
      at: cancelEntry?.at,
      note: cancelEntry?.note || '',
      state: 'cancelled',
      bySystem: Boolean(cancelEntry?.bySystem),
    });
  } else {
    milestones = flow.map((m) => {
      if (m.key === '__PAYMENT__') return paymentMilestone(order, rank);
      const state =
        m.milestoneRank < rank
          ? 'done'
          : m.milestoneRank === rank
            ? order.status === 'HOÀN THÀNH'
              ? 'done'
              : 'current'
            : 'upcoming';
      const entry = byStatus[m.key];
      let note =
        m.key === 'ĐANG GIAO' && order.trackingCode
          ? `Đang giao đến bạn · Mã vận đơn ${order.trackingCode}`
          : m.note;
      if (adminView && entry?.note) {
        // Admin thấy note gốc của mốc; mã vận đơn vẫn đính kèm ở mốc ĐANG GIAO.
        note =
          m.key === 'ĐANG GIAO' && order.trackingCode
            ? `${entry.note} · Mã vận đơn ${order.trackingCode}`
            : entry.note;
      }
      return {
        label: m.label,
        at: entry?.at || null,
        note,
        state,
        bySystem: Boolean(entry?.bySystem),
      };
    });
    if (byStatus['HOÀN TRẢ']) {
      milestones.push({
        label: 'Hoàn trả',
        at: byStatus['HOÀN TRẢ'].at,
        note: byStatus['HOÀN TRẢ'].note || '',
        state: 'cancelled',
        bySystem: Boolean(byStatus['HOÀN TRẢ']?.bySystem),
      });
    }
  }

  return (
    <ol className="order-timeline" aria-label="Tiến trình đơn hàng">
      {milestones.map((m, idx) => (
        <li key={idx} className={`order-timeline__item order-timeline__item--${m.state}`}>
          <span className="order-timeline__dot" aria-hidden="true" />
          <div className="order-timeline__body">
            <p className="order-timeline__label">
              {m.label}
              {m.at && (
                <span className="order-timeline__time">{formatTimeDay(m.at)}</span>
              )}
              {adminView && m.bySystem && (
                <span className="order-timeline__system">Hệ thống</span>
              )}
            </p>
            {m.note && <p className="order-timeline__note">{m.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
