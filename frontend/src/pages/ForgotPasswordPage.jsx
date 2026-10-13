import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { forgotPassword } from '../api/authApi';
import { useCartCount } from '../hooks/useCartCount';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Quên mật khẩu — spec §5 / F-010 (mở rộng).
 * Form email -> màn xác nhận đã gửi. Link đặt lại (30 phút) thuộc backend/email,
 * trang đặt mật khẩu mới là màn riêng (TODO khi backend có /auth/reset-password).
 */
export default function ForgotPasswordPage({ darkMode, onToggleDark, onToast }) {
  const navigate = useNavigate();
  const cartCount = useCartCount();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const em = email.trim();
    if (!EMAIL_RE.test(em)) {
      setFieldError('Vui lòng nhập đúng địa chỉ email.');
      return;
    }
    setFieldError('');
    setLoading(true);
    try {
      await forgotPassword(em);
      setSent(true);
    } catch (err) {
      onToast?.(err?.message || 'Không gửi được email. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

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
          <Link to="/dang-nhap">Đăng nhập</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Quên mật khẩu</span>
        </nav>

        <div className="auth-layout auth-layout--single">
          <section className="auth-card" aria-label="Quên mật khẩu">
            <button
              type="button"
              className="auth-close"
              onClick={() => navigate(-1)}
              aria-label="Đóng"
            >
              ×
            </button>

            {sent ? (
              <div className="auth-success">
                <div className="auth-success__icon" aria-hidden="true">✉️</div>
                <h1 className="auth-title">Đã gửi email đặt lại mật khẩu</h1>
                <p className="auth-subtitle">
                  Vui lòng kiểm tra hộp thư <strong>{email.trim()}</strong> (kể cả thư rác)
                  và làm theo hướng dẫn trong email. Link có hiệu lực trong 30 phút.
                </p>
                <Link to="/dang-nhap" className="btn btn-primary auth-submit">
                  Quay lại đăng nhập
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <h1 className="auth-title">Quên mật khẩu?</h1>
                <p className="auth-subtitle">
                  Nhập email bạn đã đăng ký — chúng tôi sẽ gửi link đặt lại mật khẩu.
                </p>

                <div className="auth-field">
                  <label htmlFor="forgot-email">Email</label>
                  <div className={`auth-inputwrap${fieldError ? ' auth-inputwrap--error' : ''}`}>
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      placeholder="email@vidu.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldError('');
                      }}
                      aria-invalid={Boolean(fieldError)}
                    />
                  </div>
                  {fieldError && (
                    <p className="auth-error" role="alert">{fieldError}</p>
                  )}
                </div>

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                  {loading && <span className="btn-spinner" aria-hidden="true" />}
                  {loading ? 'Đang gửi…' : 'Gửi link đặt lại'}
                </button>

                <p className="auth-switch">
                  <Link to="/dang-nhap" className="linklike">← Quay lại đăng nhập</Link>
                </p>
              </form>
            )}
          </section>
        </div>
      </main>

      <Footer onToast={onToast} />
    </div>
  );
}
