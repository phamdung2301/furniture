/**
 * API module màn Trang chủ — F-001.
 *
 * Contract (khớp HomeController backend):
 *   GET /banners?active=true              -> Banner[]
 *   GET /categories/featured              -> Category[] (tối đa 8)
 *   GET /products/featured                -> Product[] (featured=true, active)
 *   GET /products/best-sellers            -> Product[] (theo soldCount 30 ngày)
 *   GET /products/newest                  -> Product[] (theo createdAt desc)
 *
 * Khi backend chưa sẵn sàng, dùng mock data có SHAPE Y HỆT response thật
 * (theo 02-ERD.md). Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import {
  mockBanners,
  mockCategories,
  mockFeaturedProducts,
  mockBestSellers,
  mockNewestProducts,
} from '../mocks/homeMock';
import { attachFlashSale } from '../mocks/flashSaleMock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withMock(promiseFn, mockData) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return mockData;
  }
  const { data } = await promiseFn();
  return data;
}

export async function getBanners() {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    // Kho mock dùng chung với màn Quản lý banner (adminBannerApi thao tác
    // trực tiếp trên mockBanners): phía khách chỉ lấy banner đang hiện,
    // xếp theo sortOrder — sửa/tắt ở admin thấy ngay ở trang chủ.
    return mockBanners
      .filter((b) => b.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((b) => ({ ...b }));
  }
  const { data } = await axiosClient.get('/banners', { params: { active: true } });
  return data;
}

export function getFeaturedCategories() {
  return withMock(() => axiosClient.get('/categories/featured'), mockCategories);
}

export function getFeaturedProducts() {
  return withMock(
    () => axiosClient.get('/products/featured'),
    mockFeaturedProducts.map(attachFlashSale)
  );
}

export function getBestSellers() {
  return withMock(
    () => axiosClient.get('/products/best-sellers'),
    mockBestSellers.map(attachFlashSale)
  );
}

export function getNewestProducts() {
  return withMock(
    () => axiosClient.get('/products/newest'),
    mockNewestProducts.map(attachFlashSale)
  );
}
