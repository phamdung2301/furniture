/**
 * Thẻ chỉ số KPI — admin-dashboard.md §2 (quy ước §B dùng chung màn 14–22).
 * Nhãn 13px muted · số 24px/800 · dòng so sánh kỳ trước (▲ tăng xanh /
 * ▼ giảm đỏ, thập phân phẩy kiểu vi-VN). Card có onClick thì là button.
 */
function fmtPct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value).toLocaleString('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export default function KpiCard({
  label,
  value,
  changePct,
  changeLabel,
  subText,
  hint,
  onClick,
  loading = false,
}) {
  const hasChange = changePct !== null && changePct !== undefined;
  const up = (changePct ?? 0) >= 0;
  const body = (
    <>
      <div className="kpi-card__label">
        <span>{label}</span>
        {hint ? (
          <span className="kpi-card__hint" title={hint} aria-label={hint}>
            ?
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="skeleton kpi-card__skel" aria-hidden="true" />
      ) : (
        <>
          <div className="kpi-card__value">{value}</div>
          {hasChange ? (
            <div className={`kpi-card__delta ${up ? 'is-up' : 'is-down'}`}>
              <span aria-hidden="true">{up ? '▲' : '▼'}</span> {fmtPct(changePct)}
              {changeLabel ? <span className="kpi-card__delta-label"> {changeLabel}</span> : null}
            </div>
          ) : subText ? (
            <div className="kpi-card__sub">{subText}</div>
          ) : null}
        </>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="kpi-card kpi-card--clickable" onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className="kpi-card">{body}</div>;
}
