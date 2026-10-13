/**
 * API module đơn hàng — F-007 · F-008 · US-007 · US-008.
 *
 * Contract (khớp OrderController backend):
 *   POST /orders
 *     body: { addressId | receiver{...}, voucherCode?, paymentMethod, note? }
 *       (paymentMethod: COD | BANK_TRANSFER | MOMO)
 *     -> 201 { orderNumber, total, paymentMethod, status }
 *     (status: "MỚI" — đơn vừa tạo)
 *   GET /orders/{id} -> chi tiết đơn (mock: đơn vừa tạo trong phiên)
 *
 * Mock chốt tổng tiền bằng đúng công thức FE hiển thị:
 *   total = tạm tính − giảm giá voucher + phí ship (0 nếu miễn phí).
 * Đơn vượt 10 m² -> lỗi over_limit (FE đã chặn trước, mock chặn lại cho chắc).
 *
 * Khi backend chưa sẵn sàng, dùng mock và áp đúng logic ở client.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { getCart, getCartSubtotal, addToCart } from '../utils/cart';
import { findMockVoucher, calcDiscount } from './voucherApi';
import { computeShippingQuote } from './shippingApi';
import { findMockAddress } from './addressApi';
import { mockAllProducts } from '../mocks/homeMock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 900;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function orderError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** Đơn mock trong phiên — trang thành công đọc lại qua getOrder() (kể cả F5). */
const mockOrders = new Map();
let mockSeq = 0;

function nextOrderNumber() {
  mockSeq += 1;
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return `NT-${ymd}-${String(mockSeq).padStart(4, '0')}`;
}

function fullAddressLine(a) {
  if (!a) return '';
  return [a.detail, a.ward, a.district, a.province].filter(Boolean).join(', ');
}

/**
 * Tạo đơn hàng — F-007 rule 3/4/5 (snapshot giá/tên/màu/người nhận vào Order).
 * Page đã chạy validateCart() trước khi gọi; mock vẫn tự tính lại để chốt số.
 */
export async function createOrder({ addressId, receiver, voucherCode, paymentMethod, note }) {
  const body = {
    ...(addressId ? { addressId } : {}),
    ...(receiver ? { receiver } : {}),
    ...(voucherCode ? { voucherCode } : {}),
    paymentMethod,
    ...(note ? { note } : {}),
  };
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const items = getCart();
    if (items.length === 0) {
      throw orderError('empty_cart', 'Giỏ hàng trống.');
    }
    const subtotal = getCartSubtotal();
    let discount = 0;
    if (voucherCode) {
      // Flash sale không cộng dồn voucher (F-022): mã chỉ tính trên các dòng thường.
      const flashTotal = items
        .filter((i) => i.flashSaleProgramId)
        .reduce((s, i) => s + i.price * i.qty, 0);
      const nonFlashSubtotal = subtotal - flashTotal;
      if (flashTotal > 0 && nonFlashSubtotal === 0) {
        throw orderError(
          'flash_no_voucher',
          'Đơn hàng flash sale không áp dụng thêm mã giảm giá.'
        );
      }
      const voucher = findMockVoucher(voucherCode);
      const ok =
        voucher && !voucher.expired && !voucher.usedUp && nonFlashSubtotal >= voucher.minOrderValue;
      if (!ok) {
        throw orderError(
          'voucher_invalid',
          `Mã ${String(voucherCode).toUpperCase()} không còn hiệu lực. Vui lòng chọn mã khác.`
        );
      }
      discount = calcDiscount(voucher, nonFlashSubtotal);
    }
    const quote = computeShippingQuote(items);
    if (quote.overLimit) {
      throw orderError(
        'over_limit',
        'Đơn hàng vượt 10 m² cần báo giá riêng — vui lòng liên hệ hotline.'
      );
    }
    const shippingFee = quote.freeShipping ? 0 : quote.fee;
    const total = subtotal - discount + shippingFee;
    const address = addressId ? findMockAddress(addressId) : receiver || null;
    const orderNumber = nextOrderNumber();
    const order = {
      orderNumber,
      total,
      paymentMethod,
      status: 'MỚI',
      subtotal,
      discount,
      shippingFee,
      freeShipping: quote.freeShipping,
      totalAreaM2: quote.totalAreaM2,
      address: address
        ? {
            receiverName: address.receiverName,
            phone: address.phone,
            line: fullAddressLine(address),
            note: address.note || '',
          }
        : null,
      items: items.map((i) => ({
        variantId: i.variantId,
        productId: i.productId,
        productSlug:
          mockAllProducts.find((p) => p.id === i.productId)?.slug || null,
        productName: i.productName,
        color: i.color,
        colorHex: i.colorHex,
        image: i.image,
        price: i.price,
        qty: i.qty,
        reviewed: false,
      })),
      voucherCode: voucherCode ? String(voucherCode).toUpperCase() : null,
      note: note || '',
      createdAt: new Date().toISOString(),
      statusHistory: [
        { status: 'MỚI', at: new Date().toISOString(), note: 'Đơn hàng được tạo' },
      ],
      // Shape receiver khớp OrderDto backend (trang chi tiết đơn đọc field này).
      receiver: address
        ? {
            name: address.receiverName || address.name || '',
            phone: address.phone,
            province: address.province || '',
            district: address.district || '',
            ward: address.ward || '',
            detail: address.detail || '',
          }
        : null,
    };
    mockOrders.set(orderNumber, order);
    return { orderNumber, total, paymentMethod, status: 'MỚI' };
  }
  const { data } = await axiosClient.post('/orders', body);
  return data;
}

