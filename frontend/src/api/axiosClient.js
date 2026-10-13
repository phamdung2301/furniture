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

export default axiosClient;
