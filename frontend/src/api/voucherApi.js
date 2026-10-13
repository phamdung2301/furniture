/**
 * API module mã ưu đãi — FR-019 · F-007 rule 2.
 *
 * Contract (khớp VoucherController backend):
 *   GET /vouchers/available
 *     -> [{ code, type, value, maxDiscount, minOrderValue, description,
 *           eligible, reason? }]
 *     (type: PERCENT | FIXED; eligible tính trên tạm tính giỏ hiện tại)
 *   POST /vouchers/validate
 *     body: { code, subtotal }
 *     -> { valid, discount, message? }
 *
 * Quy tắc: mỗi đơn chỉ 1 voucher (FR-019). Message lỗi cụ thể từng case,
 * không message chung chung (copy-ux-linter).
 *
 * Khi backend chưa sẵn sàng, dùng mock và áp đúng logic ở client.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { getCartSubtotal } from '../utils/cart';
import { formatVND } from '../utils/format';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 400;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Danh sách voucher mẫu (mock). Demo màn Đặt hàng:
 * - NOITHAT50: giảm 50% tối đa 200.000đ, đơn từ 1.000.000đ (khả dụng)
 * - NOITHAT10: giảm 500.000đ, đơn từ 10.000.000đ (khả dụng — để demo đổi mã)
 * - NOITHAT20: đơn từ 20.000.000đ (chưa đủ điều kiện — hiện mờ + lý do)
 */
const MOCK_VOUCHERS = [
  {
    code: 'NOITHAT50',
    type: 'PERCENT',
    value: 50,
    maxDiscount: 200000,
    minOrderValue: 1000000,
    description: 'Giảm 50% tối đa 200.000đ — đơn từ 1.000.000đ',
    expired: false,
    usedUp: false,
  },
  {
    code: 'NOITHAT10',
    type: 'FIXED',
    value: 500000,
    maxDiscount: 500000,
    minOrderValue: 10000000,
    description: 'Giảm 500.000đ — đơn từ 10.000.000đ',
    expired: false,
    usedUp: false,
  },
  {
    code: 'NOITHAT20',
    type: 'PERCENT',
    value: 20,
    maxDiscount: 100000,
    minOrderValue: 20000000,
    description: 'Giảm 20% tối đa 100.000đ — đơn từ 20.000.000đ',
    expired: false,
    usedUp: false,
  },
];

/** Tính số tiền được giảm — dùng chung cho mock validate + mock createOrder. */
export function calcDiscount(voucher, subtotal) {
  const sub = Math.max(0, Number(subtotal) || 0);
  if (!voucher || sub <= 0) return 0;
  let discount = 0;
  if (voucher.type === 'PERCENT') {
    discount = Math.floor((sub * Number(voucher.value || 0)) / 100);
    if (voucher.maxDiscount != null) discount = Math.min(discount, voucher.maxDiscount);
  } else {
    discount = Number(voucher.value) || 0;
    if (voucher.maxDiscount != null) discount = Math.min(discount, voucher.maxDiscount);
  }
  return Math.min(discount, sub);
}

function toPublicShape(voucher, subtotal) {
  const eligible = subtotal >= voucher.minOrderValue && !voucher.expired && !voucher.usedUp;
  let reason;
  if (!eligible) {
    if (voucher.expired) reason = 'Mã đã hết hạn.';
    else if (voucher.usedUp) reason = 'Mã đã hết lượt sử dụng.';
    else
      reason = `Cần thêm ${formatVND(voucher.minOrderValue - subtotal)} để dùng mã này`;
  }
  return {
    code: voucher.code,
    type: voucher.type,
    value: voucher.value,
    maxDiscount: voucher.maxDiscount,
    minOrderValue: voucher.minOrderValue,
    description: voucher.description,
    eligible,
    reason,
  };
}

/** Chỉ dùng nội bộ mock: tìm voucher theo mã (không phân biệt hoa/thường). */
export function findMockVoucher(code) {
  const c = String(code || '').trim().toUpperCase();
  return MOCK_VOUCHERS.find((v) => v.code === c) || null;
}

/**
 * Danh sách mã khả dụng của user — F-007 rule 2.
 * Mock: kèm eligible/reason tính trên tạm tính giỏ hiện tại.
 */
export async function getAvailable() {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const subtotal = getCartSubtotal();
    return MOCK_VOUCHERS.map((v) => toPublicShape(v, subtotal));
  }
  const { data } = await axiosClient.get('/vouchers/available');
  return data;
}

/**
 * Kiểm tra mã ưu đãi trước khi áp — F-007 rule 2.
 * @returns { valid, discount, message? } — message tiếng Việt cụ thể từng case.
 */
export async function validateVoucher(code, subtotal) {
  const normalized = String(code || '').trim().toUpperCase();
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const voucher = findMockVoucher(normalized);
    if (!voucher) {
      return { valid: false, discount: 0, message: 'Mã ưu đãi không đúng. Vui lòng kiểm tra lại.' };
    }
    if (voucher.expired) {
      return { valid: false, discount: 0, message: 'Mã đã hết hạn.' };
    }
    if (voucher.usedUp) {
      return { valid: false, discount: 0, message: 'Mã đã hết lượt sử dụng.' };
    }
    if (subtotal < voucher.minOrderValue) {
      return {
        valid: false,
        discount: 0,
        message: `Đơn hàng chưa đạt giá trị tối thiểu ${formatVND(voucher.minOrderValue)}.`,
      };
    }
    return { valid: true, discount: calcDiscount(voucher, subtotal) };
  }
  const { data } = await axiosClient.post('/vouchers/validate', {
    code: normalized,
    subtotal,
  });
  return data;
}