/** Chi tiết đơn — trang thành công + trang theo dõi đơn đọc (và khi F5). */
export async function getOrder(id) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const session = mockOrders.get(id);
    if (session) {
      // Mock-only: paymentApi đăng ký reader để gắn khối payment (khớp
      // contract GET /orders/{id} của backend real) cho màn thanh toán MoMo.
      const payment = mockPaymentReader ? mockPaymentReader(id) : null;
      return payment ? { ...session, payment } : session;
    }
    const sample = mockSampleOrders.find((o) => o.orderNumber === id);
    if (sample) return sample; // đơn mẫu đã mang sẵn khối payment
    throw orderError('not_found', 'Không tìm thấy đơn hàng.');
  }
  const { data } = await axiosClient.get(`/orders/${id}`);
  return data;
}

/* ==================================================================
 * Màn Theo dõi đơn (màn 11) — FR-016 · FR-012 · F-009 · US-009/010/011
 * Contract (khớp OrderController backend):
 *   GET  /orders?status=MỚI,ĐÃ XÁC NHẬN&page=1&size=10
 *     -> PageResponseDto { content: [OrderListItemDto], totalElements,
 *        totalPages, page, size }  (page 1-indexed, mới nhất trước)
 *     OrderListItemDto: { orderNumber, createdAt, total, status,
 *       paymentMethod, paymentStatus, itemCount,
 *       itemsPreview: [{ image, productName }], hasUnreviewedItems }
 *   POST /orders/{orderNumber}/cancel    body { reason? } -> 204
 *   POST /orders/{orderNumber}/reorder   -> { added, skipped:
 *       [{ productName, color, reason }] }  (reason: out_of_stock |
 *       discontinued | not_found — FE dịch sang tiếng Việt khi hiển thị)
 * ================================================================== */

const MOCK_RECEIVER = {
  name: 'Nguyễn Văn An',
  phone: '0901234567',
  province: 'TP. Hồ Chí Minh',
  district: 'Quận 1',
  ward: 'Phường Bến Nghé',
  detail: '123 Nguyễn Huệ',
};

const sampleItem = (o) => ({
  variantId: null,
  productId: null,
  reviewed: false,
  ...o,
});

/**
 * 5 đơn mẫu (theo-doi-don.md §8) — đủ trạng thái + đủ case hành động.
 * Mutable trong phiên: hủy/đặt lại/đánh giá cập nhật trực tiếp lên đây.
 * Đơn 0005 (MoMo chờ thanh toán): expiresAt đặt động now+29' để
 * countdown + polling ở trang chi tiết luôn sống khi dev.
 */
