/**
 * API module wishlist — FR-018 / F-013.
 *
 * Contract (khớp spec §6):
 *   POST /wishlist            { productId, priceAtSave } -> 201 { item }
 *     (trùng cặp user+product -> 409, FE coi như đã lưu — idempotent)
 *   DELETE /wishlist/{productId} -> 204
 *   GET /wishlist             -> [{ productId, addedAt, priceAtSave, product }]
 *   POST /wishlist/merge     { items: [{ productId, priceAtSave, addedAt }] }
 *     -> { merged: N } (server union theo productId)
 *
 * Khi backend chưa sẵn sàng, dùng mock và áp đúng logic ở client.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 * Mọi mutation thành công đều dispatch `mocan:wishlist-changed`.
 */
import axiosClient from './axiosClient';
import { mockAllProducts } from '../mocks/homeMock';
import { isLoggedIn } from '../utils/auth';
import {
  getWishlistLocal,
  getLocalWishlistCount,
  clearWishlistLocal,
} from '../utils/wishlist';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function emitChanged() {
  window.dispatchEvent(new Event('mocan:wishlist-changed'));
}

/* ---------------- Mock data: 5 món mẫu demo theo spec §6 ---------------- */
/** forceInactive: giả lập sản phẩm ngừng bán (active=false) mà không động vào mock gốc. */
const MOCK_ITEMS = [
  // Sofa góc L Nordic: lưu lúc 13.500.000đ, hiện 12.900.000đ -> badge "Đã giảm giá"
  { productId: 'p1', priceAtSave: 13500000, addedAt: '2026-10-11T06:40:00Z' },
  // Ghế ăn bọc vải: giá không đổi
  { productId: 'p5', priceAtSave: 1450000, addedAt: '2026-10-10T15:20:00Z' },
  // Bàn trà gỗ sồi: giá không đổi
  { productId: 'p3', priceAtSave: 3450000, addedAt: '2026-10-09T11:05:00Z' },
  // Kệ tivi gỗ tự nhiên: ngừng bán -> nhãn "Ngừng kinh doanh"
  { productId: 'p6', priceAtSave: 4200000, addedAt: '2026-10-08T09:12:00Z', forceInactive: true },
  // Giường 1m6 gỗ sồi: hết hàng toàn bộ màu -> badge "Hết hàng"
  { productId: 'p17', priceAtSave: 11200000, addedAt: '2026-10-07T18:44:00Z', forceOutOfStock: true },
];

/** Enrich item mock từ mockAllProducts; product = null nếu không tìm thấy. */
function enrichMock(item) {
  const found = mockAllProducts.find((p) => p.id === item.productId) || null;
  let product = found;
  if (product && item.forceInactive) {
    product = { ...product, active: false };
  }
  if (product && item.forceOutOfStock) {
    product = {
      ...product,
      variants: (product.variants || []).map((v) => ({ ...v, stock: 0 })),
    };
  }
  return {
    productId: item.productId,
    addedAt: item.addedAt,
    priceAtSave: item.priceAtSave,
    product,
  };
}

/**
 * Lấy wishlist trên server (đã đăng nhập).
 * Mock: trả 5 món mẫu demo đã enrich.
 */
export async function getWishlist() {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return MOCK_ITEMS.map(enrichMock);
  }
  const { data } = await axiosClient.get('/wishlist');
  return data || [];
}

/**
 * Thêm vào wishlist server. 409 (trùng) -> coi như thành công (idempotent).
 * Mock: no-op.
 */
export async function addToWishlist(productId, priceAtSave) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    emitChanged();
    return { ok: true };
  }
  try {
    const { data } = await axiosClient.post('/wishlist', { productId, priceAtSave });
    emitChanged();
    return data;
  } catch (err) {
    if (err?.response?.status === 409) {
      emitChanged();
      return { ok: true, duplicate: true };
    }
    throw err;
  }
}

/** Xóa khỏi wishlist server. Mock: no-op. */
export async function removeFromWishlist(productId) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    emitChanged();
    return;
  }
  await axiosClient.delete(`/wishlist/${productId}`);
  emitChanged();
}

/**
 * Đồng bộ wishlist local lên server sau login — song song F-006 của giỏ hàng.
 * Server union theo productId (giữ addedAt sớm nhất, priceAtSave bản local).
 * Real: POST /wishlist/merge, thành công -> xóa local.
 * Mock: no-op phía server, chỉ báo số món (N > 0 mới hiện toast).
 * Copy đã duyệt: "Đã đồng bộ {N} sản phẩm yêu thích từ trước khi đăng nhập của bạn."
 */
export async function mergeWishlistAfterLogin(onToast) {
  const local = getWishlistLocal();
  if (local.length === 0) return { merged: 0 };
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    onToast?.(
      `Đã đồng bộ ${local.length} sản phẩm yêu thích từ trước khi đăng nhập của bạn.`
    );
    return { merged: local.length };
  }
  const payload = local.map((i) => ({
    productId: i.productId,
    priceAtSave: i.priceAtSave,
    addedAt: i.addedAt,
  }));
  const { data } = await axiosClient.post('/wishlist/merge', { items: payload });
  clearWishlistLocal();
  const n = data?.merged ?? local.length;
  if (n > 0) {
    onToast?.(`Đã đồng bộ ${n} sản phẩm yêu thích từ trước khi đăng nhập của bạn.`);
  }
  emitChanged();
  return data;
}

/** Số món trong wishlist: server khi đã login, local khi khách vãng lai. */
export async function getWishlistCount() {
  if (isLoggedIn()) {
    const items = await getWishlist();
    return items.length;
  }
  return getLocalWishlistCount();
}

/**
 * Helper cho WishlistPage: trả về [{ productId, addedAt, priceAtSave, product }].
 * - Đã login -> từ server (GET /wishlist).
 * - Guest -> items local, enrich product từ catalog mock; nếu không enrich được
 *   (real mode) thì dựng product tối thiểu đủ để render card.
 */
export async function getWishlistItems() {
  if (isLoggedIn()) {
    return getWishlist();
  }
  const local = getWishlistLocal();
  return local.map((i) => {
    const found = mockAllProducts.find((p) => p.id === i.productId) || null;
    const product = found || {
      id: i.productId,
      name: i.name || '',
      slug: i.slug || '',
      images: i.image ? [{ url: i.image }] : [],
      ratingAvg: 0,
      ratingCount: 0,
      basePrice: i.priceAtSave,
      variants: [],
      active: true,
    };
    return {
      productId: i.productId,
      addedAt: i.addedAt,
      priceAtSave: i.priceAtSave,
      product,
    };
  });
}
