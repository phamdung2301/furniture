/**
 * Wishlist khách vãng lai — FR-018: lưu ở localStorage.
 * Shape mỗi item: { productId, slug, name, image, priceAtSave, addedAt }.
 * priceAtSave = giá variant mặc định (F-004) tại thời điểm bấm tim — dùng cho
 * badge "Đã giảm giá" (§3 spec). Sau mỗi thay đổi bắn event
 * `mocan:wishlist-changed` để header + mọi nơi cập nhật realtime (song song
 * pattern `mocan:cart-changed` của giỏ hàng).
 */
export const WISHLIST_KEY = 'mocan_wishlist_v1';
const KEY = WISHLIST_KEY;

export function getWishlistLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveWishlist(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('mocan:wishlist-changed'));
}

export function isWishedLocal(productId) {
  if (!productId) return false;
  return getWishlistLocal().some((i) => i.productId === productId);
}

/** Thêm 1 món vào wishlist local (idempotent theo productId). */
export function addWish(item) {
  if (!item || !item.productId) return getWishlistLocal();
  const items = getWishlistLocal();
  if (!items.some((i) => i.productId === item.productId)) {
    items.push({
      productId: item.productId,
      slug: item.slug || null,
      name: item.name || '',
      image: item.image || null,
      priceAtSave: item.priceAtSave ?? null,
      addedAt: item.addedAt || new Date().toISOString(),
    });
    saveWishlist(items);
  }
  return items;
}

/** Xóa 1 món khỏi wishlist local. */
export function removeWish(productId) {
  const items = getWishlistLocal().filter((i) => i.productId !== productId);
  saveWishlist(items);
  return items;
}

/** Toggle 1 món — trả về true nếu sau toggle món đang được lưu. */
export function toggleWish(item) {
  if (isWishedLocal(item.productId)) {
    removeWish(item.productId);
    return false;
  }
  addWish(item);
  return true;
}

export function getLocalWishlistCount() {
  return getWishlistLocal().length;
}

/** Xóa sạch wishlist local (dùng sau khi gộp lên server thành công). */
export function clearWishlistLocal() {
  saveWishlist([]);
  return [];
}
