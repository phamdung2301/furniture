/**
 * API Quản lý đơn hàng (admin) — FR-022 · FR-012 · F-016 (admin-don-hang.md §7).
 *
 * Contract (khớp AdminOrderController backend):
 *   GET   /admin/orders?status=&paymentMethod=&from=&to=&q=&sort=&page=&size=
 *     -> { content: [{ orderNumber, customerName, customerPhone, itemCount,
 *          itemKinds, total, paymentMethod, paymentStatus, status, createdAt }],
 *          totalElements, totalPages, page, size,
 *          statusCounts: { ALL, MOI, DA_XAC_NHAN, DANG_GIAO, HOAN_THANH,
 *                          DA_HUY, HOAN_TRA } }
 *        (statusCounts tính theo các lọc còn lại, bỏ qua chính status — §2.1;
 *         status gửi lên dạng slug §2.5, gồm giá trị đặc biệt "cho-xu-ly")
 *   GET   /admin/orders/{orderNumber}
 *     -> { orderNumber, createdAt, status, statusHistory: [{ status, at, note,
 *          bySystem }], receiver: { name, phone, province, district, ward,
 *          detail }, note, adminNote, trackingCode,
 *          items: [{ image, productName, color, colorHex, sku, price, qty,
 *          areaM2, flashSaleProgramId }], subtotal, discount, voucherCode,
 *          shippingFee, totalAreaM2, total, paymentMethod,
 *          payment: { method, amount, status, providerRef, paidAt } }
 *   PATCH /admin/orders/{orderNumber}/status
 *     — hàm updateStatus(orderNumber, { toStatus, trackingCode?, reason? })
 *       ánh xạ sang wire body { status, trackingCode?, note? } của spec §7.
 *     -> 200 đơn đã cập nhật · 422 { message, currentStatus } khi sai ma trận
 *        FR-012 / thiếu mã vận đơn / thiếu lý do / quá hạn hoàn trả 7 ngày.
 *   PATCH /admin/orders/{orderNumber}/admin-note  body { adminNote } -> 200
 *   PATCH /admin/orders/{orderNumber}/payment-confirm -> 200 · 422 khi không
 *        phải chuyển khoản hoặc đã thanh toán (xác nhận CK thủ công — §3.6).
 *
 * Mock: kho đơn mẫu 10 đơn (8 dòng đầu khớp bảng §2.3 + Dashboard §7, thêm
 * HOÀN TRẢ + Chuyển khoản) — mutable trong phiên: chuyển trạng thái/ghi chú/
 * xác nhận CK cập nhật trực tiếp lên kho để bảng + chi tiết nhất quán.
 * Mock validate ĐÚNG ma trận FR-012 như backend (422 kèm trạng thái hiện tại).
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { normalizeVi } from '../utils/search';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 400;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

function apiError(status, { code = null, message, currentStatus } = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (currentStatus !== undefined) err.currentStatus = currentStatus;
  return err;
}

function normalizeRealError(e) {
  const status = e?.response?.status;
  const data = e?.response?.data || {};
  return apiError(status || 0, {
    code: data.code || (e?.code === 'ERR_NETWORK' ? 'network' : 'unknown'),
    message: data.message || 'Không tải được dữ liệu. Kiểm tra kết nối và thử lại.',
    currentStatus: data.currentStatus,
  });
}

async function callApi(fn) {
  try {
    return await fn();
  } catch (e) {
    throw normalizeRealError(e);
  }
}

/* ------------------------- Hằng số trạng thái ------------------------- */

export const ORDER_STATUSES = [
  'MỚI',
  'ĐÃ XÁC NHẬN',
  'ĐANG GIAO',
  'HOÀN THÀNH',
  'ĐÃ HỦY',
  'HOÀN TRẢ',
];

