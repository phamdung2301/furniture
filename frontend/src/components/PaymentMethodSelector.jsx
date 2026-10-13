/**
 * Bước 3 — Phương thức thanh toán — spec §4 (FR-010 · F-008).
 * 3 radio card: Ví MoMo (tag "Nhanh & an toàn") / COD (mặc định) /
 * Chuyển khoản ngân hàng. Card được chọn: viền brand-700 2px + check.
 * Tuyệt đối không hiện secret/key MoMo ở frontend (F-008).
 */
export const PAYMENT_METHODS = [
  {
    code: 'MOMO',
    name: 'Ví MoMo',
    desc: 'Quét mã QR hoặc xác nhận trên app MoMo.',
    tag: 'Nhanh & an toàn',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <rect x="2" y="6" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="18" cy="15" r="1.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    code: 'COD',
    name: 'Thanh toán khi nhận hàng (COD)',
    desc: 'Kiểm tra hàng rồi mới trả tiền.',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M6 9.5h.01M18 14.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    code: 'BANK_TRANSFER',
    name: 'Chuyển khoản ngân hàng',
    desc: 'Chuyển khoản theo nội dung hiển thị sau khi đặt hàng.',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path d="M3 9l9-5 9 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 9v10M20 9v10M8 12v5M12 12v5M16 12v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M2 20h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

/** Tên hiển thị của phương thức — dùng ở trang thành công. */
export function paymentMethodName(code) {
  return PAYMENT_METHODS.find((m) => m.code === code)?.name || code;
}

export default function PaymentMethodSelector({ value, onChange }) {
  return (
    <div className="co-pay" role="radiogroup" aria-label="Phương thức thanh toán">
      {PAYMENT_METHODS.map((m) => {
        const selected = value === m.code;
        return (
          <button
            key={m.code}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`co-pay__card${selected ? ' co-pay__card--selected' : ''}`}
            onClick={() => onChange?.(m.code)}
          >
            <span className="co-pay__icon" aria-hidden="true">
              {m.icon}
            </span>
            <span className="co-pay__body">
              <span className="co-pay__name">
                {m.name}
                {m.tag && <span className="badge badge-new co-pay__tag">{m.tag}</span>}
              </span>
              <span className="co-pay__desc">{m.desc}</span>
            </span>
            <span className="co-pay__check" aria-hidden="true">
              {selected ? '✓' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
