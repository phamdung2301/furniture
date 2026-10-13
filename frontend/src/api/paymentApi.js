/**
 * API module thanh toán MoMo — FR-010 · F-008 · F-009 · US-012 (màn 8).
 *
 * Contract (khớp PaymentController backend):
 *   POST /payments/momo/create   body { orderNumber }
 *     -> 201 { qrCodeUrl, deeplink, momoOrderId, amount, expiresAt }
 *     Validate: đơn thuộc user, status=MỚI, paymentMethod=MOMO,
 *     chưa có payment thành công.
 *   GET /payments/status/{orderNumber} -> { status, paidAt? }
 *   POST /orders/{orderNumber}/cancel -> hủy khi còn MỚI + chưa thanh toán,
 *     hoàn kho + hoàn lượt voucher (F-009).
 *   GET /orders/{id} -> chi tiết đơn (kể cả F5); có khối
 *     payment: { method, status: "CHƯA THANH TOÁN|ĐÃ THANH TOÁN|THẤT BẠI",
 *                paidAt?, failReason? } — đăng ký qua orderApi.__setMockPaymentReader.
 *
 * Bảo mật FE (§8 spec): KHÔNG hardcode partnerCode/secret/chữ ký MoMo;
 * QR chỉ render từ qrCodeUrl backend; không console.log dữ liệu MoMo.
 *
 * Mock: cửa sổ thanh toán 30 phút giả lập. Hỗ trợ query param
 * ?simulate=success|fail|expire trên trang — CHỈ có tác dụng khi
 * USE_MOCK=true (các hàm __dev* tự guard). Không có toggle demo nào
 * trong UI production.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { getOrder, __setMockPaymentReader, __mockCancelOrder } from './orderApi';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 800;
/** Cửa sổ giữ đơn chờ thanh toán — 30 phút (F-008 [Giả định]). */
const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function paymentError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/* ---------------- Mock state (trong phiên) ---------------- */

/** orderNumber -> { status, paidAt?, failReason?, expiresAt } */
const mockPayments = new Map();

/** QR giả lập (data URI SVG) — chỉ để dev nhìn thấy khung QR; backend
 *  thật luôn sinh payload từ MoMo API. */
function mockQrDataUrl(orderNumber) {
  const cells = 21;
  const px = 240 / cells;
  let seed = 0;
  for (const ch of String(orderNumber)) {
    seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  }
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 4294967296;
  };
  const inFinder = (i, j) =>
    (i < 8 && j < 8) || (i < 8 && j >= cells - 8) || (i >= cells - 8 && j < 8);
  let rects = '';
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      if (!inFinder(i, j) && rand() > 0.52) {
        rects += `<rect x="${(i * px).toFixed(1)}" y="${(j * px).toFixed(1)}" width="${px.toFixed(1)}" height="${px.toFixed(1)}"/>`;
      }
    }
  }
  const finder = (ox, oy) =>
    `<rect x="${(ox * px).toFixed(1)}" y="${(oy * px).toFixed(1)}" width="${(7 * px).toFixed(1)}" height="${(7 * px).toFixed(1)}"/><rect x="${((ox + 1) * px).toFixed(1)}" y="${((oy + 1) * px).toFixed(1)}" width="${(5 * px).toFixed(1)}" height="${(5 * px).toFixed(1)}" fill="#fff"/><rect x="${((ox + 2) * px).toFixed(1)}" y="${((oy + 2) * px).toFixed(1)}" width="${(3 * px).toFixed(1)}" height="${(3 * px).toFixed(1)}"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">` +
    `<rect width="240" height="240" fill="#fff"/><g fill="#000">${rects}` +
    `${finder(0, 0)}${finder(cells - 7, 0)}${finder(0, cells - 7)}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Cho orderApi.getOrder() (mock) gắn khối payment vào đơn — để trang
 * Thanh toán poll đúng contract real (GET /orders/{id} có payment).
 */
if (USE_MOCK) {
  __setMockPaymentReader((orderNumber) => {
    const state = mockPayments.get(orderNumber);
    if (!state) return null;
    return {
      method: 'MOMO',
      status: state.status,
      ...(state.paidAt ? { paidAt: state.paidAt } : {}),
      ...(state.failReason ? { failReason: state.failReason } : {}),
    };
  });
}

/**
 * Tạo yêu cầu thanh toán MoMo cho đơn — F-008.
 * Đơn vẫn MỚI; không tạo đơn mới (dùng cho cả "Tạo lại thanh toán").
 */
export async function createPayment(orderNumber) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const order = await getOrder(orderNumber); // ném not_found nếu không có
    if (order.paymentMethod !== 'MOMO') {
      throw paymentError('wrong_method', 'Đơn hàng không dùng Ví MoMo.');
    }
    const existing = mockPayments.get(orderNumber);
    if (existing?.status === 'ĐÃ THANH TOÁN') {
      throw paymentError('already_paid', 'Đơn hàng đã được thanh toán.');
    }
    const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString();
    mockPayments.set(orderNumber, { status: 'CHƯA THANH TOÁN', expiresAt });
    return {
      qrCodeUrl: mockQrDataUrl(orderNumber),
      deeplink: `momo://mock-pay?order=${encodeURIComponent(orderNumber)}`,
      momoOrderId: `MOMO-MOCK-${Date.now()}`,
      amount: order.total,
      expiresAt,
    };
  }
  const { data } = await axiosClient.post('/payments/momo/create', { orderNumber });
  return data;
}

