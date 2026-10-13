/**
 * Giỏ hàng khách vãng lai — FR-007: lưu ở localStorage (theo biến thể/màu).
 * Màn Giỏ hàng (F-005) sau này sẽ đọc cùng KEY này.
 */
export const CART_KEY = 'mocan_cart_v1';
const KEY = CART_KEY;

export function getCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('mocan:cart-changed'));
}

/**
 * Thêm vào giỏ. item: { variantId, productId, productName, color, colorHex,
 * price, image, stock, qty } — qty cộng dồn, trần = stock.
 */
export function addToCart(item) {
  const items = getCart();
  const found = items.find((i) => i.variantId === item.variantId);
  if (found) {
    found.qty = Math.min(found.stock, found.qty + item.qty);
  } else {
    items.push({ ...item, qty: Math.min(item.stock, Math.max(1, item.qty || 1)) });
  }
  saveCart(items);
  return items;
}

export function getCartCount() {
  return getCart().reduce((sum, i) => sum + (i.qty || 0), 0);
}

/** Tổng tạm tính: Σ price × qty. */
export function getCartSubtotal() {
  return getCart().reduce((sum, i) => sum + (i.price || 0) * (i.qty || 0), 0);
}

/**
 * Đổi số lượng 1 dòng — clamp 1..min(99, stock) theo F-005.
 * Không có dòng tương ứng → giữ nguyên giỏ.
 */
export function updateQty(variantId, qty) {
  const items = getCart();
  const found = items.find((i) => i.variantId === variantId);
  if (found) {
    const cap = Math.max(1, Math.min(99, found.stock || 1));
    found.qty = Math.min(Math.max(1, Math.floor(Number(qty)) || 1), cap);
    saveCart(items);
  }
  return items;
}

/**
 * Xóa 1 dòng khỏi giỏ. Trả về { items, removed: { item, index } | null }
 * để UI hiện toast "Hoàn tác".
 */
export function removeItem(variantId) {
  const items = getCart();
  const index = items.findIndex((i) => i.variantId === variantId);
  if (index === -1) return { items, removed: null };
  const [item] = items.splice(index, 1);
  saveCart(items);
  return { items, removed: { item, index } };
}

/** Chèn lại đúng vị trí dòng vừa xóa (Hoàn tác). */
export function restoreItem(removed) {
  const items = getCart();
  if (removed?.item && !items.some((i) => i.variantId === removed.item.variantId)) {
    const index = Math.max(0, Math.min(removed.index ?? items.length, items.length));
    items.splice(index, 0, removed.item);
    saveCart(items);
  }
  return items;
}

/** Xóa sạch giỏ (dùng sau khi gộp giỏ lên server thành công). */
export function clearCart() {
  saveCart([]);
  return [];
}

/** Áp giá mới cho 1 dòng khi user bấm "Cập nhật giá". */
export function updatePrice(variantId, newPrice) {
  const items = getCart();
  const found = items.find((i) => i.variantId === variantId);
  if (found && Number.isFinite(newPrice) && newPrice > 0) {
    found.price = newPrice;
    saveCart(items);
  }
  return items;
}

/**
 * Validate giỏ với dữ liệu mới nhất — F-005 edge cases.
 * @param {(variantIds: string[]) => Promise<Object>} lookup — async fn nhận mảng
 *   variantIds, trả về map variantId → { stock, price, active, productId,
 *   productName, color, colorHex, image } | null (null = variant không tồn tại).
 * Với mỗi item:
 *   - lookup null HOẶC active === false HOẶC stock === 0 → loại khỏi giỏ, gom vào removed[]
 *   - price !== item.price → gom vào priceChanges[] (GIỮ giá cũ trong giỏ, không tự đổi)
 * Lưu giỏ đã loại + dispatch event. Trả về { removed, priceChanges }.
 */
export async function validateCart(lookup) {
  const items = getCart();
  if (items.length === 0) return { removed: [], priceChanges: [] };
  const infoMap = (await lookup(items.map((i) => i.variantId))) || {};
  const removed = [];
  const priceChanges = [];
  const kept = [];
  for (const item of items) {
    const info = infoMap[item.variantId];
    if (!info || info.active === false || (info.stock ?? 0) <= 0) {
      removed.push(item);
      continue;
    }
    item.stock = info.stock; // làm mới snapshot tồn kho cho stepper
    if (info.price !== item.price) {
      priceChanges.push({
        variantId: item.variantId,
        productName: item.productName,
        color: item.color,
        oldPrice: item.price,
        newPrice: info.price,
      });
    }
    kept.push(item);
  }
  saveCart(kept);
  return { removed, priceChanges };
}
