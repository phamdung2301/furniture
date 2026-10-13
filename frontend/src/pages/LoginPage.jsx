import { useEffect, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import OtpInput from '../components/OtpInput';
import {
  sendOtp,
  verifyOtp,
  loginPassword,
  register,
  googleLogin,
  isMockMode,
  DEMO_OTP,
} from '../api/authApi';
import { setSession, isLoggedIn } from '../utils/auth';
import { useAuth } from '../hooks/useAuth';
import { useCartCount } from '../hooks/useCartCount';
import { mergeCartAfterLogin } from '../api/cartApi';
import { mergeWishlistAfterLogin } from '../api/wishlistApi';

/**
 * Màn Đăng nhập / Đăng ký / Xác thực SĐT — spec ui-specs/dang-nhap-otp.md
 * §1–§5: F-010, F-024, FR-008, FR-009, FR-014, FR-030, US-006, US-020.
 * Route: /dang-nhap (tab SĐT/mật khẩu) · /dang-ky (tab đăng ký) — chung 1 component.
 * View OTP nằm trong trang này (spec cho phép modal toàn màn).
 */

const PHONE_RE = /^0(3|5|7|8|9)\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_SECONDS = 60;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_FAILS = 5;

/** Chống open redirect: chỉ chấp nhận path nội bộ tuyệt đối. */
function sanitizeReturnTo(v) {
  if (typeof v !== 'string' || v.length === 0) return '/';
  if (!v.startsWith('/') || v.includes('//') || v.includes('\\')) return '/';
  return v;
}

/** Prefix +84 hiển thị — value nhập liệu vẫn là dạng 0xxxxxxxxx (đúng spec §2a). */
function formatDisplayPhone(phone) {
  return phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');
}

function Spinner() {
  return <span className="btn-spinner" aria-hidden="true" />;
}

export default function LoginPage({ darkMode, onToggleDark, onToast }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));
  const cartCount = useCartCount();
  const { isLoggedIn: alreadyLoggedIn } = useAuth();

  const [tab, setTab] = useState(() =>
    location.pathname === '/dang-ky' ? 'register' : 'phone'
  );
  const [view, setView] = useState('form'); // form | otp | googlePhone
  const [otpCtx, setOtpCtx] = useState(null); // { phone, purpose, registered? }
  const [pendingGoogle, setPendingGoogle] = useState(null);
  // Giữ SĐT đã nhập ở tab SĐT khi chuyển sang tab Đăng ký qua banner vàng.
  const [regPhonePrefill, setRegPhonePrefill] = useState('');

  // Sync tab khi đổi route (vd: bấm link /dang-ky từ banner vàng).
  useEffect(() => {
    setTab(location.pathname === '/dang-ky' ? 'register' : 'phone');
    setView('form');
    setOtpCtx(null);
  }, [location.pathname]);

  const switchTab = (next) => {
    setTab(next);
    setView('form');
    setOtpCtx(null);
    navigate(next === 'register' ? '/dang-ky' : '/dang-nhap', { replace: true });
  };

  const rememberRef = useRef(true);

  /** Điểm chung sau khi có phiên hợp lệ: gộp giỏ + gộp wishlist -> chuyển về returnTo. */
  const finishLogin = async (token, user, remember = true) => {
    setSession(token, user, remember);
    try {
      await mergeCartAfterLogin(onToast);
      await mergeWishlistAfterLogin(onToast);
    } catch {
      // Gộp giỏ/wishlist lỗi không được chặn đăng nhập.
    }
    const dest =
      returnTo === '/' && user?.roles?.includes('ROLE_ADMIN') ? '/admin' : returnTo;
    navigate(dest, { replace: true });
  };

  const goOtpView = (phone, purpose, extra = {}) => {
    setOtpCtx({ phone, purpose, ...extra });
    setView('otp');
  };

  // Đã đăng nhập mà vào -> về trang chủ.
  // TODO(wave-3 ho-so): khi có màn Hồ sơ, đổi redirect thành /tai-khoan.
  if (alreadyLoggedIn) {
    return <Navigate to="/" replace />;
  }

  const closeTo = () => navigate(-1);

  return (
    <div className="auth-page">
      <Header
        cartCount={cartCount}
        darkMode={darkMode}
        onToggleDark={onToggleDark}
        onToast={onToast}
      />

      <main className="container auth-main">
        <nav className="auth-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{tab === 'register' ? 'Đăng ký' : 'Đăng nhập'}</span>
        </nav>

        <div className="auth-layout">
          <section className="auth-card" aria-label={tab === 'register' ? 'Đăng ký' : 'Đăng nhập'}>
            <button type="button" className="auth-close" onClick={closeTo} aria-label="Đóng">
              ×
            </button>

            {view === 'otp' && otpCtx ? (
              <OtpVerifyView
                ctx={otpCtx}
                onBack={() => setView('form')}
                onVerified={(token, user) => {
                  onToast?.('Xác thực thành công! Giờ bạn có thể đặt hàng.');
                  if (otpCtx.pendingGoogle) {
                    const g = otpCtx.pendingGoogle;
                    finishLogin(g.token, { ...g.user, phone: otpCtx.phone, phoneVerified: true });
                  } else {
                    finishLogin(token, user);
                  }
                }}
                onToast={onToast}
              />
            ) : view === 'googlePhone' && pendingGoogle ? (
              <GooglePhoneView
                onSend={(phone) => goOtpView(phone, 'verify', { pendingGoogle })}
                onBack={() => {
                  setView('form');
                  setPendingGoogle(null);
                }}
                onToast={onToast}
              />
            ) : (
              <>
                <h1 className="auth-title">
                  {tab === 'register' ? 'Tạo tài khoản mới' : 'Chào mừng trở lại'}
                </h1>
                <p className="auth-subtitle">
                  {tab === 'register'
                    ? 'Đăng ký để đặt hàng nhanh hơn và nhận ưu đãi thành viên.'
                    : 'Đăng nhập để theo dõi đơn hàng và đặt hàng nhanh hơn.'}
                </p>

                <div className="segmented" role="tablist" aria-label="Hình thức đăng nhập">
                  {[
                    { id: 'phone', label: 'Số điện thoại' },
                    { id: 'password', label: 'Mật khẩu' },
                    { id: 'register', label: 'Đăng ký' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.id}
                      className={`segmented__btn${tab === t.id ? ' segmented__btn--active' : ''}`}
                      onClick={() => switchTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {tab === 'phone' && (
                  <PhoneLoginForm
                    onSent={(phone) => goOtpView(phone, 'login')}
                    onNeedRegister={(phone) => {
                      setRegPhonePrefill(phone);
                      switchTab('register');
                    }}
                    onToast={onToast}
                  />
                )}
                {tab === 'password' && (
                  <PasswordLoginForm
                    rememberRef={rememberRef}
                    onSuccess={(token, user, remember) => finishLogin(token, user, remember)}
                    onToast={onToast}
                  />
                )}
                {tab === 'register' && (
                  <RegisterForm
                    prefillPhone={regPhonePrefill}
                    onRegistered={async (user) => {
                      // FR-030: đăng ký xong bắt vào xác thực SĐT, KHÔNG vào thẳng app.
                      try {
                        await sendOtp(user.phone);
                      } catch {
                        onToast?.('Không gửi được mã xác thực. Vui lòng thử gửi lại.');
                      }
                      goOtpView(user.phone, 'register', { registered: true });
                    }}
                    onGoLogin={() => switchTab('password')}
                    onToast={onToast}
                  />
                )}

                {view === 'form' && (
                  <GoogleLoginBlock
                    onToast={onToast}
                    onCancel={() => onToast?.('Bạn đã hủy đăng nhập Google.')}
                    onSuccess={(token, user) => {
                      if (user.phone && user.phoneVerified) {
                        finishLogin(token, user);
                      } else if (user.phone && !user.phoneVerified) {
                        goOtpView(user.phone, 'verify', {
                          pendingGoogle: { token, user },
                        });
                      } else {
                        // F-010: Google OAuth2 xong bổ sung SĐT.
                        setPendingGoogle({ token, user });
                        setView('googlePhone');
                      }
                    }}
                  />
                )}

                <p className="auth-switch">
                  {tab === 'register' ? (
                    <>
                      Đã có tài khoản?{' '}
                      <button type="button" className="linklike" onClick={() => switchTab('phone')}>
                        Đăng nhập
                      </button>
                    </>
                  ) : (
                    <>
                      Chưa có tài khoản?{' '}
                      <button type="button" className="linklike" onClick={() => switchTab('register')}>
                        Đăng ký ngay
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
          </section>

          <aside className="auth-brand" aria-hidden="true">
            <div className="auth-brand__overlay" />
            <div className="auth-brand__content">
              <p className="auth-brand__slogan">Nội thất cho tổ ấm của bạn</p>
              <ul className="auth-brand__benefits">
                <li>📦 Theo dõi đơn hàng mọi lúc</li>
                <li>📍 Sổ địa chỉ giao hàng tiện lợi</li>
                <li>🎁 Nhận ưu đãi dành riêng cho thành viên</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <Footer onToast={onToast} />
    </div>
  );
}

/* ==================== Tab "Số điện thoại" — đăng nhập bằng OTP ==================== */
function PhoneLoginForm({ onSent, onNeedRegister, onToast }) {
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const p = phone.replace(/\s/g, '');
    if (!PHONE_RE.test(p)) {
      setFieldError('Số điện thoại chưa đúng định dạng. Vui lòng nhập 10 chữ số, bắt đầu bằng 0.');
      setNotFound(false);
      return;
    }
    setFieldError('');
    setNotFound(false);
    setLoading(true);
    try {
      await sendOtp(p);
      onSent(p);
    } catch (err) {
      if (err?.code === 'not_found') {
        setNotFound(true);
      } else if (err?.code === 'network') {
        onToast?.('Không có kết nối mạng. Vui lòng thử lại.');
      } else {
        onToast?.(err?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="auth-field">
        <label htmlFor="auth-phone">Số điện thoại</label>
        <div className={`auth-inputwrap${fieldError ? ' auth-inputwrap--error' : ''}`}>
          <span className="auth-prefix" aria-hidden="true">+84</span>
          <input
            id="auth-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="912 345 678"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/[^\d\s]/g, ''));
              setFieldError('');
              setNotFound(false);
            }}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? 'auth-phone-error' : undefined}
          />
        </div>
        {fieldError && (
          <p className="auth-error" id="auth-phone-error" role="alert">{fieldError}</p>
        )}
      </div>

      {notFound && (
        <div className="auth-banner auth-banner--yellow" role="alert">
          <p>Chưa có tài khoản với số điện thoại này.</p>
          <button
            type="button"
            className="linklike linklike--strong"
            onClick={() => onNeedRegister(phone.replace(/\s/g, ''))}
          >
            Đăng ký ngay →
          </button>
        </div>
      )}

      <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
        {loading && <Spinner />}
        {loading ? 'Đang gửi…' : 'Gửi mã xác thực'}
      </button>
    </form>
  );
}

/* ==================== Tab "Mật khẩu" ==================== */
function PasswordLoginForm({ rememberRef, onSuccess, onToast }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [idError, setIdError] = useState('');
  const [passError, setPassError] = useState('');
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    rememberRef.current = remember;
  }, [remember, rememberRef]);

  useEffect(() => {
    if (!lockedUntil || Date.now() >= lockedUntil) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const locked = lockedUntil > Date.now();
  const remaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const remainingText = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  const submit = async (e) => {
    e.preventDefault();
    const id = identifier.trim();
    let ok = true;
    if (!PHONE_RE.test(id) && !EMAIL_RE.test(id)) {
      setIdError('Vui lòng nhập đúng số điện thoại hoặc email.');
      ok = false;
    } else {
      setIdError('');
    }
    if (!password) {
      setPassError('Vui lòng nhập mật khẩu.');
      ok = false;
    } else {
      setPassError('');
    }
    if (!ok) return;

    setBanner('');
    setLoading(true);
    try {
      const { token, user } = await loginPassword(id, password);
      onSuccess(token, user, remember);
    } catch (err) {
      if (err?.code === 'locked') {
        setLockedUntil(err.unlockAt || Date.now() + 15 * 60 * 1000);
        setBanner('Tài khoản tạm khóa 15 phút do nhập sai quá nhiều lần. Vui lòng thử lại sau.');
      } else if (err?.code === 'network') {
        setBanner('Không có kết nối mạng. Vui lòng thử lại.');
      } else {
        setBanner(err?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      {banner && (
        <div className="auth-banner auth-banner--red" role="alert">
          <p>{banner}</p>
          {locked && <p className="auth-banner__sub">Mở khóa sau {remainingText}</p>}
        </div>
      )}

      <div className="auth-field">
        <label htmlFor="auth-identifier">Số điện thoại hoặc email</label>
        <div className={`auth-inputwrap${idError ? ' auth-inputwrap--error' : ''}`}>
          <input
            id="auth-identifier"
            type="text"
            autoComplete="username"
            placeholder="0901234567 hoặc email@vidu.com"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setIdError('');
            }}
            disabled={locked}
            aria-invalid={Boolean(idError)}
          />
        </div>
        {idError && <p className="auth-error" role="alert">{idError}</p>}
      </div>

      <div className="auth-field">
        <label htmlFor="auth-password">Mật khẩu</label>
        <div className={`auth-inputwrap${passError ? ' auth-inputwrap--error' : ''}`}>
          <input
            id="auth-password"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPassError('');
            }}
            disabled={locked}
            aria-invalid={Boolean(passError)}
          />
          <button
            type="button"
            className="auth-eye"
            onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={showPass}
          >
            {showPass ? '🙈' : '👁'}
          </button>
        </div>
        {passError && <p className="auth-error" role="alert">{passError}</p>}
      </div>

      <div className="auth-row">
        <label className="auth-check">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Ghi nhớ đăng nhập</span>
        </label>
        <Link to="/quen-mat-khau" className="linklike">Quên mật khẩu?</Link>
      </div>

      <button type="submit" className="btn btn-primary auth-submit" disabled={loading || locked}>
        {loading && <Spinner />}
        {locked ? `Mở khóa sau ${remainingText}` : loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
    </form>
  );
}

/* ==================== Tab "Đăng ký" — F-010 ==================== */
function RegisterForm({ prefillPhone, onRegistered, onGoLogin, onToast }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(prefillPhone || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [emailExists, setEmailExists] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefillPhone) setPhone(prefillPhone);
  }, [prefillPhone]);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (name.trim().length < 2) errs.name = 'Vui lòng nhập họ tên.';
    const em = email.trim();
    if (!EMAIL_RE.test(em)) errs.email = 'Vui lòng nhập đúng địa chỉ email.';
    const p = phone.replace(/\s/g, '');
    if (!PHONE_RE.test(p)) errs.phone = 'Số điện thoại chưa đúng định dạng. Vui lòng nhập 10 chữ số, bắt đầu bằng 0.';
    if (password.length < 8) errs.password = 'Mật khẩu cần ít nhất 8 ký tự.';
    if (confirm !== password) errs.confirm = 'Mật khẩu nhập lại chưa khớp.';
    setErrors(errs);
    setEmailExists(false);
    if (Object.keys(errs).length > 0 || !agree) return;

    setLoading(true);
    try {
      const { user } = await register({ name: name.trim(), email: em, phone: p, password });
      onRegistered(user);
    } catch (err) {
      if (err?.code === 'email_exists') {
        setEmailExists(true);
      } else if (err?.code === 'phone_used') {
        setErrors({ phone: 'Số điện thoại này đã được dùng cho tài khoản khác. Vui lòng liên hệ hỗ trợ.' });
      } else if (err?.code === 'network') {
        onToast?.('Không có kết nối mạng. Vui lòng thử lại.');
      } else {
        onToast?.(err?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  const field = (id, label, props, error) => (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className={`auth-inputwrap${error ? ' auth-inputwrap--error' : ''}`}>
        <input id={id} {...props} aria-invalid={Boolean(error)} />
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      {field('reg-name', 'Họ tên', {
        type: 'text', autoComplete: 'name', placeholder: 'Nguyễn Văn An',
        value: name, onChange: (e) => { setName(e.target.value); setErrors((s) => ({ ...s, name: '' })); },
      }, errors.name)}

      <div className="auth-field">
        <label htmlFor="reg-email">Email</label>
        <div className={`auth-inputwrap${errors.email || emailExists ? ' auth-inputwrap--error' : ''}`}>
          <input
            id="reg-email" type="email" autoComplete="email" placeholder="email@vidu.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((s) => ({ ...s, email: '' })); setEmailExists(false); }}
            aria-invalid={Boolean(errors.email || emailExists)}
          />
        </div>
        {errors.email && <p className="auth-error" role="alert">{errors.email}</p>}
        {emailExists && (
          <p className="auth-error" role="alert">
            Email này đã được đăng ký.{' '}
            <button type="button" className="linklike" onClick={onGoLogin}>Đăng nhập</button>
          </p>
        )}
      </div>

      <div className="auth-field">
        <label htmlFor="reg-phone">Số điện thoại <span className="auth-required" aria-hidden="true">*</span></label>
        <div className={`auth-inputwrap${errors.phone ? ' auth-inputwrap--error' : ''}`}>
          <span className="auth-prefix" aria-hidden="true">+84</span>
          <input
            id="reg-phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="912 345 678"
            value={phone}
            onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s]/g, '')); setErrors((s) => ({ ...s, phone: '' })); }}
            aria-invalid={Boolean(errors.phone)}
          />
        </div>
        {errors.phone && <p className="auth-error" role="alert">{errors.phone}</p>}
      </div>

      {field('reg-pass', 'Mật khẩu', {
        type: 'password', autoComplete: 'new-password', placeholder: 'Ít nhất 8 ký tự',
        value: password, onChange: (e) => { setPassword(e.target.value); setErrors((s) => ({ ...s, password: '' })); },
      }, errors.password)}

      {field('reg-confirm', 'Nhập lại mật khẩu', {
        type: 'password', autoComplete: 'new-password', placeholder: 'Nhập lại mật khẩu',
        value: confirm, onChange: (e) => { setConfirm(e.target.value); setErrors((s) => ({ ...s, confirm: '' })); },
      }, errors.confirm)}

      <label className="auth-check auth-check--terms">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          Tôi đồng ý với <button type="button" className="linklike" onClick={() => onToast?.('Điều khoản sử dụng sẽ có ở bản đầy đủ')}>Điều khoản sử dụng</button>
          {' '}và <button type="button" className="linklike" onClick={() => onToast?.('Chính sách bảo mật sẽ có ở bản đầy đủ')}>Chính sách bảo mật</button>
        </span>
      </label>

      <button type="submit" className="btn btn-primary auth-submit" disabled={loading || !agree}>
        {loading && <Spinner />}
        {loading ? 'Đang tạo tài khoản…' : 'Đăng ký tài khoản'}
      </button>
    </form>
  );
}

/* ==================== View OTP — §4 / F-024 ==================== */
function OtpVerifyView({ ctx, onBack, onVerified, onToast }) {
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(OTP_SECONDS);
  const [expired, setExpired] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(OTP_MAX_FAILS);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [round, setRound] = useState(0);
  const verifyingRef = useRef(false);

  // Đếm ngược gửi lại + hết hạn 5 phút — reset mỗi lần gửi mã mới.
  useEffect(() => {
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
  }, [round]);

  const verify = async (otpCode) => {
    if (verifyingRef.current || expired || attemptsLeft <= 0) return;
    verifyingRef.current = true;
    setVerifying(true);
    setError('');
    try {
      const { token, user } = await verifyOtp(ctx.phone, otpCode, ctx.purpose);
      onVerified(token, user);
    } catch (err) {
      if (err?.code === 'invalid') {
        const left = attemptsLeft - 1;
        setAttemptsLeft(left);
        if (left <= 0) {
          setError('Bạn đã nhập sai quá 5 lần. Mã này đã bị hủy — vui lòng bấm Gửi lại mã để nhận mã mới.');
        } else {
          setError(`Mã xác thực chưa đúng. Bạn còn ${left} lần thử.`);
        }
      } else if (err?.code === 'network') {
        setError('Không có kết nối mạng. Vui lòng thử lại.');
      } else {
        setError(err?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
      }
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const resend = async () => {
    try {
      await sendOtp(ctx.phone);
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
    <div className="auth-otp">
      <h1 className="auth-title">Xác thực số điện thoại</h1>
      <p className="auth-subtitle">
        Chúng tôi đã gửi mã 6 số đến <strong>{formatDisplayPhone(ctx.phone)}</strong>
        {' '}<button type="button" className="linklike" onClick={onBack}>Đổi số</button>
      </p>

      {ctx.registered && (
        <div className="auth-banner auth-banner--green" role="status">
          <p>Đăng ký thành công! Hãy xác thực số điện thoại để bắt đầu đặt hàng.</p>
        </div>
      )}

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
          className={`auth-banner ${expired || canceled ? (canceled ? 'auth-banner--red' : 'auth-banner--yellow') : 'auth-banner--red'}`}
          role="alert"
        >
          {expired && !canceled && (
            <p>Mã đã hết hạn. Vui lòng bấm Gửi lại mã để nhận mã mới.</p>
          )}
          {error && <p>{error}</p>}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary auth-submit"
        disabled={verifying || code.length !== 6 || canceled || expired}
        onClick={() => verify(code)}
      >
        {verifying && <Spinner />}
        {verifying ? 'Đang xác thực…' : 'Xác nhận'}
      </button>

      <p className="auth-resend">
        {countdown > 0 ? (
          <>Gửi lại sau {countdown}s</>
        ) : (
          <button type="button" className="linklike linklike--strong" onClick={resend}>
            Gửi lại mã
          </button>
        )}
      </p>
    </div>
  );
}

/* ==================== Bổ sung SĐT sau Google — F-010 ==================== */
function GooglePhoneView({ onSend, onBack, onToast }) {
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const p = phone.replace(/\s/g, '');
    if (!PHONE_RE.test(p)) {
      setFieldError('Số điện thoại chưa đúng định dạng. Vui lòng nhập 10 chữ số, bắt đầu bằng 0.');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(p);
      onSend(p);
    } catch (err) {
      if (err?.code === 'network') onToast?.('Không có kết nối mạng. Vui lòng thử lại.');
      else if (err?.code === 'phone_used') {
        setFieldError('Số điện thoại này đã được dùng cho tài khoản khác. Vui lòng liên hệ hỗ trợ.');
      } else onToast?.(err?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="auth-title">Bổ sung số điện thoại</h1>
      <p className="auth-subtitle">
        Để đặt hàng, bạn cần xác thực số điện thoại theo quy định.
      </p>
      <div className="auth-field">
        <label htmlFor="google-phone">Số điện thoại</label>
        <div className={`auth-inputwrap${fieldError ? ' auth-inputwrap--error' : ''}`}>
          <span className="auth-prefix" aria-hidden="true">+84</span>
          <input
            id="google-phone" type="tel" inputMode="numeric" autoComplete="tel"
            placeholder="912 345 678" value={phone}
            onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s]/g, '')); setFieldError(''); }}
          />
        </div>
        {fieldError && <p className="auth-error" role="alert">{fieldError}</p>}
      </div>
      <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
        {loading && <Spinner />}
        {loading ? 'Đang gửi…' : 'Gửi mã xác thực'}
      </button>
      <p className="auth-switch">
        <button type="button" className="linklike" onClick={onBack}>← Quay lại</button>
      </p>
    </form>
  );
}

/* ==================== Đăng nhập Google — FR-014 ==================== */
function GoogleLoginBlock({ onSuccess, onCancel, onToast }) {
  const [connecting, setConnecting] = useState(false);
  const cancelledRef = useRef(false);

  const start = async () => {
    cancelledRef.current = false;
    setConnecting(true);
    try {
      const { token, user } = await googleLogin();
      if (cancelledRef.current) return;
      setConnecting(false);
      onSuccess(token, user);
    } catch (err) {
      if (cancelledRef.current) return;
      setConnecting(false);
      onToast?.(err?.message || 'Không kết nối được Google. Vui lòng thử lại.');
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    setConnecting(false);
    onCancel();
  };

  return (
    <>
      <div className="auth-divider" aria-hidden="true"><span>hoặc</span></div>
      <button type="button" className="btn btn-secondary auth-submit auth-google" onClick={start}>
        <span className="google-g" aria-hidden="true">G</span>
        Tiếp tục với Google
      </button>
      {connecting && (
        <div className="auth-overlay" role="alertdialog" aria-label="Đang kết nối Google">
          <div className="auth-overlay__box">
            <Spinner />
            <p>Đang kết nối Google…</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={cancel}>
              Hủy
            </button>
          </div>
        </div>
      )}
    </>
  );
}
