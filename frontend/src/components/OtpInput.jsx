import { useEffect, useRef, useState } from 'react';

const LENGTH = 6;

/**
 * 6 ô nhập mã xác thực (OTP) — F-024.
 * - Tự nhảy ô tiếp theo khi nhập, Backspace ở ô trống lùi về ô trước và xóa
 * - Paste cả dãy số -> điền hết; chỉ nhận ký tự số
 * - Nhập đủ 6 số -> tự gọi onComplete
 * - TUYỆT ĐỐI không log mã ra console.
 */
export default function OtpInput({
  onComplete,
  onChange,
  disabled = false,
  autoFocus = true,
  resetKey = 0,
}) {
  const [values, setValues] = useState(() => Array(LENGTH).fill(''));
  const inputsRef = useRef([]);
  const completedRef = useRef(false);

  useEffect(() => {
    setValues(Array(LENGTH).fill(''));
    completedRef.current = false;
    if (autoFocus && !disabled) {
      const id = setTimeout(() => inputsRef.current[0]?.focus(), 50);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [resetKey, autoFocus, disabled]);

  const emit = (next) => {
    const code = next.join('');
    onChange?.(code);
    if (code.length === LENGTH && !completedRef.current) {
      completedRef.current = true;
      onComplete?.(code);
    } else if (code.length < LENGTH) {
      completedRef.current = false;
    }
  };

  const handleChange = (index, e) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    if (!cleaned) {
      // Người dùng xóa nội dung ô (Delete / chọn hết rồi xóa).
      const next = [...values];
      next[index] = '';
      setValues(next);
      emit(next);
      return;
    }
    const digit = cleaned.slice(-1);
    const next = [...values];
    next[index] = digit;
    setValues(next);
    emit(next);
    if (index < LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && values[index] === '' && index > 0) {
      e.preventDefault();
      const next = [...values];
      next[index - 1] = '';
      setValues(next);
      emit(next);
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const digits = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, LENGTH);
    if (!digits) return;
    const next = Array(LENGTH).fill('');
    for (let i = 0; i < digits.length; i += 1) next[i] = digits[i];
    setValues(next);
    emit(next);
    const focusIndex = Math.min(digits.length, LENGTH - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  return (
    <div
      className="otp-input"
      role="group"
      aria-label="Nhập mã xác thực 6 số"
      onPaste={handlePaste}
    >
      {values.map((v, i) => (
        <input
          key={`${resetKey}-${i}`}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          className="otp-box"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={v}
          disabled={disabled}
          aria-label={`Số thứ ${i + 1}`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
        />
      ))}
    </div>
  );
}