/**
 * Trạng thái thanh toán — cho nút "Tôi đã thanh toán xong"
 * (backend query trực tiếp MoMo, không bắt user chờ vòng poll).
 */
export async function getPaymentStatus(orderNumber) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const state = mockPayments.get(orderNumber);
    if (!state) {
      throw paymentError('not_found', 'Không tìm thấy giao dịch thanh toán.');
    }
    return { status: state.status, ...(state.paidAt ? { paidAt: state.paidAt } : {}) };
  }
  const { data } = await axiosClient.get(`/payments/status/${orderNumber}`);
  return data;
}

/** Hủy thanh toán bởi user — F-009 (chỉ khi đơn còn MỚI, chưa thanh toán). */
export async function cancelPayment(orderNumber) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const state = mockPayments.get(orderNumber);
    if (state?.status === 'ĐÃ THANH TOÁN') {
      throw paymentError('already_paid', 'Đơn hàng đã được thanh toán, không thể hủy.');
    }
    mockPayments.delete(orderNumber);
    await __mockCancelOrder(orderNumber); // ném not_found nếu không có đơn
    return { ok: true };
  }
  const { data } = await axiosClient.post(`/orders/${orderNumber}/cancel`);
  return data;
}

/* ---------------- Dev-only: ?simulate= (mock only) ---------------- */

/**
 * Mô phỏng kết quả thanh toán cho dev test — chỉ chạy khi USE_MOCK=true.
 *   success: sau ~6s đơn chuyển ĐÃ THANH TOÁN (poll lần 2 thấy).
 *   fail:    sau ~6s giao dịch THẤT BẠI (lý do: bị từ chối trên app MoMo).
 *   expire:  rút cửa sổ thanh toán còn 10 giây -> hết giờ đơn tự hủy.
 * Trả về { expiresAt } đã điều chỉnh cho mode expire, undefined cho mode khác.
 */
export function __devSimulate(orderNumber, mode) {
  if (!USE_MOCK) return undefined;
  const state = mockPayments.get(orderNumber);
  if (!state) return undefined;
  if (mode === 'success') {
    setTimeout(() => {
      const s = mockPayments.get(orderNumber);
      if (s && s.status === 'CHƯA THANH TOÁN') {
        s.status = 'ĐÃ THANH TOÁN';
        s.paidAt = new Date().toISOString();
      }
    }, 6000);
    return undefined;
  }
  if (mode === 'fail') {
    setTimeout(() => {
      const s = mockPayments.get(orderNumber);
      if (s && s.status === 'CHƯA THANH TOÁN') {
        s.status = 'THẤT BẠI';
        s.failReason = 'Giao dịch bị từ chối trên app MoMo.';
      }
    }, 6000);
    return undefined;
  }
  if (mode === 'expire') {
    state.expiresAt = new Date(Date.now() + 10 * 1000).toISOString();
    setTimeout(() => {
      const s = mockPayments.get(orderNumber);
      if (s && s.status === 'CHƯA THANH TOÁN') {
        mockPayments.delete(orderNumber);
        try {
          __mockCancelOrder(orderNumber);
        } catch {
          /* đơn có thể đã được hủy bởi user */
        }
      }
    }, 11 * 1000);
    return { expiresAt: state.expiresAt };
  }
  return undefined;
}

/**
 * Countdown về 0 (mock): đánh dấu đơn ĐÃ HỦY như backend tự hủy
 * (hoàn kho + hoàn lượt voucher theo F-008).
 */
export function __mockHandleExpired(orderNumber) {
  if (!USE_MOCK) return;
  mockPayments.delete(orderNumber);
  try {
    __mockCancelOrder(orderNumber);
  } catch {
    /* đơn có thể đã được hủy */
  }
}