const mockSampleOrders = [
  {
    orderNumber: 'NT-20261011-0005',
    status: 'MỚI',
    paymentMethod: 'MOMO',
    items: [
      sampleItem({
        variantId: 'v11', productId: 'p1', productSlug: 'sofa-goc-l-nordic',
        productName: 'Sofa góc L Nordic', color: 'Xám', colorHex: '#9AA0A6',
        image: '/images/sofa-nordic.jpg', price: 12900000, qty: 1,
      }),
      sampleItem({
        variantId: 'v51', productId: 'p5', productSlug: 'ghe-an-boc-vai',
        productName: 'Ghế ăn bọc vải', color: 'Xám', colorHex: '#9AA0A6',
        image: '/images/dining-2.jpg', price: 1450000, qty: 2,
      }),
    ],
    subtotal: 15800000, discount: 200000, shippingFee: 0, total: 15600000,
    voucherCode: 'NOITHAT50', receiver: MOCK_RECEIVER, note: '',
    createdAt: '2026-10-11T20:15:00+07:00',
    statusHistory: [
      { status: 'MỚI', at: '2026-10-11T20:15:00+07:00', note: 'Đơn hàng được tạo' },
    ],
    payment: {
      method: 'MOMO',
      status: 'CHƯA THANH TOÁN',
      expiresAt: new Date(Date.now() + 29 * 60 * 1000).toISOString(),
    },
  },
  {
    orderNumber: 'NT-20261011-0004',
    status: 'ĐÃ XÁC NHẬN',
    paymentMethod: 'COD',
    items: [
      sampleItem({
        variantId: 'v51', productId: 'p5', productSlug: 'ghe-an-boc-vai',
        productName: 'Ghế ăn bọc vải', color: 'Xám', colorHex: '#9AA0A6',
        image: '/images/dining-2.jpg', price: 1450000, qty: 2,
      }),
    ],
    subtotal: 2900000, discount: 0, shippingFee: 0, total: 2900000,
    voucherCode: null, receiver: MOCK_RECEIVER, note: 'Gọi trước 30 phút khi giao.',
    createdAt: '2026-10-11T09:02:00+07:00',
    statusHistory: [
      { status: 'MỚI', at: '2026-10-11T09:02:00+07:00', note: 'Đơn hàng được tạo' },
      { status: 'ĐÃ XÁC NHẬN', at: '2026-10-11T09:40:00+07:00', note: 'Shop đã xác nhận đơn' },
    ],
    payment: { method: 'COD', status: 'CHƯA THANH TOÁN' },
  },
  {
    orderNumber: 'NT-20261010-0003',
    status: 'ĐANG GIAO',
    paymentMethod: 'MOMO',
    items: [
      sampleItem({
        variantId: 'v181', productId: 'p18', productSlug: 'tu-quan-ao-2-canh',
        productName: 'Tủ quần áo 2 cánh', color: 'Trắng', colorHex: '#F5F5F5',
        image: '/images/bedroom-2.png', price: 6500000, qty: 1,
      }),
      sampleItem({
        variantId: 'v231', productId: 'p23', productSlug: 'guong-trang-tri-tron',
        productName: 'Gương trang trí tròn', color: 'Vàng đồng', colorHex: '#C9A227',
        image: '/images/side-table.jpg', price: 1100000, qty: 1,
      }),
      sampleItem({
        variantId: 'v111', productId: 'p11', productSlug: 'ghe-luoi-hat-xop',
        productName: 'Ghế lười hạt xốp', color: 'Xám', colorHex: '#9AA0A6',
        image: '/images/beanbag.png', price: 650000, qty: 1,
      }),
    ],
    subtotal: 8250000, discount: 0, shippingFee: 200000, total: 8450000,
    voucherCode: null, receiver: MOCK_RECEIVER, note: '',
    createdAt: '2026-10-10T14:05:00+07:00',
    statusHistory: [
      { status: 'MỚI', at: '2026-10-10T14:05:00+07:00', note: 'Đơn hàng được tạo' },
      { status: 'ĐÃ XÁC NHẬN', at: '2026-10-10T15:20:00+07:00', note: 'Shop đã xác nhận đơn' },
      { status: 'ĐANG GIAO', at: '2026-10-11T08:30:00+07:00', note: 'Đang giao đến bạn' },
    ],
    payment: {
      method: 'MOMO',
      status: 'ĐÃ THANH TOÁN',
      paidAt: '2026-10-10T14:32:00+07:00',
    },
  },
  {
    orderNumber: 'NT-20261008-0002',
    status: 'HOÀN THÀNH',
    paymentMethod: 'COD',
    items: [
      sampleItem({
        variantId: 'v221', productId: 'p22', productSlug: 'den-ban-hoc',
        productName: 'Đèn bàn học', color: 'Trắng', colorHex: '#F5F5F5',
        image: '/images/floor-lamp.jpg', price: 550000, qty: 1, reviewed: true,
      }),
      sampleItem({
        variantId: 'v32', productId: 'p3', productSlug: 'ban-tra-go-soi',
        productName: 'Bàn trà gỗ sồi', color: 'Trắng', colorHex: '#F5F5F5',
        image: '/images/coffee-table.jpg', price: 3650000, qty: 1,
      }),
      sampleItem({
        variantId: 'v112', productId: 'p11', productSlug: 'ghe-luoi-hat-xop',
        productName: 'Ghế lười hạt xốp', color: 'Hồng pastel', colorHex: '#F2CFCF',
        image: '/images/beanbag.png', price: 650000, qty: 1,
      }),
    ],
    subtotal: 4850000, discount: 0, shippingFee: 350000, total: 5200000,
    voucherCode: null, receiver: MOCK_RECEIVER, note: '',
    createdAt: '2026-10-08T10:12:00+07:00',
    statusHistory: [
      { status: 'MỚI', at: '2026-10-08T10:12:00+07:00', note: 'Đơn hàng được tạo' },
      { status: 'ĐÃ XÁC NHẬN', at: '2026-10-08T11:00:00+07:00', note: 'Shop đã xác nhận đơn' },
      { status: 'ĐANG GIAO', at: '2026-10-09T08:15:00+07:00', note: 'Đang giao đến bạn' },
      { status: 'HOÀN THÀNH', at: '2026-10-09T14:45:00+07:00', note: 'Đã giao thành công' },
    ],
    payment: {
      method: 'COD',
      status: 'ĐÃ THANH TOÁN',
      paidAt: '2026-10-09T14:45:00+07:00',
    },
  },
  {
    orderNumber: 'NT-20261005-0001',
    status: 'ĐÃ HỦY',
    paymentMethod: 'MOMO',
    items: [
      sampleItem({
        variantId: 'v11', productId: 'p1', productSlug: 'sofa-goc-l-nordic',
        productName: 'Sofa góc L Nordic', color: 'Xám', colorHex: '#9AA0A6',
        image: '/images/sofa-nordic.jpg', price: 12900000, qty: 1,
      }),
      sampleItem({
        variantId: 'v51', productId: 'p5', productSlug: 'ghe-an-boc-vai',
        productName: 'Ghế ăn bọc vải', color: 'Xám', colorHex: '#9AA0A6',
        image: '/images/dining-2.jpg', price: 1450000, qty: 2,
      }),
    ],
    subtotal: 15800000, discount: 200000, shippingFee: 0, total: 15600000,
    voucherCode: 'NOITHAT50', receiver: MOCK_RECEIVER, note: '',
    createdAt: '2026-10-05T21:03:00+07:00',
    statusHistory: [
      { status: 'MỚI', at: '2026-10-05T21:03:00+07:00', note: 'Đơn hàng được tạo' },
      { status: 'ĐÃ HỦY', at: '2026-10-05T21:33:00+07:00', note: 'Quá thời gian thanh toán' },
    ],
    payment: { method: 'MOMO', status: 'CHƯA THANH TOÁN' },
  },
];

