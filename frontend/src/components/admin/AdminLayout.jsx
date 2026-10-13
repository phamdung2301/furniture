import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getOrdersByStatus, getStatsOverview } from '../../api/adminApi';
import ForbiddenPage from './ForbiddenPage';

/**
 * Layout quản trị dùng chung màn 14–22 — admin-dashboard.md §A:
 * sidebar 240px nền --brand-900 + topbar sticky + <Outlet/>.
 * Tablet: sidebar 72px chỉ icon · Mobile: drawer hamburger.
 * Guard: chưa login → /dang-nhap?returnTo=<route admin>; role != ADMIN → 403.
 */

const Icon = ({ d, size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  product: (
    <>
      <path d="M21 8.5v7a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 15.5v-7a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4a2 2 0 0 1 1 1.73Z" />
      <path d="M3.3 8.3 12 13l8.7-4.7" />
      <path d="M12 13v9" />
    </>
  ),
  category: (
    <>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </>
  ),
  order: (
    <>
      <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  inventory: (
    <>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 10v10h14V10" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  voucher: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2.5 2.5 0 0 0 0 5v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-5Z" />
      <path d="M13 6v2m0 3v2m0 3v2" />
    </>
  ),
  customer: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 5.9M18.4 15.4c1.2.9 2 2.4 2.3 4.6" />
    </>
  ),
  banner: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m5 19 5.5-5.5 3 3L17 13l2 2" />
    </>
  ),
  flash: <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5Z" />,
  store: (
    <>
      <path d="M4 7 5.5 3h13L20 7" />
      <path d="M4 7h16v3a2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.2 0A2.7 2.7 0 0 1 4 10Z" />
      <path d="M5.5 12.5V21h13v-8.5" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </>
  ),
};

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/san-pham', label: 'Sản phẩm', icon: 'product' },
  { to: '/admin/danh-muc', label: 'Danh mục', icon: 'category' },
  { to: '/admin/don-hang', label: 'Đơn hàng', icon: 'order', badge: 'newOrders' },
  { to: '/admin/ton-kho', label: 'Tồn kho', icon: 'inventory', badge: 'lowStock' },
  { to: '/admin/voucher', label: 'Voucher', icon: 'voucher' },
  { to: '/admin/khach-hang', label: 'Khách hàng', icon: 'customer' },
  { to: '/admin/banner', label: 'Banner', icon: 'banner' },
  { to: '/admin/khuyen-mai', label: 'Flash sale & Phí ship', icon: 'flash' },
];

const TITLES = [
  ['/admin/san-pham', 'Sản phẩm'],
  ['/admin/danh-muc', 'Danh mục'],
  ['/admin/don-hang', 'Đơn hàng'],
  ['/admin/ton-kho', 'Tồn kho'],
  ['/admin/voucher', 'Voucher'],
  ['/admin/khach-hang', 'Khách hàng'],
  ['/admin/banner', 'Banner'],
  ['/admin/khuyen-mai', 'Flash sale & Phí ship'],
  ['/admin', 'Tổng quan'],
];

function titleFor(pathname) {
  const found = TITLES.find(([prefix]) => pathname.startsWith(prefix));
  return found ? found[1] : 'Tổng quan';
}

