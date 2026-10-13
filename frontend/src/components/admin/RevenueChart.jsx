import { useMemo, useState } from 'react';
import { formatVND } from '../../utils/format';

/** Rút gọn trục tung: 4250000 -> "4,3tr" · 850000 -> "850k". */
function shortMoney(v) {
  if (v >= 1000000) {
    const tr = v / 1000000;
    return `${tr.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
  }
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return `${v}`;
}

/**
 * Biểu đồ doanh thu SVG (không thư viện) — admin-dashboard.md §3.
 * type: 'bar' | 'line'. data: [{ label, revenue, completedOrders }].
 * Hover cột/điểm → tooltip: nhãn kỳ + doanh thu đầy đủ + số đơn hoàn thành.
 */
export default function RevenueChart({ data = [], type = 'bar' }) {
  const [hover, setHover] = useState(null); // index đang hover

  const W = 760;
  const H = 280;
  const PAD = { top: 16, right: 8, bottom: 30, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = useMemo(() => {
    const m = Math.max(...data.map((d) => d.revenue), 0);
    if (m <= 0) return 1;
    // Làm tròn lên mốc đẹp (1/2/5 × 10^n) cho trục tung.
    const pow = 10 ** Math.floor(Math.log10(m));
    const n = m / pow;
    const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return nice * pow;
  }, [data]);

  if (data.length === 0) {
    return <div className="chart-empty">Chưa có doanh thu trong khoảng này.</div>;
  }

  const ticks = [0.25, 0.5, 0.75, 1].map((f) => max * f);
  const xAt = (i) => PAD.left + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const yAt = (v) => PAD.top + innerH - (v / max) * innerH;
  const slot = innerW / data.length;
  const barW = Math.min(38, slot * 0.62);
  // Tâm cột = tâm slot của điểm đó.
  const barX = (i) => PAD.left + i * slot + (slot - barW) / 2;
  const labelEvery = Math.ceil(data.length / 8);

  const linePoints = data.map((d, i) => `${xAt(i)},${yAt(d.revenue)}`).join(' ');
  const areaPath =
    data.length > 1
      ? `M ${xAt(0)},${yAt(data[0].revenue)} ` +
        data.map((d, i) => `L ${xAt(i)},${yAt(d.revenue)}`).join(' ') +
        ` L ${xAt(data.length - 1)},${PAD.top + innerH} L ${xAt(0)},${PAD.top + innerH} Z`
      : '';

  const hovered = hover !== null ? data[hover] : null;
  const tooltipLeft = hover !== null ? Math.min(88, Math.max(2, (xAt(hover) / W) * 100)) : 0;

  return (
    <div className="rev-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="rev-chart__svg"
        role="img"
        aria-label="Biểu đồ doanh thu"
        onMouseLeave={() => setHover(null)}
      >
        {/* Lưới ngang + nhãn trục tung */}
        {[0, ...ticks].map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yAt(t)}
              y2={yAt(t)}
              className="rev-chart__grid"
            />
            <text x={PAD.left - 8} y={yAt(t) + 4} className="rev-chart__ylabel" textAnchor="end">
              {t === 0 ? '0' : shortMoney(t)}
            </text>
          </g>
        ))}

        {type === 'line' && data.length > 1 ? (
          <>
            <path d={areaPath} className="rev-chart__area" />
            <polyline points={linePoints} className="rev-chart__line" fill="none" />
          </>
        ) : null}

        {data.map((d, i) => {
          const isHover = hover === i;
          return (
            <g key={`${d.label}-${i}`}>
              {type === 'bar' ? (
                <rect
                  x={barX(i)}
                  y={yAt(d.revenue)}
                  width={barW}
                  height={Math.max(0, PAD.top + innerH - yAt(d.revenue))}
                  rx={4}
                  className={`rev-chart__bar${isHover ? ' is-hover' : ''}`}
                />
              ) : (
                <circle
                  cx={xAt(i)}
                  cy={yAt(d.revenue)}
                  r={isHover ? 5 : 3.5}
                  className="rev-chart__dot"
                />
              )}
              {/* Vùng bắt hover rộng theo slot */}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={innerH}
                className="rev-chart__hit"
                onMouseEnter={() => setHover(i)}
              />
              {i % labelEvery === 0 || i === data.length - 1 ? (
                <text
                  x={type === 'bar' ? barX(i) + barW / 2 : xAt(i)}
                  y={H - 8}
                  className="rev-chart__xlabel"
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {hovered ? (
        <div className="rev-chart__tooltip" style={{ left: `${tooltipLeft}%` }}>
          <div className="rev-chart__tooltip-label">{hovered.label}</div>
          <div className="rev-chart__tooltip-value">{formatVND(hovered.revenue)}</div>
          <div className="rev-chart__tooltip-sub">
            {hovered.completedOrders} đơn hoàn thành
          </div>
        </div>
      ) : null}
    </div>
  );
}