/** Slug §2.5 <-> enum. "cho-xu-ly" là giá trị đặc biệt (MỚI + ĐÃ XÁC NHẬN). */
export const SLUG_BY_STATUS = {
  'MỚI': 'moi',
  'ĐÃ XÁC NHẬN': 'da-xac-nhan',
  'ĐANG GIAO': 'dang-giao',
  'HOÀN THÀNH': 'hoan-thanh',
  'ĐÃ HỦY': 'da-huy',
  'HOÀN TRẢ': 'hoan-tra',
};
const STATUS_BY_SLUG = Object.fromEntries(
  Object.entries(SLUG_BY_STATUS).map(([k, v]) => [v, k])
);

/** Nhãn Title Case — khớp thuật ngữ màn 11 (dùng trong message lỗi). */
const LABEL_BY_STATUS = {
  'MỚI': 'Mới',
  'ĐÃ XÁC NHẬN': 'Đã xác nhận',
  'ĐANG GIAO': 'Đang giao',
  'HOÀN THÀNH': 'Hoàn thành',
  'ĐÃ HỦY': 'Đã hủy',
  'HOÀN TRẢ': 'Hoàn trả',
};

/** Ma trận chuyển hợp lệ FR-012 (mirror AdminOrderService backend). */
const TRANSITIONS = {
  'MỚI': ['ĐÃ XÁC NHẬN', 'ĐÃ HỦY'],
  'ĐÃ XÁC NHẬN': ['ĐANG GIAO', 'ĐÃ HỦY'],
  'ĐANG GIAO': ['HOÀN THÀNH', 'HOÀN TRẢ'],
  'HOÀN THÀNH': ['HOÀN TRẢ'],
  'ĐÃ HỦY': [],
  'HOÀN TRẢ': [],
};

/** Chuẩn hoá giá trị ?trang-thai= (slug, "cho-xu-ly", hoặc enum thô từ donut Dashboard). */
export function statusSlugFromParam(raw) {
  if (!raw) return 'tat-ca';
  const s = String(raw).trim();
  if (s === 'cho-xu-ly') return 'cho-xu-ly';
  if (STATUS_BY_SLUG[s.toLowerCase()]) return s.toLowerCase();
  if (SLUG_BY_STATUS[s]) return SLUG_BY_STATUS[s];
  const upper = s.toUpperCase();
  if (SLUG_BY_STATUS[upper]) return SLUG_BY_STATUS[upper];
  return 'tat-ca';
}

function statusesForSlug(slug) {
  if (!slug || slug === 'tat-ca') return null;
  if (slug === 'cho-xu-ly') return ['MỚI', 'ĐÃ XÁC NHẬN'];
  return STATUS_BY_SLUG[slug] ? [STATUS_BY_SLUG[slug]] : null;
}

/* ------------------------------ Mock store ------------------------------ */

const item = (o) => ({ flashSaleProgramId: null, ...o });
const hist = (status, at, note, bySystem = false) => ({ status, at, note, bySystem });