export default function AdminLayout({ onToast }) {
  const { user, isLoggedIn, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [badges, setBadges] = useState({ newOrders: 0, lowStock: 0 });
  const menuRef = useRef(null);

  const isAdmin = Boolean(user?.roles?.includes('ROLE_ADMIN'));
  const title = useMemo(() => titleFor(location.pathname), [location.pathname]);

  // Badge sidebar: số đơn MỚI + số variant sắp hết (ẩn khi = 0). Lỗi thì ẩn badge.
  // Tải lại khi đổi route, và khi có màn con báo dữ liệu đã đổi (VD màn Tồn kho
  // điều chỉnh tồn xong dispatch 'mocan:badges-refresh' — admin-ton-kho.md §5.5/§6).
  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return undefined;
    let cancelled = false;
    const loadBadges = () => {
      Promise.allSettled([getOrdersByStatus(), getStatsOverview()]).then(([st, ov]) => {
        if (cancelled) return;
        const newOrders =
          st.status === 'fulfilled'
            ? st.value.find((s) => s.status === 'MỚI')?.count || 0
            : 0;
        const lowStock = ov.status === 'fulfilled' ? ov.value.lowStockCount || 0 : 0;
        setBadges({ newOrders, lowStock });
      });
    };
    loadBadges();
    window.addEventListener('mocan:badges-refresh', loadBadges);
    return () => {
      cancelled = true;
      window.removeEventListener('mocan:badges-refresh', loadBadges);
    };
  }, [isLoggedIn, isAdmin, location.pathname]);

  // Đóng drawer khi đổi route (mobile).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Đóng dropdown user khi click ra ngoài / Esc.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!isLoggedIn) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/dang-nhap?returnTo=${returnTo}`} replace />;
  }
  if (!isAdmin) {
    return <ForbiddenPage />;
  }

  const handleLogout = () => {
    logout();
    navigate('/dang-nhap');
  };

  const handleQuickSearch = (e) => {
    e.preventDefault();
    const q = quickSearch.trim();
    if (!q) return;
    // Mã đơn NT-… → QL Đơn hàng; còn lại → QL Sản phẩm (§A.3).
    if (/^NT-/i.test(q)) {
      navigate(`/admin/don-hang?q=${encodeURIComponent(q)}`);
    } else {
      navigate(`/admin/san-pham?q=${encodeURIComponent(q)}`);
    }
    setQuickSearch('');
  };

  const initials = (user?.fullName || 'Q')
    .split(' ')
    .filter(Boolean)
    .slice(-1)[0]
    ?.charAt(0)
    .toUpperCase();

  const sidebar = (
    <div className="admin-sidebar__inner">
      <Link to="/admin" className="admin-brand">
        <span className="admin-brand__name">Mộc An</span>
        <span className="admin-brand__sub">QUẢN TRỊ</span>
      </Link>
      <nav className="admin-nav" aria-label="Menu quản trị">
        {NAV_ITEMS.map((item) => {
          const badgeCount =
            item.badge === 'newOrders'
              ? badges.newOrders
              : item.badge === 'lowStock'
                ? badges.lowStock
                : 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav__item${isActive ? ' is-active' : ''}`}
              title={item.label}
            >
              <Icon d={ICONS[item.icon]} />
              <span className="admin-nav__label">{item.label}</span>
              {badgeCount > 0 ? (
                <span
                  className={`admin-nav__badge${item.badge === 'lowStock' ? ' is-warning' : ''}`}
                >
                  {badgeCount}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>
      <div className="admin-sidebar__foot">
        <Link to="/" className="admin-nav__item">
          <Icon d={ICONS.store} />
          <span className="admin-nav__label">Xem cửa hàng</span>
        </Link>
        <button type="button" className="admin-nav__item" onClick={handleLogout}>
          <Icon d={ICONS.logout} />
          <span className="admin-nav__label">Đăng xuất</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-shell">
      {/* Sidebar desktop/tablet */}
      <aside className="admin-sidebar">{sidebar}</aside>

      {/* Drawer mobile */}
      {drawerOpen ? (
        <div
          className="admin-drawer-overlay"
          onMouseDown={() => setDrawerOpen(false)}
          role="presentation"
        >
          <aside
            className="admin-sidebar admin-sidebar--drawer"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-icon-btn admin-topbar__burger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Mở menu"
          >
            <Icon d={ICONS.menu} />
          </button>
          <div className="admin-topbar__title-wrap">
            <h1 className="admin-topbar__title">{title}</h1>
            <nav className="admin-breadcrumb" aria-label="Breadcrumb">
              Quản trị / {title}
            </nav>
          </div>

          <form className="admin-quicksearch" onSubmit={handleQuickSearch} role="search">
            <Icon d={ICONS.search} size={16} />
            <input
              type="search"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Tìm đơn theo mã, sản phẩm, khách hàng…"
              aria-label="Tìm kiếm nhanh"
            />
          </form>

          <div className="admin-user" ref={menuRef}>
            <button
              type="button"
              className="admin-user__btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="admin-user__avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="admin-user__meta">
                <span className="admin-user__name">{user?.fullName || 'Quản trị viên'}</span>
                <span className="admin-user__role">Quản trị viên</span>
              </span>
            </button>
            {menuOpen ? (
              <div className="admin-user__menu" role="menu">
                <Link to="/tai-khoan" role="menuitem" onClick={() => setMenuOpen(false)}>
                  Hồ sơ của tôi
                </Link>
                <Link to="/" role="menuitem" onClick={() => setMenuOpen(false)}>
                  Xem cửa hàng
                </Link>
                <button type="button" role="menuitem" onClick={handleLogout}>
                  Đăng xuất
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="admin-content">
          <Outlet context={{ onToast }} />
        </main>
      </div>
    </div>
  );
}
