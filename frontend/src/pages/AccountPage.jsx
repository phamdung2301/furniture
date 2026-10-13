/**
 * Khu vực tài khoản — route /tai-khoan (+ /dia-chi, /doi-mat-khau).
 * FR-015 · F-010 · F-011 (spec ho-so.md §1, §5, §6).
 * Sidebar trái: định danh + menu; cột phải render tab qua <Outlet/>.
 * Chưa login -> /dang-nhap?returnTo=<route đích> (pattern màn 6).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCartCount } from '../hooks/useCartCount';
import { useAuth } from '../hooks/useAuth';
import { isLoggedIn } from '../utils/auth';
import { getProfile } from '../api/userApi';

const MENU = [
  { to: '/tai-khoan', label: 'Hồ sơ cá nhân', icon: '👤', end: true },
  { to: '/tai-khoan/dia-chi', label: 'Sổ địa chỉ', icon: '📍' },
  { to: '/tai-khoan/doi-mat-khau', label: 'Đổi mật khẩu', icon: '🔒' },
  { to: '/don-hang', label: 'Đơn hàng của tôi', icon: '📦' },
  { to: '/yeu-thich', label: 'Sản phẩm yêu thích', icon: '🤍' },
];

const TAB_TITLES = {
  '/tai-khoan': 'Hồ sơ cá nhân',
  '/tai-khoan/dia-chi': 'Sổ địa chỉ',
  '/tai-khoan/doi-mat-khau': 'Đổi mật khẩu',
};

/** Hiển thị SĐT dạng 0901 234 567. */
export function formatPhoneDisplay(phone) {
  if (!phone) return '';
  return phone.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
}

function AccountSkeleton() {
  return (
    <div className="account-layout" aria-label="Đang tải thông tin tài khoản">
      <aside className="account-side account-card">
        <div className="account-id">
          <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 13, width: '50%' }} />
          </div>
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 20, margin: '14px 0' }} />
        ))}
      </aside>
      <section className="account-main account-card">
        <div className="skeleton" style={{ height: 24, width: '35%', marginBottom: 20 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 44, marginBottom: 16 }} />
        ))}
      </section>
    </div>
  );
}

export default function AccountPage({ darkMode, onToggleDark, onToast }) {
  const cartCount = useCartCount();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const loggedIn = isLoggedIn();

  useEffect(() => {
    if (!loggedIn) {
      navigate(`/dang-nhap?returnTo=${encodeURIComponent(location.pathname)}`, {
        replace: true,
      });
    }
  }, [loggedIn, location.pathname, navigate]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await getProfile();
      setProfile(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (loggedIn) load();
  }, [loggedIn, load]);

  const handleLogout = useCallback(() => {
    logout(); // clearSession() sẵn có — KHÔNG xóa giỏ/wishlist local (spec §6)
    navigate('/');
    onToast?.('Đã đăng xuất. Hẹn gặp lại bạn!');
  }, [logout, navigate, onToast]);

  if (!loggedIn) return null;

  const locked = profile?.status === 'LOCKED';
  const tabTitle = TAB_TITLES[location.pathname] || 'Hồ sơ cá nhân';
  const avatarLetter = profile?.fullName?.trim().charAt(0).toUpperCase() || '';

  const outletContext = {
    profile,
    setProfile,
    onToast,
    locked,
    reloadProfile: load,
  };

  return (
    <>
      <Header
        cartCount={cartCount}
        darkMode={darkMode}
        onToggleDark={onToggleDark}
        onToast={onToast}
      />
      <main className="container">
        <nav className="account-crumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span>Tài khoản</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{tabTitle}</span>
        </nav>

        {status === 'loading' && <AccountSkeleton />}

        {status === 'error' && (
          <div className="account-layout">
            <section className="account-main account-card">
              <div className="auth-banner auth-banner--red" role="alert">
                <p>Không tải được thông tin. Vui lòng thử lại.</p>
              </div>
              <button type="button" className="btn btn-primary" onClick={load}>
                Thử lại
              </button>
            </section>
          </div>
        )}

        {status === 'ready' && profile && (
          <>
            {locked && (
              <div className="auth-banner auth-banner--yellow account-locked" role="alert">
                <p>
                  Tài khoản của bạn đang bị khóa. Vui lòng liên hệ hotline 1900 6868
                  để được hỗ trợ.
                </p>
              </div>
            )}
            <div className="account-layout">
              <aside className="account-side account-card">
                <div className="account-id">
                  {profile.avatarUrl ? (
                    <img
                      className="account-avatar-img"
                      src={profile.avatarUrl}
                      alt="Ảnh đại diện"
                    />
                  ) : (
                    <span className="account-avatar-lg" aria-hidden="true">
                      {avatarLetter}
                    </span>
                  )}
                  <div className="account-id__text">
                    <strong>{profile.fullName}</strong>
                    <span>{formatPhoneDisplay(profile.phone)}</span>
                    {profile.phoneVerified ? (
                      <span className="badge badge-new">Đã xác thực</span>
                    ) : (
                      <span className="badge badge-warn">Chưa xác thực</span>
                    )}
                  </div>
                </div>

                <nav className="account-menu" aria-label="Menu tài khoản">
                  {MENU.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `account-menu__item${isActive ? ' account-menu__item--active' : ''}`
                      }
                    >
                      <span aria-hidden="true">{item.icon}</span>
                      {item.label}
                    </NavLink>
                  ))}
                </nav>

                <button
                  type="button"
                  className="account-logout account-logout--side"
                  onClick={handleLogout}
                >
                  Đăng xuất
                </button>
              </aside>

              <section className="account-main account-card">
                <Outlet context={outletContext} />
                <button
                  type="button"
                  className="account-logout account-logout--mobile"
                  onClick={handleLogout}
                >
                  Đăng xuất
                </button>
              </section>
            </div>
          </>
        )}
      </main>
      <Footer onToast={onToast} />
    </>
  );
}