/** 10 đơn mẫu — chi tiết NT-20261012-0007 đúng nguyên xi §3.9. */
const mockOrders = [
  {
    orderNumber: 'NT-20261012-0007',
    createdAt: '2026-10-12T08:15:00+07:00',
    status: 'MỚI',
    statusHistory: [hist('MỚI', '2026-10-12T08:15:00+07:00', 'Đã đặt lúc 08:15, 12/10')],
    receiver: {
      name: 'Nguyễn Văn An', phone: '0901234567',
      province: 'TP. Hồ Chí Minh', district: 'Quận 5', ward: 'Phường 5',
      detail: '123 Nguyễn Trãi',
    },
    note: 'Giao giờ hành chính.',
    adminNote: '',
    trackingCode: null,
    items: [
      item({
        image: '/images/dining-2.jpg', productName: 'Ghế ăn bọc vải', color: 'Đen',
        colorHex: '#333333', sku: 'GA-BV-DEN', price: 1450000, qty: 2, areaM2: 0.45,
      }),
      item({
        image: '/images/floor-lamp.jpg', productName: 'Đèn bàn gốm', color: 'Trắng',
        colorHex: '#F5F5F5', sku: 'DB-GOM-TRANG', price: 890000, qty: 1, areaM2: 0.09,
      }),
    ],
    subtotal: 3790000, discount: 0, voucherCode: null, shippingFee: 460000,
    totalAreaM2: 0.99, total: 4250000, paymentMethod: 'COD',
    payment: { method: 'COD', amount: 4250000, status: 'CHƯA THANH TOÁN', providerRef: null, paidAt: null },
  },
  {
    orderNumber: 'NT-20261012-0006',
    createdAt: '2026-10-12T07:52:00+07:00',
    status: 'MỚI',
    statusHistory: [hist('MỚI', '2026-10-12T07:52:00+07:00', 'Đơn hàng được tạo')],
    receiver: {
      name: 'Trần Thị Bình', phone: '0912345678',
      province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Thành',
      detail: '45 Lê Lợi',
    },
    note: '', adminNote: '', trackingCode: null,
    items: [
      item({
        image: '/images/dining-2.jpg', productName: 'Ghế ăn bọc vải', color: 'Đen',
        colorHex: '#333333', sku: 'GA-BV-DEN', price: 1450000, qty: 1, areaM2: 0.45,
      }),
    ],
    subtotal: 1450000, discount: 0, voucherCode: null, shippingFee: 0,
    totalAreaM2: 0.45, total: 1450000, paymentMethod: 'MOMO',
    payment: { method: 'MOMO', amount: 1450000, status: 'CHƯA THANH TOÁN', providerRef: null, paidAt: null },
  },
  {
    orderNumber: 'NT-20261012-0005',
    createdAt: '2026-10-12T07:30:00+07:00',
    status: 'ĐÃ XÁC NHẬN',
    statusHistory: [
      hist('MỚI', '2026-10-12T07:30:00+07:00', 'Đơn hàng được tạo'),
      hist('ĐÃ XÁC NHẬN', '2026-10-12T07:45:00+07:00', 'Shop đã xác nhận đơn'),
    ],
    receiver: {
      name: 'Lê Hoàng Cường', phone: '0923456789',
      province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé',
      detail: '78 Pasteur',
    },
    note: '', adminNote: '', trackingCode: null,
    items: [
      item({
        image: '/images/sofa-nordic.jpg', productName: 'Sofa góc L Nordic', color: 'Xám',
        colorHex: '#9AA0A6', sku: 'SF-NOR-XAM', price: 6450000, qty: 2, areaM2: 1.2,
      }),
    ],
    subtotal: 12900000, discount: 0, voucherCode: null, shippingFee: 0,
    totalAreaM2: 2.4, total: 12900000, paymentMethod: 'COD',
    payment: { method: 'COD', amount: 12900000, status: 'CHƯA THANH TOÁN', providerRef: null, paidAt: null },
  },
  {
    orderNumber: 'NT-20261011-0018',
    createdAt: '2026-10-11T21:14:00+07:00',
    status: 'ĐANG GIAO',
    statusHistory: [
      hist('MỚI', '2026-10-11T21:14:00+07:00', 'Đơn hàng được tạo'),
      hist('ĐÃ XÁC NHẬN', '2026-10-11T21:40:00+07:00', 'Shop đã xác nhận đơn'),
      hist('ĐANG GIAO', '2026-10-12T08:30:00+07:00', 'Đang giao đến bạn'),
    ],
    receiver: {
      name: 'Phạm Thu Dung', phone: '0934567890',
      province: 'TP. Hồ Chí Minh', district: 'Quận 3', ward: 'Phường 6',
      detail: '210 Võ Văn Tần',
    },
    note: '', adminNote: '', trackingCode: 'GHN123456789',
    items: [
      item({
        image: '/images/floor-lamp.jpg', productName: 'Đèn bàn gốm', color: 'Trắng',
        colorHex: '#F5F5F5', sku: 'DB-GOM-TRANG', price: 890000, qty: 2, areaM2: 0.09,
      }),
      item({
        image: '/images/side-table.jpg', productName: 'Kệ sách mini', color: 'Nâu',
        colorHex: '#8A5A3B', sku: 'KS-MINI-NAU', price: 550000, qty: 1, areaM2: 0.3,
        flashSaleProgramId: 'FS-202610',
      }),
      item({
        image: '/images/side-table.jpg', productName: 'Gương trang trí tròn', color: 'Vàng đồng',
        colorHex: '#C9A227', sku: 'GT-TRON-VANG', price: 450000, qty: 1, areaM2: 0.12,
      }),
    ],
    subtotal: 2780000, discount: 0, voucherCode: null, shippingFee: 120000,
    totalAreaM2: 0.6, total: 2900000, paymentMethod: 'MOMO',
    payment: { method: 'MOMO', amount: 2900000, status: 'ĐÃ THANH TOÁN', providerRef: 'MOMO88412037', paidAt: '2026-10-11T21:16:00+07:00' },
  },
  {
    orderNumber: 'NT-20261011-0017',
    createdAt: '2026-10-11T20:03:00+07:00',
    status: 'HOÀN THÀNH',
    statusHistory: [
      hist('MỚI', '2026-10-11T20:03:00+07:00', 'Đơn hàng được tạo'),
      hist('ĐÃ XÁC NHẬN', '2026-10-11T20:25:00+07:00', 'Shop đã xác nhận đơn'),
      hist('ĐANG GIAO', '2026-10-12T08:00:00+07:00', 'Đang giao đến bạn'),
      hist('HOÀN THÀNH', '2026-10-12T10:05:00+07:00', 'Đã giao thành công'),
    ],
    receiver: {
      name: 'Võ Minh Đức', phone: '0945678901',
      province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Đa Kao',
      detail: '15 Nguyễn Đình Chiểu',
    },
    note: '', adminNote: '', trackingCode: 'GHN123456790',
    items: [
      item({
        image: '/images/floor-lamp.jpg', productName: 'Đèn bàn gốm', color: 'Trắng',
        colorHex: '#F5F5F5', sku: 'DB-GOM-TRANG', price: 890000, qty: 1, areaM2: 0.09,
      }),
    ],
    subtotal: 890000, discount: 0, voucherCode: null, shippingFee: 0,
    totalAreaM2: 0.09, total: 890000, paymentMethod: 'COD',
    payment: { method: 'COD', amount: 890000, status: 'ĐÃ THANH TOÁN', providerRef: null, paidAt: '2026-10-12T10:05:00+07:00' },
  },
  {
    orderNumber: 'NT-20261011-0016',
    createdAt: '2026-10-11T18:47:00+07:00',
    status: 'ĐÃ XÁC NHẬN',
    statusHistory: [
      hist('MỚI', '2026-10-11T18:47:00+07:00', 'Đơn hàng được tạo'),
      hist('ĐÃ XÁC NHẬN', '2026-10-11T19:05:00+07:00', 'Shop đã xác nhận đơn'),
    ],
    receiver: {
      name: 'Đặng Ngọc Anh', phone: '0956789012',
      province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé',
      detail: '99 Hai Bà Trưng',
    },
    note: '', adminNote: '', trackingCode: null,
    items: [
      item({
        image: '/images/bed-walnut.jpg', productName: 'Giường ngủ gỗ sồi 1m8', color: 'Nâu óc chó',
        colorHex: '#6B4226', sku: 'GN-GS-NAU', price: 6900000, qty: 1, areaM2: 3.6,
      }),
      item({
        image: '/images/floor-lamp.jpg', productName: 'Đèn ngủ gốm', color: 'Trắng',
        colorHex: '#F5F5F5', sku: 'DN-GOM-TRANG', price: 1000000, qty: 1, areaM2: 0.05,
      }),
    ],
    subtotal: 7900000, discount: 0, voucherCode: null, shippingFee: 0,
    totalAreaM2: 3.65, total: 7900000, paymentMethod: 'BANK_TRANSFER',
    payment: { method: 'BANK_TRANSFER', amount: 7900000, status: 'CHƯA THANH TOÁN', providerRef: null, paidAt: null },
  },
  {
    orderNumber: 'NT-20261011-0015',
    createdAt: '2026-10-11T17:26:00+07:00',
    status: 'MỚI',
    statusHistory: [hist('MỚI', '2026-10-11T17:26:00+07:00', 'Đơn hàng được tạo')],
    receiver: {
      name: 'Bùi Thanh Hà', phone: '0967890123',
      province: 'TP. Hồ Chí Minh', district: 'Quận Phú Nhuận', ward: 'Phường 2',
      detail: '32 Phan Xích Long',
    },
    note: '', adminNote: '', trackingCode: null,
    items: [
      item({
        image: '/images/dining-2.jpg', productName: 'Ghế ăn bọc vải', color: 'Đen',
        colorHex: '#333333', sku: 'GA-BV-DEN', price: 1450000, qty: 2, areaM2: 0.45,
      }),
      item({
        image: '/images/beanbag.png', productName: 'Gối tựa lưng', color: 'Be',
        colorHex: '#D9C7A7', sku: 'GTL-BE', price: 240000, qty: 1, areaM2: 0.04,
      }),
    ],
    subtotal: 3140000, discount: 0, voucherCode: null, shippingFee: 240000,
    totalAreaM2: 0.94, total: 3380000, paymentMethod: 'MOMO',
    payment: { method: 'MOMO', amount: 3380000, status: 'CHƯA THANH TOÁN', providerRef: null, paidAt: null },
  },
  {
    orderNumber: 'NT-20261011-0014',
    createdAt: '2026-10-11T16:40:00+07:00',
    status: 'ĐÃ HỦY',
    statusHistory: [
      hist('MỚI', '2026-10-11T16:40:00+07:00', 'Đơn hàng được tạo'),
      hist('ĐÃ HỦY', '2026-10-11T17:10:00+07:00', 'Tự động hủy: hết 30 phút giữ thanh toán MoMo', true),
    ],
    receiver: {
      name: 'Ngô Quang Huy', phone: '0978901234',
      province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé',
      detail: '8 Lý Tự Trọng',
    },
    note: '', adminNote: '', trackingCode: null,
    items: [
      item({
        image: '/images/dining-set.jpg', productName: 'Bàn ăn gỗ óc chó 6 chỗ', color: 'Nâu óc chó',
        colorHex: '#6B4226', sku: 'BA-GOC-NAU', price: 2780000, qty: 2, areaM2: 1.5,
      }),
    ],
    subtotal: 5560000, discount: 0, voucherCode: null, shippingFee: 0,
    totalAreaM2: 3, total: 5560000, paymentMethod: 'MOMO',
    payment: { method: 'MOMO', amount: 5560000, status: 'CHƯA THANH TOÁN', providerRef: null, paidAt: null },
  },
  {
    orderNumber: 'NT-20261011-0013',
    createdAt: '2026-10-11T15:05:00+07:00',
    status: 'HOÀN TRẢ',
    statusHistory: [
      hist('MỚI', '2026-10-11T15:05:00+07:00', 'Đơn hàng được tạo'),
      hist('ĐÃ XÁC NHẬN', '2026-10-11T15:30:00+07:00', 'Shop đã xác nhận đơn'),
      hist('ĐANG GIAO', '2026-10-11T16:20:00+07:00', 'Đang giao đến bạn'),
      hist('HOÀN THÀNH', '2026-10-11T18:02:00+07:00', 'Đã giao thành công'),
      hist('HOÀN TRẢ', '2026-10-12T09:15:00+07:00', 'Khách đổi ý — hàng còn nguyên vẹn, chờ kiểm hàng.'),
    ],
    receiver: {
      name: 'Hà Văn Phúc', phone: '0989012345',
      province: 'TP. Hồ Chí Minh', district: 'Quận 4', ward: 'Phường 13',
      detail: '120 Nguyễn Tất Thành',
    },
    note: '', adminNote: 'Khách đã nhận hoàn tiền tại cửa hàng.', trackingCode: 'GHN765432198',
    items: [
      item({
        image: '/images/bedroom-2.png', productName: 'Tủ quần áo 2 cánh', color: 'Trắng',
        colorHex: '#F5F5F5', sku: 'TQA-2C-TRANG', price: 2900000, qty: 1, areaM2: 1.8,
      }),
    ],
    subtotal: 2900000, discount: 0, voucherCode: null, shippingFee: 0,
    totalAreaM2: 1.8, total: 2900000, paymentMethod: 'COD',
    payment: { method: 'COD', amount: 2900000, status: 'HOÀN TIỀN', providerRef: null, paidAt: '2026-10-11T18:02:00+07:00' },
  },
  {
    orderNumber: 'NT-20261011-0012',
    createdAt: '2026-10-11T14:20:00+07:00',
    status: 'ĐANG GIAO',
    statusHistory: [
      hist('MỚI', '2026-10-11T14:20:00+07:00', 'Đơn hàng được tạo'),
      hist('ĐÃ XÁC NHẬN', '2026-10-11T14:35:00+07:00', 'Shop đã xác nhận đơn'),
      hist('ĐANG GIAO', '2026-10-11T16:45:00+07:00', 'Đang giao đến bạn'),
    ],
    receiver: {
      name: 'Đỗ Thị Lan', phone: '0990123456',
      province: 'TP. Hồ Chí Minh', district: 'Quận 3', ward: 'Phường 6',
      detail: '56 Cách Mạng Tháng Tám',
    },
    note: '', adminNote: '', trackingCode: 'VTP99887766',
    items: [
      item({
        image: '/images/coffee-table.jpg', productName: 'Bàn trà gỗ sồi', color: 'Nâu óc chó',
        colorHex: '#6B4226', sku: 'BT-GS-NAU', price: 3650000, qty: 1, areaM2: 0.5,
      }),
      item({
        image: '/images/tv-stand.jpg', productName: 'Kệ TV gỗ sồi', color: 'Nâu óc chó',
        colorHex: '#6B4226', sku: 'KTV-GS-NAU', price: 3100000, qty: 1, areaM2: 0.8,
      }),
    ],
    subtotal: 6750000, discount: 0, voucherCode: null, shippingFee: 0,
    totalAreaM2: 1.3, total: 6750000, paymentMethod: 'BANK_TRANSFER',
    payment: { method: 'BANK_TRANSFER', amount: 6750000, status: 'ĐÃ THANH TOÁN', providerRef: 'FT2610112233', paidAt: '2026-10-11T15:02:00+07:00' },
  },
];

