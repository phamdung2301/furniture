import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Bài học insuren (vụ 404 /claims): mọi backend path PHẢI có entry proxy ở đây.
// Thêm endpoint backend mới => thêm proxy entry + verify nó đã nằm trong file.
const BACKEND = 'http://localhost:8080';
const proxyPaths = [
  '/admin',
  '/auth',
  '/addresses',
  '/otp',
  '/products',
  '/categories',
  '/banners',
  '/cart',
  '/orders',
  '/payments',
  '/vouchers',
  '/reviews',
  '/uploads',
  '/wishlist',
  '/flash-sale',
  '/users',
  '/addresses',
  '/shipping',
  '/reports',
];

// Bài học 2026-10-13 (vụ 403 /admin): vài route TRANG của frontend dùng chung
// prefix với API backend (/admin, /flash-sale). Khi truy cập trực tiếp bằng URL,
// bookmark hoặc reload, Vite thấy path khớp proxy key và chuyển request sang
// backend thay vì trả index.html cho React Router -> backend 403.
const FRONTEND_PAGES = [
  '/admin',
  '/admin/san-pham',
  '/admin/danh-muc',
  '/admin/don-hang',
  '/admin/ton-kho',
  '/admin/voucher',
  '/admin/khach-hang',
  '/admin/banner',
  '/admin/khuyen-mai',
  '/flash-sale',
];

function spaBypass(req) {
  const path = (req.url || '').split('?')[0];
  if (FRONTEND_PAGES.includes(path)) return '/index.html';
}

const proxy = {};
for (const p of proxyPaths) {
  proxy[p] = { target: BACKEND, changeOrigin: true, bypass: spaBypass };
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy,
  },
});
