/**
 * Donut đơn theo trạng thái — admin-dashboard.md §4.
 * Màu khớp OrderStatusBadge §B.4 (không chế màu mới). Ở giữa: tổng số đơn.
 * Click lát/legend → onSelect(status).
 */

export const STATUS_META = [
  { status: 'MỚI', label: 'Mới', color: '#B7791F' },
  { status: 'ĐÃ XÁC NHẬN', label: 'Đã xác nhận', color: '#5D3A29' },
  { status: 'ĐANG GIAO', label: 'Đang giao', color: '#8A6D1A' },
  { status: 'HOÀN THÀNH', label: 'Hoàn thành', color: '#2E7D32' },
  { status: 'ĐÃ HỦY', label: 'Đã hủy', color: '#8A7A6B' },
  { status: 'HOÀN TRẢ', label: 'Hoàn trả', color: '#C62828' },
];

function fmtPct(part, total) {
  if (!total) return '0,0%';
  return `${((part / total) * 100).toLocaleString('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export default function StatusDonut({ data = [], onSelect }) {
  const byStatus = new Map(data.map((d) => [d.status, d.count]));
  const total = STATUS_META.reduce((s, m) => s + (byStatus.get(m.status) || 0), 0);

  const R = 70;
  const CIRC = 2 * Math.PI * R;
  let acc = 0;
  const segments = STATUS_META.map((m) => {
    const count = byStatus.get(m.status) || 0;
    const frac = total > 0 ? count / total : 0;
    const seg = { ...m, count, frac, offset: acc };
    acc += frac;
    return seg;
  }).filter((s) => s.count > 0);

  return (
    <div className="status-donut">
      <div className="status-donut__chart">
        <svg viewBox="0 0 180 180" className="status-donut__svg" role="img" aria-label="Đơn theo trạng thái">
          <circle cx="90" cy="90" r={R} className="status-donut__track" />
          {segments.map((s) => (
            <circle
              key={s.status}
              cx="90"
              cy="90"
              r={R}
              className="status-donut__seg"
              stroke={s.color}
              strokeDasharray={`${Math.max(0, s.frac * CIRC - 2)} ${CIRC}`}
              strokeDashoffset={-s.offset * CIRC}
              onClick={onSelect ? () => onSelect(s.status) : undefined}
            >
              <title>{`${s.label}: ${s.count} đơn`}</title>
            </circle>
          ))}
        </svg>
        <div className="status-donut__center">
          <div className="status-donut__total">{total}</div>
          <div className="status-donut__unit">đơn</div>
        </div>
      </div>
      <ul className="status-donut__legend">
        {STATUS_META.map((m) => {
          const count = byStatus.get(m.status) || 0;
          return (
            <li key={m.status}>
              <button
                type="button"
                className="status-donut__legend-item"
                onClick={onSelect ? () => onSelect(m.status) : undefined}
              >
                <span className="status-donut__dot" style={{ background: m.color }} />
                <span className="status-donut__legend-label">{m.label}</span>
                <span className="status-donut__legend-count">{count}</span>
                <span className="status-donut__legend-pct">{fmtPct(count, total)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