function findMockOrder(orderNumber) {
  const o = mockOrders.find((x) => x.orderNumber === orderNumber);
  if (!o) {
    throw apiError(404, {
      code: 'ORDER_NOT_FOUND',
      message: `Không tìm thấy đơn hàng ${orderNumber}.`,
    });
  }
  return o;
}

function toListItem(o) {
  return {
    orderNumber: o.orderNumber,
    customerName: o.receiver?.name || '',
    customerPhone: o.receiver?.phone || '',
    itemCount: (o.items || []).reduce((s, i) => s + (i.qty || 0), 0),
    itemKinds: (o.items || []).length,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.payment?.status || 'CHƯA THANH TOÁN',
    status: o.status,
    createdAt: o.createdAt,
  };
}

/** Lọc phụ (mọi thứ trừ trạng thái) — dùng chung cho bảng + statusCounts. */
function matchOtherFilters(o, { q, from, to, paymentMethod }) {
  if (paymentMethod && o.paymentMethod !== paymentMethod) return false;
  if (from) {
    const fromTs = new Date(`${from}T00:00:00`).getTime();
    if (new Date(o.createdAt).getTime() < fromTs) return false;
  }
  if (to) {
    const toTs = new Date(`${to}T23:59:59`).getTime();
    if (new Date(o.createdAt).getTime() > toTs) return false;
  }
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    const needleNoAccent = normalizeVi(q.trim());
    const hay = [
      o.orderNumber.toLowerCase(),
      normalizeVi(o.receiver?.name || ''),
      o.receiver?.phone || '',
    ];
    if (!hay.some((h) => h.includes(needle) || h.includes(needleNoAccent))) return false;
  }
  return true;
}

