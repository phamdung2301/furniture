/**
 * Tiện ích demo cho màn Đặt hàng (/dat-hang) — F-007.
 *
 * Nạp giỏ demo đúng số liệu spec §7 để kiểm tra luồng checkout:
 *   Sofa góc L Nordic (Xám) ×1 = 12.900.000đ
 * + Ghế ăn bọc vải ×2 = 2 × 1.450.000đ
 * = tạm tính 15.800.000đ · diện tích 4,2 m² (nấc 3–6 m²) · miễn phí ship
 *   (đơn ≥ 10.000.000đ) · NOITHAT50 giảm 200.000đ -> TỔNG 15.600.000đ.
 *
 * Cách dùng (mở DevTools Console trên trang web):
 *   const m = await import('/src/mocks/checkoutMock.js');
 *   m.seedDemoCheckoutCart();
 * rồi mở /gio-hang bấm "Đặt hàng". Đăng nhập demo: 0901234567 / matkhau123.
 */
import { mockAllProducts } from './homeMock';
import { CART_KEY } from '../utils/cart';

function findVariant(variantId) {
  for (const product of mockAllProducts) {
    const v = (product.variants || []).find((x) => x.id === variantId);
    if (v) return { product, variant: v };
  }
  return null;
}

function toCartItem(variantId, qty) {
  const found = findVariant(variantId);
  if (!found) return null;
  const { product, variant } = found;
  return {
    variantId: variant.id,
    productId: product.id,
    productName: product.name,
    color: variant.color,
    colorHex: variant.colorHex,
    price: variant.price,
    image: variant.images?.[0]?.url || product.images?.[0]?.url,
    stock: variant.stock,
    qty,
  };
}

export function seedDemoCheckoutCart() {
  const items = [toCartItem('v11', 1), toCartItem('v51', 2)].filter(Boolean);
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // Storage bị chặn: bỏ qua, trang sẽ xem như giỏ trống.
  }
  window.dispatchEvent(new Event('mocan:cart-changed'));
  return items;
}
