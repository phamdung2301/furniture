import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import SearchPage from './pages/SearchPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import PaymentPage from './pages/PaymentPage';
import WishlistPage from './pages/WishlistPage';
import FlashSalePage from './pages/FlashSalePage';
import OrderListPage from './pages/OrderListPage';
import OrderDetailPage from './pages/OrderDetailPage';
import AccountPage from './pages/AccountPage';
import ProfileTab from './pages/account/ProfileTab';
import AddressTab from './pages/account/AddressTab';
import PasswordTab from './pages/account/PasswordTab';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminInventoryPage from './pages/admin/AdminInventoryPage';
import AdminVouchersPage from './pages/admin/AdminVouchersPage';
import AdminCustomersPage from './pages/admin/AdminCustomersPage';
import AdminBannersPage from './pages/admin/AdminBannersPage';
import AdminPromoPage from './pages/admin/AdminPromoPage';
import './index.css';
import './components.css';
import './product.css';
import './cart.css';
import './auth.css';
import './checkout.css';
import './payment.css';
import './wishlist.css';
import './flashsale.css';
import './orders.css';
import './account.css';
import './admin.css';
import './admin-products.css';
import './admin-categories.css';
import './admin-orders.css';
import './admin-inventory.css';
import './admin-vouchers.css';
import './admin-customers.css';
import './admin-banners.css';
import './admin-promo.css';

/**
 * Ghi chú production: BrowserRouter cần server fallback mọi path về index.html
 * (Spring Boot: thêm controller forward:/{path} -> /index.html khi serve frontend tĩnh).
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('theme') === 'dark'
  );
  const [toast, setToast] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const notify = useCallback((msg) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const pageProps = {
    darkMode,
    onToggleDark: () => setDarkMode((v) => !v),
    onToast: notify,
  };

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage {...pageProps} />} />
        <Route path="/danh-muc/:slug" element={<CategoryPage {...pageProps} />} />
        <Route path="/tim-kiem" element={<SearchPage {...pageProps} />} />
        <Route path="/san-pham/:slug" element={<ProductDetailPage {...pageProps} />} />
        <Route path="/gio-hang" element={<CartPage {...pageProps} />} />
        <Route path="/dat-hang" element={<CheckoutPage {...pageProps} />} />
        <Route path="/dat-hang/thanh-cong" element={<OrderSuccessPage {...pageProps} />} />
        <Route path="/thanh-toan" element={<PaymentPage {...pageProps} />} />
        <Route path="/yeu-thich" element={<WishlistPage {...pageProps} />} />
        <Route path="/flash-sale" element={<FlashSalePage {...pageProps} />} />
        <Route path="/don-hang" element={<OrderListPage {...pageProps} />} />
        <Route path="/don-hang/:orderNumber" element={<OrderDetailPage {...pageProps} />} />
        <Route path="/tai-khoan" element={<AccountPage {...pageProps} />}>
          <Route index element={<ProfileTab />} />
          <Route path="dia-chi" element={<AddressTab />} />
          <Route path="doi-mat-khau" element={<PasswordTab />} />
        </Route>
        {/* Khu vực quản trị (màn 14–22) — AdminLayout tự guard role ADMIN.
            Màn 15 (Sản phẩm) + 16 (Danh mục) + 17 (Đơn hàng) + 18 (Tồn kho)
            + 19 (Voucher) + 20 (Khách hàng) + 21 (Banner)
            + 22 (Flash sale & Phí ship) đã có trang thật — đủ 22 màn. */}
        <Route path="/admin" element={<AdminLayout onToast={notify} />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="san-pham" element={<AdminProductsPage />} />
          <Route path="danh-muc" element={<AdminCategoriesPage />} />
          <Route path="don-hang" element={<AdminOrdersPage />} />
          <Route path="ton-kho" element={<AdminInventoryPage />} />
          <Route path="voucher" element={<AdminVouchersPage />} />
          <Route path="khach-hang" element={<AdminCustomersPage />} />
          <Route path="banner" element={<AdminBannersPage />} />
          <Route path="khuyen-mai" element={<AdminPromoPage />} />
        </Route>
        <Route path="/dang-nhap" element={<LoginPage {...pageProps} />} />
        <Route path="/dang-ky" element={<LoginPage {...pageProps} />} />
        <Route path="/quen-mat-khau" element={<ForgotPasswordPage {...pageProps} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <div className={`toast${toast ? ' show' : ''}`} role="status">
        {toast}
      </div>
    </BrowserRouter>
  );
}
