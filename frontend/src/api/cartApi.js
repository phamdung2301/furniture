/**
 * API module giỏ hàng — F-005 / F-006 / FR-007 / FR-008.
 *
 * Contract (đã chốt với backend):
 *   POST /cart/merge   { items: [{ variantId, qty }] }
 *     -> { userId, items: CartItemDto[], subtotal, mergedCount, skipped: [{ variantId, reason }] }
 *   GET /cart
 *     -> { userId, items: CartItemDto[], subtotal }
 *   POST /cart/validate { items: [{ variantId, qty, price }] }
 *     -> { results: [{ variantId, exists, active, stock, currentPrice,
 *                     productId, productName, color, colorHex, image }] }
 *   (CartItemDto: { variantId, productId, productName, color, colorHex, price, image, stock, qty })
 *
 * Khi backend chưa sẵn sàng, dùng mock và áp đúng logic ở client.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { getCart, clearCart } from '../utils/cart';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gộp giỏ local vào giỏ server sau khi đăng nhập — F-006 → FR-008.
 * Real: POST /cart/merge, thành công → xóa giỏ local.
 * Mock: no-op, chỉ báo số món sẽ gộp.
 */
export async function mergeLocalCart() {
  const items = getCart();
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return { mergedCount: items.length, skipped: [] };
  }
  const payload = items.map((i) => ({ variantId: i.variantId, qty: i.qty }));
  const { data } = await axiosClient.post('/cart/merge', { items: payload });
  clearCart();
  return data;
}

/**
 * Lấy giỏ hàng trên server (đã đăng nhập).
 * Mock: null — chưa có giỏ server, FE dùng giỏ localStorage.
 */
export async function getServerCart() {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return null;
  }
  const { data } = await axiosClient.get('/cart');
  return data;
}

/**
 * Validate giỏ trên server — F-005.
 * Real: POST /cart/validate → data.results (mảng theo contract trên).
 * Mock: null → page dùng lookupVariants() của productApi thay thế.
 */
export async function validateOnServer(items) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return null;
  }
  const payload = items.map((i) => ({
    variantId: i.variantId,
    qty: i.qty,
    price: i.price,
  }));
  const { data } = await axiosClient.post('/cart/validate', { items: payload });
  return data?.results || [];
}

/**
 * Chuẩn bị cho màn Đăng nhập: sau login thành công gọi hàm này để gộp giỏ.
 * Copy đã duyệt: "Đã gộp {N} sản phẩm từ giỏ hàng trước khi đăng nhập của bạn."
 */
export async function mergeCartAfterLogin(onToast) {
  const localCount = getCart().length;
  if (localCount === 0) return { mergedCount: 0, skipped: [] };
  const result = await mergeLocalCart();
  const n = result?.mergedCount ?? localCount;
  onToast?.(`Đã gộp ${n} sản phẩm từ giỏ hàng trước khi đăng nhập của bạn.`);
  return result;
}
