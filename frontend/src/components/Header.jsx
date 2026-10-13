import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBox from './SearchBox';
import MiniCartDrawer from './MiniCartDrawer';
import { useAuth } from '../hooks/useAuth';
import { useWishlistCount } from '../hooks/useWishlistCount';

/**
 * Top strip + Header sticky + Nav danh mục — §2.1–§2.3 spec.
 * Logo "Mộc An" là TẠM (brand chưa chốt).
 */
const NAV_ITEMS = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Sofa', href: '/danh-muc/sofa' },
  { label: 'Bàn ăn', href: '/danh-muc/ban-an' },
  { label: 'Giường ngủ', href: '/danh-muc/giuong-ngu' },
  { label: 'Tủ & Kệ', href: '/danh-muc/tu-ke' },
  { label: 'Bàn làm việc', href: '/danh-muc/ban-lam-viec' },
  { label: 'Đèn & Decor', href: '/danh-muc/den-decor' },
  { label: '⚡ Flash sale', href: '/flash-sale', hot: true },
  { label: 'Khuyến mãi', href: '/khuyen-mai' },
];

export default function Header({
  cartCount = 0,
  userName = null,
  darkMode,
  onToggleDark,
  onToast,
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();
  const wishlistCount = useWishlistCount();
  const displayName = user?.fullName || userName;
  const avatarLetter = displayName ? displayName.trim().charAt(0).toUpperCase() : '';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Dropdown avatar: đóng khi click ngoài hoặc bấm Esc (spec ho-so.md §6).
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const goFromMenu = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout(); // clearSession() — giữ nguyên giỏ/wishlist local (spec ho-so.md §6)
    navigate('/');
    onToast?.('Đã đăng xuất. Hẹn gặp lại bạn!');
  };

  const soon = (name) => onToast?.(`${name} sẽ có ở màn tiếp theo`);

  return (
    <>
      <div className="topstrip">
        <span>🚚 Miễn phí vận chuyển cho đơn hàng từ 10.000.000đ</span>
        <span className="topstrip__right">Hotline: 1900 6868 · Hệ thống cửa hàng</span>
      </div>

      <header className={`site-header${scrolled ? ' site-header--shadow' : ''}`}>
        <div className="container site-header__inner">
          <Link to="/" className="logo" aria-label="Mộc An — trang chủ">
            <span className="logo__name">Mộc An</span>
            <span className="logo__tag">NỘI THẤT</span>
          </Link>

          <SearchBox onToast={onToast} />

          <div className="header-actions">
            <button
              className="icon-btn mobile-only"
              onClick={() => setMobileSearch((v) => !v)}
              aria-label="Tìm kiếm"
            >
              🔍
            </button>
            <button
              className="icon-btn"
              onClick={onToggleDark}
              aria-label={darkMode ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            {isLoggedIn ? (
              <div className="account-wrap" ref={menuRef}>
                <button
                  className="icon-btn icon-btn--labeled"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={`Tài khoản của ${displayName || 'bạn'}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  {user?.avatarUrl ? (
                    <img
                      className="account-avatar account-avatar--img"
                      src={user.avatarUrl}
                      alt=""
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="account-avatar" aria-hidden="true">{avatarLetter}</span>
                  )}
                  <span className="icon-btn__label">{displayName || 'Tài khoản'}</span>
                </button>
                {menuOpen && (
                  <div className="account-dropdown" role="menu">
                    <div className="account-dropdown__head">
                      <strong>{displayName || 'Tài khoản'}</strong>
                      {user?.email && <span>{user.email}</span>}
                    </div>
                    <button
                      type="button"
                      className="account-dropdown__item"
                      role="menuitem"
                      onClick={() => goFromMenu('/tai-khoan')}
                    >
                      👤 Hồ sơ cá nhân
                    </button>
                    <button
                      type="button"
                      className="account-dropdown__item"
                      role="menuitem"
                      onClick={() => goFromMenu('/don-hang')}
                    >
                      📦 Đơn hàng của tôi
                    </button>
                    <button
                      type="button"
                      className="account-dropdown__item"
                      role="menuitem"
                      onClick={() => goFromMenu('/yeu-thich')}
                    >
                      🤍 Sản phẩm yêu thích
                    </button>
                    <div className="account-dropdown__divider" aria-hidden="true" />
                    <button
                      type="button"
                      className="account-dropdown__item account-dropdown__item--danger"
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="icon-btn icon-btn--labeled"
                onClick={() => navigate('/dang-nhap')}
                aria-label="Đăng nhập"
              >
                <span aria-hidden="true">👤</span>
                <span className="icon-btn__label">Tài khoản</span>
              </button>
            )}
            <button
              className="icon-btn icon-btn--labeled"
              onClick={() => navigate('/yeu-thich')}
              aria-label="Sản phẩm yêu thích"
            >
              <span aria-hidden="true">🤍</span>
              <span className="icon-btn__label">Yêu thích</span>
              {wishlistCount > 0 && <span className="count-badge">{wishlistCount}</span>}
            </button>
            <button className="icon-btn icon-btn--labeled" onClick={() => setCartOpen(true)} aria-label="Mở giỏ hàng">
              <span aria-hidden="true">🛒</span>
              <span className="icon-btn__label">Giỏ hàng</span>
              {cartCount > 0 && <span className="count-badge">{cartCount}</span>}
            </button>
          </div>
        </div>

        {mobileSearch && (
          <div className="container mobile-search">
            <SearchBox onToast={onToast} autoFocus id="mobile-search" />
          </div>
        )}

        <nav className="main-nav" aria-label="Danh mục sản phẩm">
          <div className="container main-nav__inner">
            {NAV_ITEMS.map((item) => {
              const isRoute = item.href === '/' || item.href.startsWith('/danh-muc');
              if (!isRoute) {
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`main-nav__link${item.hot ? ' main-nav__link--hot' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      soon(item.label.replace('⚡ ', ''));
                    }}
                  >
                    {item.label}
                  </a>
                );
              }
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`main-nav__link${item.hot ? ' main-nav__link--hot' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <MiniCartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onToast={onToast} />
    </>
  );
}
