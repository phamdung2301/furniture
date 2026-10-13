import { useEffect, useRef, useState } from 'react';

/**
 * Đếm ngược flash sale — flash-sale.md §3 (component dùng chung trang + trang chủ).
 * Props: targetAt (ISO), serverNow (ISO, hiệu chỉnh lệch đồng hồ máy khách),
 * compact (3 ô Giờ:Phút:Giây; >24h -> text "N ngày H giờ"), onExpire (gọi 1 lần
 * khi về 0 — trang refetch, KHÔNG reload). Tab ẩn -> tạm dừng interval,
 * quay lại tab tính lại ngay từ mốc tuyệt đối nên không trôi giờ.
 */
export default function CountdownTimer({ targetAt, serverNow, compact = false, onExpire }) {
  const offsetRef = useRef(
    serverNow ? new Date(serverNow).getTime() - Date.now() : 0
  );
  const remainingOf = () =>
    Math.max(0, new Date(targetAt).getTime() - (Date.now() + offsetRef.current));
  const [remain, setRemain] = useState(remainingOf);
  const expiredRef = useRef(false);
  const callbackRef = useRef(onExpire);
  callbackRef.current = onExpire;

  // Đổi đích đếm (vd RUNNING -> đếm tới endAt, UPCOMING -> startAt) thì reset.
  useEffect(() => {
    expiredRef.current = false;
    offsetRef.current = serverNow ? new Date(serverNow).getTime() - Date.now() : 0;
    setRemain(remainingOf());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAt, serverNow]);

  useEffect(() => {
    let timer = null;
    const tick = () => {
      const r = remainingOf();
      setRemain(r);
      if (r <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        stop();
        callbackRef.current?.();
      }
    };
    const start = () => {
      if (timer == null) {
        tick();
        timer = setInterval(tick, 1000);
      }
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAt]);

  const totalSec = Math.floor(remain / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const urgent = remain > 0 && remain < 3600000; // < 1 giờ
  const critical = remain > 0 && remain < 300000; // < 5 phút

  if (compact && days > 0) {
    return (
      <span className="cdt cdt--compact cdt--text" role="timer">
        {days} ngày {pad(hours)} giờ
      </span>
    );
  }

  const cells = compact
    ? [
        { value: pad(hours + days * 24), label: 'Giờ' },
        { value: pad(minutes), label: 'Phút', urgent },
        { value: pad(seconds), label: 'Giây', urgent, pulse: critical },
      ]
    : [
        { value: pad(days), label: 'Ngày' },
        { value: pad(hours), label: 'Giờ' },
        { value: pad(minutes), label: 'Phút', urgent },
        { value: pad(seconds), label: 'Giây', urgent, pulse: critical },
      ];

  return (
    <div
      className={`cdt${compact ? ' cdt--compact' : ''}`}
      role="timer"
      aria-label={`Còn ${days > 0 ? `${days} ngày ` : ''}${hours} giờ ${minutes} phút ${seconds} giây`}
    >
      {cells.map((c, i) => (
        <span className="cdt__cell-wrap" key={c.label}>
          {i > 0 && <span className="cdt__sep" aria-hidden="true">:</span>}
          <span
            className={`cdt__cell${c.urgent ? ' is-urgent' : ''}${c.pulse ? ' is-pulse' : ''}`}
          >
            <span className="cdt__num">{c.value}</span>
            {!compact && <span className="cdt__label">{c.label}</span>}
          </span>
        </span>
      ))}
    </div>
  );
}
