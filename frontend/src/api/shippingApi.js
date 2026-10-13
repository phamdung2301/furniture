/**
 * API module phí vận chuyển — FR-029 · F-023 · F-007.
 *
 * Contract (khớp ShippingController backend):
 *   POST /shipping/quote
 *     body: { items: [{ variantId, qty }] }
 *     -> { totalAreaM2, tier: { min, max } | null, fee, freeShipping, overLimit,
 *          breakdown: [{ name, areaM2, qty }] }
 *
 * Quy tắc (02-ERD §4, SHIPPING_RULE — admin cấu hình, giá trị demo):
 *   Phí ship = Σ(lengthM × widthM × qty) -> tra nấc:
 *     ≤ 1 m² -> 100.000đ · 1–3 m² -> 200.000đ · 3–6 m² -> 350.000đ · 6–10 m² -> 550.000đ
 *   Miễn phí khi tạm tính ≥ 10.000.000đ.
 *   Vượt 10 m² -> overLimit = true: FE chặn checkout, hiện "Liên hệ báo giá".
 *
 * Khi backend chưa sẵn sàng, dùng mock và áp đúng logic ở client.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { mockAllProducts } from '../mocks/homeMock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 400;

const FREE_SHIP_THRESHOLD = 10000000;
const MAX_AREA_M2 = 10;

// Nấc diện tích: (min, max] -> phí. totalArea vượt nấc cuối -> overLimit.
const AREA_TIERS = [
  { min: 0, max: 1, fee: 100000 },
  { min: 1, max: 3, fee: 200000 },
  { min: 3, max: 6, fee: 350000 },
  { min: 6, max: 10, fee: 550000 },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Mock: tra kích thước chiếm chỗ của variant từ mockAllProducts. */
function findVariantDims(variantId) {
  for (const product of mockAllProducts) {
    const v = (product.variants || []).find((x) => x.id === variantId);
    if (v) {
      return {
        name: product.name,
        lengthM: Number(v.lengthM) || 0,
        widthM: Number(v.widthM) || 0,
      };
    }
  }
  return null;
}

/**
 * Tính báo giá ship thuần túy (không delay) — dùng chung cho mock
 * quoteShipping() và mock createOrder() để chốt tổng tiền nhất quán.
 * @param {Array<{variantId, qty, price?, productName?}>} items
 */
export function computeShippingQuote(items) {
  const breakdown = [];
  let totalAreaM2 = 0;
  let subtotal = 0;
  for (const item of (items || [])) {
    const dims = findVariantDims(item.variantId);
    const areaM2 = round2((dims?.lengthM || 0) * (dims?.widthM || 0));
    const qty = Math.max(1, Number(item.qty) || 1);
    totalAreaM2 = round2(totalAreaM2 + areaM2 * qty);
    subtotal += (Number(item.price) || 0) * qty;
    breakdown.push({
      name: dims?.name || item.productName || 'Sản phẩm',
      areaM2,
      qty,
    });
  }
  const overLimit = totalAreaM2 > MAX_AREA_M2;
  const tier = overLimit
    ? null
    : AREA_TIERS.find((t) => totalAreaM2 <= t.max) || null;
  const freeShipping = !overLimit && subtotal >= FREE_SHIP_THRESHOLD;
  return {
    totalAreaM2,
    tier: tier ? { min: tier.min, max: tier.max } : null,
    fee: tier ? tier.fee : 0,
    freeShipping,
    overLimit,
    breakdown,
  };
}

/**
 * Báo giá phí vận chuyển cho các món trong giỏ — F-023.
 * Mock: tính từ lengthM × widthM của mockAllProducts.
 * Real: POST /shipping/quote.
 */
export async function quoteShipping(items) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return computeShippingQuote(items);
  }
  const payload = (items || []).map((i) => ({ variantId: i.variantId, qty: i.qty }));
  const { data } = await axiosClient.post('/shipping/quote', { items: payload });
  return data;
}

/** Định dạng diện tích khớp ví dụ spec: 4.2 -> "4.2", 3 -> "3". */
export function formatAreaM2(value) {
  const n = round2(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '');
}
