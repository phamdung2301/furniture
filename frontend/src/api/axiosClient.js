import axios from 'axios';

// Bài học insuren: baseURL fallback '' để dev dùng Vite proxy,
// production set VITE_API_BASE_URL trỏ thẳng backend.
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401/403 → token hết hạn hoặc không đủ quyền: xóa auth, về trang đăng nhập.
// Vụ dashboard /admin 2026-10-16: JWT 24h hết hạn, backend trả 403, frontend không
// xử lý nên user 'treo' trên trang chết mà không biết. Không redirect khi đang ở
// sẵn trang đăng nhập để tránh loop.
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('mocan_user');
      if (!window.location.pathname.startsWith('/dang-nhap')) {
        window.location.href = '/dang-nhap';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
