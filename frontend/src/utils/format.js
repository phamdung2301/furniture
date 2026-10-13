/** Định dạng tiền VND: 12900000 -> "12.900.000đ" */
export function formatVND(value) {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('vi-VN').format(value) + 'đ';
}

const pad2 = (n) => String(n).padStart(2, '0');

/** SĐT VN 10 số -> nhóm "0901 234 567" (admin-khach-hang.md §2.2). */
export function formatPhoneVN(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone || '';
}

/** ISO -> "11/10/2026 20:15" (dd/MM/yyyy HH:mm) — format tay cho ổn định mọi trình duyệt. */
export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** ISO -> "20:15, 11/10/2026" (HH:MM, dd/MM/yyyy) — dùng cho header/timeline đơn hàng. */
export function formatTimeDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** ISO -> "20:15, 11/10" (HH:MM, dd/MM) — dùng cho từng mốc timeline. */
export function formatTimeDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

/**
 * Flash sale ĐANG ÁP cho variant (flash-sale.md §5.1): chương trình đang diễn ra
 * và món chưa hết suất. Giá flash do backend trả trong variant.flashSale —
 * FE không tự nhân % ở bất kỳ đâu.
 */
export function activeFlash(variant) {
  const f = variant?.flashSale;
  if (!f || f.upcoming || f.itemSoldOut) return null;
  return f;
}

/** Giá hiệu lực của variant: giá flash nếu đang áp, ngược lại giá thường. */
export function variantPrice(variant) {
  if (!variant) return null;
  const f = activeFlash(variant);
  return f ? f.flashPrice : variant.price;
}

/** Vẽ sao đánh giá: 4.8 -> "★★★★★" (làm tròn nửa sao thành ★/☆ đơn giản) */
export function renderStars(ratingAvg) {
  const full = Math.round(ratingAvg);
  return '★'.repeat(Math.min(5, full)) + '☆'.repeat(Math.max(0, 5 - full));
}

/**
 * Thông tin hiển thị của Product Card (§3 spec, F-002 business rule).
 * - "Giá từ" = giá thấp nhất trong các MÀU còn hàng
 * - Hết hàng khi mọi màu đều stock = 0
 */
export function getCardInfo(product) {
  const variants = product.variants || [];
  const inStock = variants.filter((v) => v.stock > 0);
  const priced = (inStock.length > 0 ? inStock : variants).map((v) => v.price);
  const minPrice = priced.length > 0 ? Math.min(...priced) : product.basePrice;
  return {
    image: product.images?.[0]?.url,
    name: product.name,
    ratingAvg: product.ratingAvg ?? 0,
    ratingCount: product.ratingCount ?? 0,

    showFrom: variants.length > 1,
    price: minPrice,
    colors: variants.slice(0, 4),
    extraColors: Math.max(0, variants.length - 4),
    outOfStock: variants.length > 0 && inStock.length === 0,
    badge: product.badge || null,
  };
}
