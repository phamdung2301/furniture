/**
 * API module quản trị — FR-026 · F-020 · F-017 · US-015 · US-016.
 *
 * Contract (khớp AdminStatsController backend — admin-dashboard.md §10):
 *   GET /admin/stats/overview
 *     -> { revenueToday, revenueTodayChangePct, revenueMonth,
 *          revenueMonthChangePct, newOrdersToday, newOrdersChangePct,
 *          pendingOrders, newCustomersToday, newCustomersChangePct,
 *          lowStockCount }
 *   GET /admin/stats/revenue?range=day|week|month
 *     -> [{ label, revenue, completedOrders }]
 *   GET /admin/stats/orders-by-status -> [{ status, count }]
 *   GET /admin/stats/revenue-by-category
 *     -> [{ categoryId, categoryName, revenue }] (giảm dần)
 *   GET /admin/stats/top-products -> [{ productId, name, image, soldQty, revenue }]
 *   GET /admin/stats/recent-orders
 *     -> [{ orderNumber, customerName, customerPhone, total, status, createdAt }]
 *   GET /admin/inventory/low-stock
 *     -> [{ variantId, productName, color, sku, image, stock, lowStockThreshold }]
 *
 * Quy ước doanh thu (F-020): chỉ tính đơn HOÀN THÀNH (+ COD đã thu).
 * Mọi endpoint /admin/** yêu cầu role ADMIN (401/403 xử lý ở trang).
 *
 * Khi backend chưa sẵn sàng, dùng mock đúng số liệu spec admin-dashboard.md.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { mockAllProducts } from '../mocks/homeMock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function adminError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** Chuẩn hóa lỗi axios thật -> { code } để component xử lý như mock. */
function normalizeRealError(e) {
  const status = e?.response?.status;
  const data = e?.response?.data;
  const code =
    status === 401
      ? 'unauthorized'
      : status === 403
        ? 'forbidden'
        : data?.code || (e?.code === 'ERR_NETWORK' ? 'network' : 'unknown');
  const message =
    data?.message || 'Không tải được dữ liệu. Kiểm tra kết nối và thử lại.';
  return adminError(code, message);
}

async function callApi(fn) {
  try {
    return await fn();
  } catch (e) {
    throw normalizeRealError(e);
  }
}

const productImage = (id) =>
  mockAllProducts.find((p) => p.id === id)?.images?.[0]?.url || '';

/* ------------------------- Mock data (spec §2–§8) ------------------------- */

const MOCK_OVERVIEW = {
  revenueToday: 4250000,
  revenueTodayChangePct: 12.5,
  revenueMonth: 128400000,
  revenueMonthChangePct: 8.3,
  newOrdersToday: 7,
  newOrdersChangePct: 16.7,
  pendingOrders: 12,
  newCustomersToday: 3,
  newCustomersChangePct: -25.0,
  lowStockCount: 4,
};

/** Doanh thu 7 ngày gần nhất đúng spec §3; các ngày trước đó sinh tất định. */
function mockRevenueDay() {
  const known = {
    '06/10': { revenue: 3200000, completedOrders: 5 },
    '07/10': { revenue: 4800000, completedOrders: 7 },
    '08/10': { revenue: 2900000, completedOrders: 4 },
    '09/10': { revenue: 5600000, completedOrders: 8 },
    '10/10': { revenue: 7400000, completedOrders: 11 },
    '11/10': { revenue: 9100000, completedOrders: 13 },
    '12/10': { revenue: 4250000, completedOrders: 6 },
  };
  const out = [];
  const today = new Date(2026, 9, 12); // 12/10/2026 — "hôm nay" theo dữ liệu mẫu
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (known[label]) {
      out.push({ label, ...known[label] });
    } else {
      // Sinh tất định theo ngày để số liệu ổn định giữa các lần tải.
      const seed = d.getDate() * 31 + d.getMonth() * 7;
      const revenue = 1800000 + ((seed * 977) % 4200000);
      out.push({ label, revenue, completedOrders: 2 + (seed % 7) });
    }
  }
  return out;
}