function mock422(message, currentStatus) {
  return apiError(422, { code: 'INVALID_TRANSITION', message, currentStatus });
}

/* ------------------------------ Public API ------------------------------ */

/**
 * Danh sách đơn admin + statusCounts.
 * @param {{ status?: string, q?: string, from?: string, to?: string,
 *   paymentMethod?: string, sort?: string, page?: number, size?: number }} params
 *   status: slug §2.5 ("moi", "cho-xu-ly", …) hoặc rỗng = tất cả.
 *   sort: "createdAt,desc" (mặc định) | "createdAt,asc" | "total,asc" | "total,desc".
 */
export async function listOrders(params = {}) {
  const { status = '', q = '', from = '', to = '', paymentMethod = '', sort = '', page = 1, size = 10 } = params;
  if (!USE_MOCK) {
    const query = {};
    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (from) query.from = from;
    if (to) query.to = to;
    if (q) query.q = q;
    if (sort) query.sort = sort;
    query.page = page;
    query.size = size;
    return callApi(async () => (await axiosClient.get('/admin/orders', { params: query })).data);
  }
  await delay(MOCK_DELAY);
  const base = mockOrders.filter((o) => matchOtherFilters(o, { q, from, to, paymentMethod }));
  // Keys chuẩn theo contract §7: MOI, DA_XAC_NHAN, DANG_GIAO, HOAN_THANH, DA_HUY, HOAN_TRA.
  const counts = {
    ALL: statusCounts.ALL,
    MOI: base.filter((o) => o.status === 'MỚI').length,
    DA_XAC_NHAN: base.filter((o) => o.status === 'ĐÃ XÁC NHẬN').length,
    DANG_GIAO: base.filter((o) => o.status === 'ĐANG GIAO').length,
    HOAN_THANH: base.filter((o) => o.status === 'HOÀN THÀNH').length,
    DA_HUY: base.filter((o) => o.status === 'ĐÃ HỦY').length,
    HOAN_TRA: base.filter((o) => o.status === 'HOÀN TRẢ').length,
  };
  const wanted = statusesForSlug(status);
  const filtered = wanted ? base.filter((o) => wanted.includes(o.status)) : [...base];
  const [field, dir] = (sort || 'createdAt,desc').split(',');
  filtered.sort((a, b) => {
    const va = field === 'total' ? a.total : new Date(a.createdAt).getTime();
    const vb = field === 'total' ? b.total : new Date(b.createdAt).getTime();
    return dir === 'asc' ? va - vb : vb - va;
  });
  const totalElements = filtered.length;
  const totalPages = size > 0 ? Math.ceil(totalElements / size) : 0;
  const start = (page - 1) * size;
  return {
    content: filtered.slice(start, start + size).map(toListItem),
    totalElements,
    totalPages,
    page,
    size,
    statusCounts: counts,
  };
}

