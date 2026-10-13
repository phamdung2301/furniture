/**
 * Tab Đổi mật khẩu — /tai-khoan/doi-mat-khau (spec ho-so.md §4).
 * F-010: mật khẩu mới >= 8 ký tự; sai mật khẩu hiện tại -> message riêng
 * ngay dưới field (user đã đăng nhập nên tách lỗi được, khác luồng login).
 * Tài khoản Google (hasPassword=false): form rút gọn "Tạo mật khẩu".
 */
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { changePassword } from '../../api/userApi';

/** Độ mạnh: độ dài + trộn chữ hoa/thường/số/ký tự đặc biệt. */
function passwordStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { level: 1, label: 'Yếu', cls: 'pw-meter__fill--weak' };
  if (score === 3) return { level: 2, label: 'Trung bình', cls: 'pw-meter__fill--medium' };
  return { level: 3, label: 'Mạnh', cls: 'pw-meter__fill--strong' };
}

function PasswordField({ label, value, onChange, error, autoComplete, onBlur }) {
  const [show, setShow] = useState(false);
  return (
    <label className="co-field">
      <span className="co-field__label">
        {label} <span className="co-field__req" aria-hidden="true">*</span>
      </span>
      <span className="account-pw-wrap">
        <input
          className={`co-input${error ? ' co-input--error' : ''}`}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="account-pw-toggle"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {show ? '🙈' : '👁️'}
        </button>
      </span>
      {error && (
        <span className="co-field__error" role="alert">{error}</span>
      )}
    </label>
  );
}

export default function PasswordTab() {
  const { profile, setProfile, onToast, locked } = useOutletContext();
  const hasPassword = profile.hasPassword !== false;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [logoutOthers, setLogoutOthers] = useState(false);
  const [saving, setSaving] = useState(false);

  const strength = passwordStrength(next);

  const validate = () => {
    const errs = {};
    if (hasPassword && !current) errs.current = 'Vui lòng nhập mật khẩu hiện tại.';
    if (!next) errs.next = 'Vui lòng nhập mật khẩu mới.';
    else if (next.length < 8) errs.next = 'Mật khẩu cần ít nhất 8 ký tự.';
    else if (hasPassword && current && next === current)
      errs.next = 'Mật khẩu mới cần khác mật khẩu hiện tại.';
    if (!confirm) errs.confirm = 'Vui lòng nhập lại mật khẩu mới.';
    else if (confirm !== next) errs.confirm = 'Mật khẩu nhập lại chưa khớp.';
    return errs;
  };

  const formValid =
    (!hasPassword || current.length > 0) &&
    next.length >= 8 &&
    confirm === next &&
    (!hasPassword || next !== current);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      await changePassword(hasPassword ? current : null, next, logoutOthers);
      setCurrent('');
      setNext('');
      setConfirm('');
      setErrors({});
      if (!hasPassword) {
        setProfile((p) => ({ ...p, hasPassword: true }));
        onToast?.('Đã tạo mật khẩu.');
      } else {
        onToast?.('Đã đổi mật khẩu.');
      }
    } catch (err) {
      if (err?.code === 'wrong_current') {
        // Message riêng dưới field mật khẩu hiện tại — không dùng message chung.
        setErrors({ current: 'Mật khẩu hiện tại chưa đúng.' });
      } else if (err?.code === 'same_password') {
        setErrors({ next: 'Mật khẩu mới cần khác mật khẩu hiện tại.' });
      } else if (err?.code === 'weak_password') {
        setErrors({ next: 'Mật khẩu cần ít nhất 8 ký tự.' });
      } else {
        onToast?.('Có lỗi xảy ra, vui lòng thử lại.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="account-h2">Đổi mật khẩu</h2>
      <p className="account-sub">
        {hasPassword
          ? 'Đổi mật khẩu đăng nhập cho tài khoản của bạn.'
          : 'Tạo mật khẩu để đăng nhập thêm bằng số điện thoại/email.'}
      </p>

      {!hasPassword && (
        <div className="auth-banner auth-banner--yellow" role="status">
          <p>Bạn đang đăng nhập bằng Google nên chưa có mật khẩu.</p>
        </div>
      )}

      <fieldset disabled={locked} className="account-fieldset">
        <form onSubmit={handleSubmit} noValidate>
          {hasPassword && (
            <PasswordField
              label="Mật khẩu hiện tại"
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value);
                if (errors.current) setErrors((s) => ({ ...s, current: '' }));
              }}
              error={errors.current}
              autoComplete="current-password"
            />
          )}

          <PasswordField
            label="Mật khẩu mới"
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              if (errors.next) setErrors((s) => ({ ...s, next: '' }));
            }}
            error={errors.next}
            autoComplete="new-password"
          />
          {next && strength && (
            <div className="pw-meter" aria-live="polite">
              <div className="pw-meter__track">
                <div
                  className={`pw-meter__fill ${strength.cls}`}
                  style={{ width: `${(strength.level / 3) * 100}%` }}
                />
              </div>
              <span className="pw-meter__label">
                Độ mạnh: {strength.label}. Dùng ít nhất 8 ký tự, gồm chữ, số và ký tự đặc biệt.
              </span>
            </div>
          )}

          <PasswordField
            label="Nhập lại mật khẩu mới"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (errors.confirm) setErrors((s) => ({ ...s, confirm: '' }));
            }}
            error={errors.confirm}
            autoComplete="new-password"
          />

          {hasPassword && (
            <label className="co-check account-check">
              <input
                type="checkbox"
                checked={logoutOthers}
                onChange={(e) => setLogoutOthers(e.target.checked)}
              />
              Đăng xuất khỏi các thiết bị khác sau khi đổi mật khẩu
            </label>
          )}

          <div className="account-form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!formValid || saving}
            >
              {saving && <span className="btn-spinner" aria-hidden="true" />}
              {hasPassword ? 'Đổi mật khẩu' : 'Tạo mật khẩu'}
            </button>
          </div>
        </form>
      </fieldset>
    </div>
  );
}