/** Tìm đơn mock ở cả 2 nguồn (đơn vừa tạo trong phiên + đơn mẫu). */
function findMockOrder(orderNumber) {
  return (
    mockOrders.get(orderNumber) ||
    mockSampleOrders.find((o) => o.orderNumber === orderNumber) ||
    null
  );
}

/** Chuyển 1 đơn mock đầy đủ -> OrderListItemDto (khớp backend). */
function toListItem(order) {
  const items = order.items || [];
  let paymentStatus = order.payment?.status || null;
  if (!paymentStatus && mockPaymentReader) {
    paymentStatus = mockPaymentReader(order.orderNumber)?.status || null;
  }
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    total: order.total,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: paymentStatus || 'CHƯA THANH TOÁN',
    itemCount: items.length,
    itemsPreview: items
      .slice(0, 3)
      .map((i) => ({ image: i.image, productName: i.productName })),
    hasUnreviewedItems:
      order.status === 'HOÀN THÀNH' && items.some((i) => i.reviewed === false),
  };
}

/**
 * Danh sách đơn của user — FR-016 / US-009.
 * @param {{ status?: string[]|string|null, page?: number, size?: number }} opts
 *   status: mảng trạng thái thô (chip "Mới" = ['MỚI','ĐÃ XÁC NHẬN']) hoặc null = tất cả.
 */
export async function listOrders({ status = null, page = 1, size = 10 } = {}) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const statuses = !status ? null : Array.isArray(status) ? status : [status];
    const all = [...mockOrders.values(), ...mockSampleOrders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .filter((o) => !statuses || statuses.includes(o.status));
    const totalElements = all.length;
    const totalPages = size > 0 ? Math.ceil(totalElements / size) : 0;
    const start = (page - 1) * size;
    return {
      content: all.slice(start, start + size).map(toListItem),
      totalElements,
      totalPages,
      page,
      size,
    };
  }
  const params = { page, size };
  if (status) {
    params.status = (Array.isArray(status) ? status : [status]).join(',');
  }
  const { data } = await axiosClient.get('/orders', { params });
  return data;
}