/** Chi tiết đơn cho slide-over — 404 khi không có đơn. */
export async function getOrder(orderNumber) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get(`/admin/orders/${orderNumber}`)).data);
  }
  await delay(MOCK_DELAY);
  return clone(findMockOrder(orderNumber));
}

/**
 * Chuyển trạng thái theo ma trận FR-012.
 * @param {{ toStatus: string, trackingCode?: string, reason?: string }} body
 *   reason: lý do/ghi chú của mốc mới (bắt buộc khi hủy/hoàn trả).
 * -> 200 chi tiết đơn đã cập nhật · 422 { message, currentStatus }.
 */
export async function updateStatus(orderNumber, { toStatus, trackingCode, reason } = {}) {
  if (!USE_MOCK) {
    const body = { status: toStatus };
    if (trackingCode) body.trackingCode = trackingCode;
    if (reason) body.note = reason;
    return callApi(
      async () => (await axiosClient.patch(`/admin/orders/${orderNumber}/status`, body)).data
    );
  }
  await delay(MOCK_DELAY);
  const order = findMockOrder(orderNumber);
  const current = order.status;
  if (!(TRANSITIONS[current] || []).includes(toStatus)) {
    throw mock422(
      `Không thể chuyển đơn sang ${LABEL_BY_STATUS[toStatus] || toStatus} — đơn hiện đang ở trạng thái ${LABEL_BY_STATUS[current]}.`,
      current
    );
  }
  if (toStatus === 'ĐANG GIAO' && !trackingCode?.trim()) {
    throw apiError(422, { code: 'TRACKING_CODE_REQUIRED', message: 'Vui lòng nhập mã vận đơn.' });
  }
  if (toStatus === 'ĐÃ HỦY' && !reason?.trim()) {
    throw apiError(422, { code: 'REASON_REQUIRED', message: 'Vui lòng nhập lý do hủy.' });
  }
  if (toStatus === 'HOÀN TRẢ') {
    if (!reason?.trim()) {
      throw apiError(422, { code: 'REASON_REQUIRED', message: 'Vui lòng nhập lý do hoàn trả.' });
    }
    if (current === 'HOÀN THÀNH') {
      const done = [...(order.statusHistory || [])].reverse().find((h) => h.status === 'HOÀN THÀNH');
      const baseTs = done ? new Date(done.at).getTime() : new Date(order.createdAt).getTime();
      if (Date.now() > baseTs + 7 * 24 * 3600 * 1000) {
        throw mock422('Đã quá 7 ngày kể từ khi đơn hoàn thành — không thể hoàn trả.', current);
      }
    }
  }
  const now = new Date().toISOString();
  const defaultNotes = {
    'ĐÃ XÁC NHẬN': 'Shop đã xác nhận đơn',
    'ĐANG GIAO': 'Đang giao đến bạn',
    'HOÀN THÀNH': 'Đã giao thành công',
  };
  order.status = toStatus;
  order.statusHistory = [
    ...(order.statusHistory || []),
    hist(toStatus, now, reason?.trim() || defaultNotes[toStatus] || ''),
  ];
  if (toStatus === 'ĐANG GIAO') order.trackingCode = trackingCode.trim();
  if ((toStatus === 'ĐÃ HỦY' || toStatus === 'HOÀN TRẢ')
      && order.payment?.status === 'ĐÃ THANH TOÁN') {
    // Backend: hủy dùng đường hủy chung (hoàn kho + voucher + suất flash);
    // hoàn trả không tự hoàn kho. Mock chỉ phản ánh trạng thái Payment.
    order.payment.status = 'HOÀN TIỀN';
  }
  if (toStatus === 'HOÀN THÀNH' && order.paymentMethod === 'COD'
      && order.payment?.status === 'CHƯA THANH TOÁN') {
    order.payment.status = 'ĐÃ THANH TOÁN';
    order.payment.paidAt = now;
  }
  return clone(order);
}

