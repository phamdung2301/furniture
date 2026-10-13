/**
 * Tab Hồ sơ cá nhân — /tai-khoan (spec ho-so.md §2).
 * FR-015 · F-011 · FR-030 · F-024.
 * - Sửa họ tên (Lưu chỉ bật khi có thay đổi), email read-only (F-010: email
 *   là định danh đăng nhập, docs không có luồng đổi email).
 * - SĐT read-only + badge xác thực; xác thực/đổi số bằng panel OTP ngay
 *   trong tab (tái dùng OtpInput + authApi của màn 6, luật F-024).
 * - Ảnh đại diện [Giả định]: field avatarUrl, chọn ảnh -> preview + tự lưu.
 */
import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import OtpInput from '../../components/OtpInput';
import { sendOtp, verifyOtp, isMockMode, DEMO_OTP } from '../../api/authApi';
import { updateProfile, changePhone, syncPhoneVerified } from '../../api/userApi';
import { formatPhoneDisplay } from '../AccountPage';

const PHONE_RE = /^0\d{9}$/;
const OTP_SECONDS = 60; // gửi lại sau 60s — F-024
const OTP_TTL_MS = 300 * 1000; // mã hết hạn sau 5 phút — F-024
const OTP_MAX_FAILS = 5;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB [Giả định]
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProfileTab() {
  const { profile, setProfile, onToast, locked } = useOutletContext();
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [panel, setPanel] = useState(null); // null | 'verify' | 'change'
  const fileRef = useRef(null);

  const nameDirty = fullName.trim() !== (profile.fullName || '');

  const validateName = (value) => {
    const name = value.trim();
    if (!name) return 'Vui lòng nhập họ tên.';
    if (name.length < 2) return 'Họ tên cần từ 2 ký tự.';
    if (name.length > 50) return 'Họ tên tối đa 50 ký tự.';
    return '';
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    const err = validateName(fullName);
    setNameError(err);
    if (err || !nameDirty) return;
    setSavingName(true);
    try {
      const updated = await updateProfile({ fullName: fullName.trim() });
      setProfile(updated);
      setFullName(updated.fullName);
      onToast?.('Đã lưu thay đổi.');
    } catch (saveErr) {
      onToast?.(saveErr?.message || 'Không lưu được thay đổi. Vui lòng thử lại.');
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      onToast?.('Ảnh cần là file JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      onToast?.('Ảnh tối đa 2MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }
    const previous = profile.avatarUrl;
    try {
      const dataUrl = await readAsDataUrl(file);
      setProfile((p) => ({ ...p, avatarUrl: dataUrl })); // preview ngay
      setAvatarBusy(true);
      const updated = await updateProfile({ avatarUrl: dataUrl });
      setProfile(updated);
      onToast?.('Đã cập nhật ảnh đại diện.');
    } catch {
      setProfile((p) => ({ ...p, avatarUrl: previous }));
      onToast?.('Không lưu được ảnh. Vui lòng thử lại.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    const previous = profile.avatarUrl;
    setProfile((p) => ({ ...p, avatarUrl: null }));
    setAvatarBusy(true);
    try {
      const updated = await updateProfile({ avatarUrl: '' });
      setProfile(updated);
      onToast?.('Đã xóa ảnh đại diện.');
    } catch {
      setProfile((p) => ({ ...p, avatarUrl: previous }));
      onToast?.('Không xóa được ảnh. Vui lòng thử lại.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleVerified = async () => {
    try {
      const updated = await syncPhoneVerified();
      setProfile((p) => ({ ...p, ...updated, phoneVerified: true }));
    } catch {
      setProfile((p) => ({ ...p, phoneVerified: true }));
    }
    setPanel(null);
    onToast?.('Số điện thoại đã được xác thực.');
  };

  const handlePhoneChanged = (updated) => {
    setProfile(updated);
    setPanel(null);
    onToast?.('Đã đổi số điện thoại.');
  };

  const avatarLetter = (profile.fullName || '').trim().charAt(0).toUpperCase();

  return (
    <div>
      <h2 className="account-h2">Hồ sơ cá nhân</h2>
      <p className="account-sub">Thông tin tài khoản và xác thực số điện thoại.</p>

      <fieldset disabled={locked} className="account-fieldset">
        {/* ---------- Ảnh đại diện [Giả định] ---------- */}
        <div className="account-avatar-block">
          <div className="account-avatar-wrap">
            {profile.avatarUrl ? (
              <img className="account-avatar-xl" src={profile.avatarUrl} alt="Ảnh đại diện" />
            ) : (
              <span className="account-avatar-xl account-avatar-xl--letter" aria-hidden="true">
                {avatarLetter}
              </span>
            )}
            {avatarBusy && <span className="btn-spinner account-avatar-spin" aria-hidden="true" />}
          </div>
          <div className="account-avatar-actions">
            <button
              type="button"
              className="btn btn-secondary account-btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
            >
              Đổi ảnh
            </button>
            {profile.avatarUrl && (
              <button
                type="button"
                className="linklike linklike--danger"
                onClick={handleRemoveAvatar}
                disabled={avatarBusy}
              >
                Xóa ảnh
              </button>
            )}
            <span className="account-hint">JPG, PNG hoặc WebP, tối đa 2MB.</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={handleAvatarFile}
          />
        </div>

        {/* ---------- Form thông tin ---------- */}
        <form onSubmit={handleSaveName} noValidate>
          <label className="co-field">
            <span className="co-field__label">
              Họ tên <span className="co-field__req" aria-hidden="true">*</span>
            </span>
            <input
              className={`co-input${nameError ? ' co-input--error' : ''}`}
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (nameError) setNameError('');
              }}
              onBlur={() => setNameError(validateName(fullName))}
              placeholder="VD: Nguyễn Minh Anh"
              autoComplete="name"
            />
            {nameError && (
              <span className="co-field__error" role="alert">{nameError}</span>
            )}
          </label>

          <label className="co-field">
            <span className="co-field__label">Email</span>
            <input className="co-input" value={profile.email || ''} readOnly />
            <span className="account-note">
              Email dùng để đăng nhập. Nếu cần đổi email, vui lòng liên hệ hotline 1900 6868.
            </span>
          </label>

          <div className="co-field">
            <span className="co-field__label">Số điện thoại</span>
            <div className="account-phone-row">
              <span className="account-phone-num">
                {formatPhoneDisplay(profile.phone)}
              </span>
              {profile.phoneVerified ? (
                <>
                  <span className="badge badge-new">Đã xác thực</span>
                  <button
                    type="button"
                    className="linklike linklike--strong"
                    onClick={() => setPanel(panel === 'change' ? null : 'change')}
                  >
                    Đổi số
                  </button>
                </>
              ) : (
                <>
                  <span className="badge badge-warn">Chưa xác thực</span>
                  <button
                    type="button"
                    className="btn btn-primary account-btn-sm"
                    onClick={() => setPanel(panel === 'verify' ? null : 'verify')}
                  >
                    Xác thực ngay
                  </button>
                </>
              )}
            </div>

            {panel === 'verify' && (
              <PhoneOtpPanel
                key="verify"
                mode="verify"
                targetPhone={profile.phone}
                onVerified={handleVerified}
                onCancel={() => setPanel(null)}
                onToast={onToast}
              />
            )}
            {panel === 'change' && (
              <PhoneOtpPanel
                key="change"
                mode="change"
                targetPhone={profile.phone}
                onChanged={handlePhoneChanged}
                onCancel={() => setPanel(null)}
                onToast={onToast}
              />
            )}
          </div>

          <div className="account-form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!nameDirty || savingName}
            >
              {savingName && <span className="btn-spinner" aria-hidden="true" />}
              Lưu thay đổi
            </button>
          </div>
        </form>
      </fieldset>
    </div>
  );
}

/**
 * Panel OTP trong tab Hồ sơ — luật F-024 như màn 6: mã 6 số, gửi lại sau
 * 60s, hết hạn 5 phút, sai tối đa 5 lần thì hủy mã.
 * mode 'verify': gửi mã về SĐT hiện tại, đúng mã -> onVerified().
 * mode 'change': nhập SĐT mới -> gửi mã về số mới -> changePhone kèm mã.
 */
function PhoneOtpPanel({ mode, targetPhone, onVerified, onChanged, onCancel, onToast }) {
  const [newPhone, setNewPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [sent, setSent] = useState(mode === 'verify');
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(OTP_SECONDS);
  const [expired, setExpired] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(OTP_MAX_FAILS);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [round, setRound] = useState(0);
  const verifyingRef = useRef(false);
  const phoneForOtp = mode === 'verify' ? targetPhone : newPhone.trim();

  // Mở panel 'verify' -> gửi mã ngay về SĐT hiện tại.
  useEffect(() => {
    if (mode !== 'verify') return undefined;
    let active = true;
    (async () => {
      try {
        await sendOtp(targetPhone, 'verify-phone');
      } catch (err) {
        if (active) setError(err?.message || 'Không gửi được mã. Vui lòng thử lại.');
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đếm ngược gửi lại + hết hạn — chạy mỗi vòng gửi mã (round/sent thay đổi).
  useEffect(() => {
    if (!sent) return undefined;
    setCountdown(OTP_SECONDS);
    setExpired(false);
    const tick = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    const ttl = setTimeout(() => setExpired(true), OTP_TTL_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(ttl);
    };
  }, [round, sent]);

  const handleSendForChange = async () => {
    const phone = newPhone.trim();
    if (!PHONE_RE.test(phone)) {
      setPhoneError('Số điện thoại gồm 10 số, bắt đầu bằng 0.');
      return;
    }
    if (phone === targetPhone) {
      setPhoneError('Số điện thoại mới trùng với số hiện tại.');
      return;
    }
    setPhoneError('');
    setSending(true);
    setError('');
    try {
      await sendOtp(phone, 'change-phone');
      setSent(true);
      setRound((r) => r + 1);
      onToast?.('Đã gửi mã xác thực đến số điện thoại mới.');
    } catch (err) {
      // VD: SĐT đã thuộc tài khoản khác (409) — hiện message ngay tại panel.
      setError(err?.message || 'Không gửi được mã. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  const handleInvalidCode = (err) => {
    const left = attemptsLeft - 1;
    setAttemptsLeft(left);
    if (left <= 0) {
      setError('Bạn đã nhập sai quá 5 lần. Mã này đã bị hủy — vui lòng bấm Gửi lại mã để nhận mã mới.');
    } else if (err?.code === 'otp_invalid' || err?.code === 'invalid') {
      setError(`Mã xác thực chưa đúng. Bạn còn ${left} lần thử.`);
    } else {
      setError(err?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  const verify = async (otpCode) => {
    if (verifyingRef.current || expired || attemptsLeft <= 0) return;
    verifyingRef.current = true;
    setVerifying(true);
    setError('');
    try {
      if (mode === 'verify') {
        await verifyOtp(targetPhone, otpCode, 'verify-phone');
        onVerified?.();
      } else {
        const updated = await changePhone(phoneForOtp, otpCode);
        onChanged?.(updated);
      }
    } catch (err) {
      const code = String(err?.code || '').toLowerCase();
      if (code === 'phone_used' || code === 'phone_exists') {
        // F-024 edge: SĐT mới đã được tài khoản khác xác thực — giữ panel mở.
        setError(err.message);
      } else if (code === 'network') {
        setError('Không có kết nối mạng. Vui lòng thử lại.');
      } else {
        handleInvalidCode(err);
      }
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const resend = async () => {
    try {
      await sendOtp(phoneForOtp, mode === 'verify' ? 'verify-phone' : 'change-phone');
      setAttemptsLeft(OTP_MAX_FAILS);
      setError('');
      setCode('');
      setRound((r) => r + 1);
      onToast?.('Đã gửi lại mã xác thực.');
    } catch (err) {
      onToast?.(err?.message || 'Không gửi được mã. Vui lòng thử lại.');
    }
  };

  const canceled = attemptsLeft <= 0;

  return (
    <div className="account-otp-panel">
      {mode === 'change' && !sent && (
        <>
          <p className="account-otp-text">
            Nhập số điện thoại mới. Mã xác thực sẽ được gửi về số mới —
            đổi số xong số điện thoại được xác thực lại (F-024).
          </p>
          <div className="account-otp-row">
            <input
              className={`co-input${phoneError ? ' co-input--error' : ''}`}
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10));
                if (phoneError) setPhoneError('');
              }}
              placeholder="VD: 0912345678"
              inputMode="numeric"
              autoComplete="tel"
            />
            <button
              type="button"
              className="btn btn-primary account-btn-sm"
              onClick={handleSendForChange}
              disabled={sending}
            >
              {sending && <span className="btn-spinner" aria-hidden="true" />}
              Gửi mã xác thực
            </button>
          </div>
          {phoneError && (
            <span className="co-field__error" role="alert">{phoneError}</span>
          )}
        </>
      )}

      {sent && (
        <>
          <p className="account-otp-text">
            Chúng tôi đã gửi mã 6 số đến <strong>{formatPhoneDisplay(phoneForOtp)}</strong>.
            Nhập mã để {mode === 'verify' ? 'xác thực số điện thoại' : 'hoàn tất đổi số'}.
          </p>
          {isMockMode() && (
            <p className="auth-demo-hint">Mã demo: <strong>{DEMO_OTP}</strong></p>
          )}
          <OtpInput
            onComplete={verify}
            onChange={setCode}
            disabled={verifying || canceled || expired}
            resetKey={round}
          />
          {(error || expired) && (
            <div
              className={`auth-banner ${expired && !canceled ? 'auth-banner--yellow' : 'auth-banner--red'} account-otp-banner`}
              role="alert"
            >
              {expired && !canceled && (
                <p>Mã đã hết hạn. Vui lòng bấm Gửi lại mã để nhận mã mới.</p>
              )}
              {error && <p>{error}</p>}
            </div>
          )}
          <div className="account-otp-actions">
            <button
              type="button"
              className="btn btn-primary account-btn-sm"
              disabled={verifying || code.length !== 6 || canceled || expired}
              onClick={() => verify(code)}
            >
              {verifying && <span className="btn-spinner" aria-hidden="true" />}
              {verifying ? 'Đang xác thực…' : 'Xác nhận'}
            </button>
            <span className="auth-resend">
              {countdown > 0 ? (
                <>Gửi lại sau {countdown}s</>
              ) : (
                <button type="button" className="linklike linklike--strong" onClick={resend}>
                  Gửi lại mã
                </button>
              )}
            </span>
          </div>
        </>
      )}

      <div className="account-otp-cancel">
        <button type="button" className="linklike" onClick={onCancel}>
          Hủy
        </button>
      </div>
    </div>
  );
}
