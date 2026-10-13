/**
 * Stepper 4 bước màn Đặt hàng — spec §1.
 * Click được để quay lại bước đã hoàn thành (step <= maxReached);
 * bước chưa xong không cho nhảy tới. Mobile: gọn thành "Bước X/4 — tên bước".
 */
export const CHECKOUT_STEPS = [
  'Thông tin nhận hàng',
  'Mã ưu đãi',
  'Phương thức thanh toán',
  'Xác nhận đơn',
];

export default function CheckoutSteps({ current = 1, maxReached = 1, onGo }) {
  return (
    <div className="co-steps" aria-label="Tiến trình đặt hàng">
      <ol className="co-steps__list">
        {CHECKOUT_STEPS.map((label, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          const clickable = step <= maxReached && step !== current;
          return (
            <li
              key={label}
              className={[
                'co-steps__item',
                done ? 'co-steps__item--done' : '',
                active ? 'co-steps__item--active' : '',
                clickable ? 'co-steps__item--clickable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              <button
                type="button"
                className="co-steps__btn"
                disabled={!clickable}
                onClick={() => clickable && onGo?.(step)}
                aria-label={done ? `${label} (đã xong, bấm để quay lại)` : label}
              >
                <span className="co-steps__num" aria-hidden="true">
                  {done ? '✓' : step}
                </span>
                <span className="co-steps__label">{label}</span>
              </button>
              {step < CHECKOUT_STEPS.length && (
                <span className="co-steps__line" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
      <p className="co-steps__mobile" aria-hidden="true">
        Bước {current}/4 — {CHECKOUT_STEPS[current - 1]}
      </p>
    </div>
  );
}