/** Lưu ghi chú nội bộ (chỉ admin thấy) -> 200 chi tiết đơn. */
export async function updateAdminNote(orderNumber, { adminNote } = {}) {
  if (!USE_MOCK) {
    return callApi(
      async () =>
        (await axiosClient.patch(`/admin/orders/${orderNumber}/admin-note`, { adminNote })).data
    );
  }
  await delay(300);
  const order = findMockOrder(orderNumber);
  order.adminNote = adminNote?.trim() || '';
  return clone(order);
}

/** Xác nhận đã nhận chuyển khoản (BANK_TRANSFER chưa thu) -> 200 chi tiết đơn. */
export async function confirmBankTransfer(orderNumber) {
  if (!USE_MOCK) {
    return callApi(
      async () => (await axiosClient.patch(`/admin/orders/${orderNumber}/payment-confirm`)).data
    );
  }
  await delay(MOCK_DELAY);
  const order = findMockOrder(orderNumber);
  if (order.paymentMethod !== 'BANK_TRANSFER') {
    throw apiError(422, {
      code: 'NOT_BANK_TRANSFER',
      message: 'Chỉ áp dụng cho đơn chuyển khoản ngân hàng.',
    });
  }
  if (order.payment?.status === 'ĐÃ THANH TOÁN') {
    throw apiError(422, { code: 'ALREADY_PAID', message: 'Đơn đã được thanh toán rồi.' });
  }
  order.payment.status = 'ĐÃ THANH TOÁN';
  order.payment.paidAt = new Date().toISOString();
  return clone(order);
}
