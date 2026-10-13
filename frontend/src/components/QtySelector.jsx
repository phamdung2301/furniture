/**
 * Stepper số lượng — 1 ≤ qty ≤ max (stock của màu đang chọn).
 * Prop optional `onMaxAttempt`: khi bấm + lúc qty đã chạm max, thay vì disabled
 * nút + thì gọi onMaxAttempt() (VD: giỏ hàng hiện tooltip "Chỉ còn X sản phẩm").
 * Khi không truyền onMaxAttempt, hành vi giữ nguyên như cũ (nút + bị disabled).
 */
export default function QtySelector({ qty, max, onChange, disabled, onMaxAttempt }) {
  const clamp = (n) => {
    if (!Number.isFinite(n)) return 1;
    return Math.min(Math.max(1, Math.floor(n)), Math.max(1, max));
  };

  const atMax = qty >= max;
  const plusDisabled = disabled || (atMax && !onMaxAttempt);

  const handlePlus = () => {
    if (atMax && onMaxAttempt) {
      onMaxAttempt();
      return;
    }
    onChange(clamp(qty + 1));
  };

  return (
    <div className="pd-qty" aria-label="Chọn số lượng">
      <button
        type="button"
        className="pd-qty__btn"
        disabled={disabled || qty <= 1}
        onClick={() => onChange(clamp(qty - 1))}
        aria-label="Giảm số lượng"
      >
        −
      </button>
      <input
        className="pd-qty__input"
        type="number"
        min={1}
        max={Math.max(1, max)}
        value={qty}
        disabled={disabled}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        onBlur={(e) => onChange(clamp(Number(e.target.value) || 1))}
        aria-label="Số lượng"
      />
      <button
        type="button"
        className="pd-qty__btn"
        disabled={plusDisabled}
        onClick={handlePlus}
        aria-label="Tăng số lượng"
      >
        +
      </button>
    </div>
  );
}