/**
 * Hủy đơn bởi user — F-009 / FR-013. Chỉ khi đơn còn MỚI;
 * backend hoàn kho + hoàn lượt voucher. reason: lý do hủy (không bắt buộc).
 */
export async function cancelOrder(orderNumber, reason) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const order = findMockOrder(orderNumber);
    if (!order) {
      throw orderError('not_found', 'Không tìm thấy đơn hàng.');
    }
    if (order.status !== 'MỚI') {
      throw orderError(
        'cannot_cancel',
        'Đơn hàng đang được xử lý, vui lòng liên hệ hotline 1900 6868 để được hỗ trợ.'
      );
    }
    order.status = 'ĐÃ HỦY';
    order.statusHistory = [
      ...(order.statusHistory || []),
      {
        status: 'ĐÃ HỦY',
        at: new Date().toISOString(),
        note: reason?.trim() ? reason.trim() : 'Bạn đã hủy đơn',
      },
    ];
    return { ok: true };
  }
  const { data } = await axiosClient.post(`/orders/${orderNumber}/cancel`, {
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
  });
  return data;
}

/**
 * Đặt lại đơn hàng — thêm lại các món của đơn cũ vào giỏ theo snapshot,
 * kiểm tra tồn hiện tại (món hết hàng/ngừng bán bị bỏ qua + liệt kê).
 * -> { added, skipped: [{ productName, color, reason }] }
 */
export async function reorderItems(orderNumber) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const order = findMockOrder(orderNumber);
    if (!order) {
      throw orderError('not_found', 'Không tìm thấy đơn hàng.');
    }
    let added = 0;
    const skipped = [];
    for (const item of order.items || []) {
      const product = mockAllProducts.find(
        (p) => p.slug === item.productSlug || p.id === item.productId
      );
      const variant =
        product?.variants.find((vr) => vr.id === item.variantId) ||
        product?.variants.find((vr) => vr.color === item.color) ||
        null;
      if (!product || !variant) {
        skipped.push({
          productName: item.productName,
          color: item.color,
          reason: 'not_found',
        });
        continue;
      }
      if (product.active === false) {
        skipped.push({
          productName: item.productName,
          color: item.color,
          reason: 'discontinued',
        });
        continue;
      }
      if ((variant.stock ?? 0) <= 0) {
        skipped.push({
          productName: item.productName,
          color: item.color,
          reason: 'out_of_stock',
        });
        continue;
      }
      addToCart({
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        color: variant.color,
        colorHex: variant.colorHex,
        price: variant.price,
        image: product.images?.[0]?.url || item.image,
        stock: variant.stock,
        qty: Math.min(item.qty || 1, variant.stock),
      });
      added += 1;
    }
    return { added, skipped };
  }
  const { data } = await axiosClient.post(`/orders/${orderNumber}/reorder`);
  return data;
}

/* ---------------- Mock-only helpers cho màn thanh toán (F-008) ---------------- */

let mockPaymentReader = null;
/** Đăng ký cách đọc trạng thái payment của đơn mock (paymentApi dùng). */
export function __setMockPaymentReader(fn) {
  mockPaymentReader = fn;
}

/** Hủy đơn mock: status -> ĐÃ HỦY (giả lập backend tự hủy khi hết hạn). */
export async function __mockCancelOrder(id) {
  const order = mockOrders.get(id);
  if (!order) {
    throw orderError('not_found', 'Không tìm thấy đơn hàng.');
  }
  order.status = 'ĐÃ HỦY';
  return order;
}

/**
 * Mock-only: giả lập backend tự hủy đơn MoMo quá hạn (F-008) cho trang
 * chi tiết đơn — lật status + ghi mốc lịch sử "Quá thời gian thanh toán".
 * Tìm ở cả đơn phiên và đơn mẫu; no-op khi USE_MOCK=false.
 */
export function __mockExpireOrder(id) {
  if (!USE_MOCK) return;
  const order = findMockOrder(id);
  if (!order || order.status !== 'MỚI') return;
  order.status = 'ĐÃ HỦY';
  order.statusHistory = [
    ...(order.statusHistory || []),
    {
      status: 'ĐÃ HỦY',
      at: new Date().toISOString(),
      note: 'Quá thời gian thanh toán',
    },
  ];
}