function mockRevenueWeek() {
  return [
    { label: 'Tuần 30', revenue: 18400000, completedOrders: 26 },
    { label: 'Tuần 31', revenue: 21900000, completedOrders: 31 },
    { label: 'Tuần 32', revenue: 19750000, completedOrders: 28 },
    { label: 'Tuần 33', revenue: 24300000, completedOrders: 35 },
    { label: 'Tuần 34', revenue: 22100000, completedOrders: 30 },
    { label: 'Tuần 35', revenue: 26800000, completedOrders: 38 },
    { label: 'Tuần 36', revenue: 25400000, completedOrders: 34 },
    { label: 'Tuần 37', revenue: 28900000, completedOrders: 40 },
    { label: 'Tuần 38', revenue: 27600000, completedOrders: 37 },
    { label: 'Tuần 39', revenue: 30100000, completedOrders: 42 },
    { label: 'Tuần 40', revenue: 31200000, completedOrders: 44 },
    { label: 'Tuần 41', revenue: 28650000, completedOrders: 39 },
  ];
}

function mockRevenueMonth() {
  return [
    { label: 'Tháng 11', revenue: 64200000, completedOrders: 88 },
    { label: 'Tháng 12', revenue: 78500000, completedOrders: 104 },
    { label: 'Tháng 1', revenue: 59800000, completedOrders: 79 },
    { label: 'Tháng 2', revenue: 71300000, completedOrders: 95 },
    { label: 'Tháng 3', revenue: 82600000, completedOrders: 110 },
    { label: 'Tháng 4', revenue: 76900000, completedOrders: 101 },
    { label: 'Tháng 5', revenue: 88400000, completedOrders: 116 },
    { label: 'Tháng 6', revenue: 93200000, completedOrders: 122 },
    { label: 'Tháng 7', revenue: 89700000, completedOrders: 118 },
    { label: 'Tháng 8', revenue: 101500000, completedOrders: 131 },
    { label: 'Tháng 9', revenue: 118600000, completedOrders: 149 },
    // Tháng này khớp KPI §2 (128.400.000đ) và số đơn hoàn thành ở donut §4 (86).
    { label: 'Tháng 10', revenue: 128400000, completedOrders: 86 },
  ];
}

const MOCK_ORDERS_BY_STATUS = [
  { status: 'MỚI', count: 5 },
  { status: 'ĐÃ XÁC NHẬN', count: 7 },
  { status: 'ĐANG GIAO', count: 9 },
  { status: 'HOÀN THÀNH', count: 86 },
  { status: 'ĐÃ HỦY', count: 6 },
  { status: 'HOÀN TRẢ', count: 2 },
];

// Tổng khớp KPI doanh thu tháng: 128.400.000đ (spec §5).
const MOCK_REVENUE_BY_CATEGORY = [
  { categoryId: 'c1', categoryName: 'Sofa', revenue: 52300000 },
  { categoryId: 'c2', categoryName: 'Bàn ăn', revenue: 38100000 },
  { categoryId: 'c3', categoryName: 'Giường ngủ', revenue: 24900000 },
  { categoryId: 'c4', categoryName: 'Tủ & Kệ', revenue: 8300000 },
  { categoryId: 'c8', categoryName: 'Đèn & Decor', revenue: 4800000 },
];

const MOCK_TOP_PRODUCTS = [
  { productId: 'p1', name: 'Sofa góc L Nordic', soldQty: 3, revenue: 38700000 },
  { productId: 'p2', name: 'Giường ngủ gỗ sồi 1m8', soldQty: 3, revenue: 23700000 },
  { productId: 'p15', name: 'Bàn ăn gỗ óc chó 6 chỗ', soldQty: 3, revenue: 20700000 },
  { productId: 'p5', name: 'Ghế ăn bọc vải', soldQty: 12, revenue: 17400000 },
  { productId: 'p22', name: 'Đèn bàn gốm', soldQty: 5, revenue: 4450000 },
];

const MOCK_RECENT_ORDERS = [
  { orderNumber: 'NT-20261012-0007', customerName: 'Nguyễn Văn An', customerPhone: '0901234567', total: 4250000, status: 'MỚI', createdAt: '2026-10-12T08:15:00+07:00' },
  { orderNumber: 'NT-20261012-0006', customerName: 'Trần Thị Bình', customerPhone: '0912345678', total: 1450000, status: 'MỚI', createdAt: '2026-10-12T07:52:00+07:00' },
  { orderNumber: 'NT-20261012-0005', customerName: 'Lê Hoàng Cường', customerPhone: '0923456789', total: 12900000, status: 'ĐÃ XÁC NHẬN', createdAt: '2026-10-12T07:30:00+07:00' },
  { orderNumber: 'NT-20261011-0018', customerName: 'Phạm Thu Dung', customerPhone: '0934567890', total: 2900000, status: 'ĐANG GIAO', createdAt: '2026-10-11T21:14:00+07:00' },
  { orderNumber: 'NT-20261011-0017', customerName: 'Võ Minh Đức', customerPhone: '0945678901', total: 890000, status: 'HOÀN THÀNH', createdAt: '2026-10-11T20:03:00+07:00' },
  { orderNumber: 'NT-20261011-0016', customerName: 'Đặng Ngọc Anh', customerPhone: '0956789012', total: 7900000, status: 'ĐÃ XÁC NHẬN', createdAt: '2026-10-11T18:47:00+07:00' },
  { orderNumber: 'NT-20261011-0015', customerName: 'Bùi Thanh Hà', customerPhone: '0967890123', total: 3380000, status: 'MỚI', createdAt: '2026-10-11T17:26:00+07:00' },
  { orderNumber: 'NT-20261011-0014', customerName: 'Ngô Quang Huy', customerPhone: '0978901234', total: 5560000, status: 'ĐÃ HỦY', createdAt: '2026-10-11T16:40:00+07:00' },
];

// 4 variant sắp hết đúng spec §8 (sắp xếp theo tồn tăng dần).
const MOCK_LOW_STOCK = [
  { variantId: 'v31', productName: 'Bàn trà gỗ sồi', color: 'Nâu óc chó', sku: 'BT-GS-NAU', productId: 'p3', stock: 0, lowStockThreshold: 5 },
  { variantId: 'v12', productName: 'Sofa góc L Nordic', color: 'Be', sku: 'SF-NOR-BE', productId: 'p1', stock: 2, lowStockThreshold: 5 },
  { variantId: 'v53', productName: 'Ghế ăn bọc vải', color: 'Đen', sku: 'GA-BV-DEN', productId: 'p5', stock: 3, lowStockThreshold: 5 },
  { variantId: 'v221', productName: 'Đèn bàn gốm', color: 'Trắng', sku: 'DB-GOM-TRANG', productId: 'p22', stock: 4, lowStockThreshold: 5 },
];

/* ------------------------------ Public API ------------------------------ */

/** KPI tổng quan — FR-026 / F-020. */
export async function getStatsOverview() {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return { ...MOCK_OVERVIEW };
  }
  return callApi(async () => (await axiosClient.get('/admin/stats/overview')).data);
}

/**
 * Chuỗi doanh thu theo kỳ — FR-026 / F-020.
 * @param {'day'|'week'|'month'} range — day: 30 ngày, week: 12 tuần, month: 12 tháng.
 */
export async function getRevenueSeries(range = 'day') {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    if (range === 'week') return mockRevenueWeek();
    if (range === 'month') return mockRevenueMonth();
    return mockRevenueDay();
  }
  return callApi(
    async () => (await axiosClient.get('/admin/stats/revenue', { params: { range } })).data
  );
}

/** Số đơn theo trạng thái (tháng này) — FR-026. */
export async function getOrdersByStatus() {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return MOCK_ORDERS_BY_STATUS.map((s) => ({ ...s }));
  }
  return callApi(async () => (await axiosClient.get('/admin/stats/orders-by-status')).data);
}

/** Doanh thu theo danh mục (tháng này, giảm dần) — FR-026 / US-016. */
export async function getRevenueByCategory() {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return MOCK_REVENUE_BY_CATEGORY.map((c) => ({ ...c }));
  }
  return callApi(
    async () => (await axiosClient.get('/admin/stats/revenue-by-category')).data
  );
}

/** Top sản phẩm bán chạy (tháng này) — FR-026 / US-016. */
export async function getTopProducts(limit = 5) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return MOCK_TOP_PRODUCTS.slice(0, limit).map((p) => ({
      ...p,
      image: productImage(p.productId),
    }));
  }
  return callApi(
    async () =>
      (await axiosClient.get('/admin/stats/top-products', { params: { limit } })).data
  );
}

/** 8 đơn mới nhất — FR-022 (hỗ trợ điều hướng sang QL Đơn hàng). */
export async function getRecentOrders() {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return MOCK_RECENT_ORDERS.map((o) => ({ ...o }));
  }
  return callApi(async () => (await axiosClient.get('/admin/stats/recent-orders')).data);
}

/** Variant sắp hết hàng (stock <= ngưỡng) — FR-023 / F-017 / US-015. */
export async function getLowStock(limit = 5) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return MOCK_LOW_STOCK.slice(0, limit).map((v) => ({
      ...v,
      image: productImage(v.productId),
    }));
  }
  return callApi(
    async () =>
      (await axiosClient.get('/admin/inventory/low-stock', { params: { limit } })).data
  );
}
