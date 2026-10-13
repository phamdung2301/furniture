/**
 * Mock chương trình Flash sale — flash-sale.md §9 (đã chốt số liệu nhất quán).
 * Shape Y HỆT GET /flash-sale/current của FlashSaleController backend.
 * Backend là nguồn giá duy nhất ở production; ở mock, file này đóng vai backend:
 * flashPrice tính tại đây (giá cố định | % giảm, làm tròn nghìn như FlashSaleService).
 *
 * usedCount = 73/100 (73%) — bằng tổng đã bán từng món: 14 + 29 + 6 + 4 + 20.
 */
import { mockAllProducts } from './homeMock';

export const MOCK_FLASH_PROGRAM_ID = 'fs1';
const TOTAL_USAGE_LIMIT = 100;
const USED_COUNT = 73;

/* Cấu hình theo món (khớp Voucher.items backend). */
const ITEM_CONFIG = [
  // Sofa góc L Nordic (Xám) — giảm 30% (US-018): 12.900.000đ -> 9.030.000đ
  { productId: 'p1', variantId: 'v11', discountPercent: 30, itemQuota: 20, itemSoldCount: 14 },
  // Ghế ăn bọc vải (Be) — giá cố định 990.000đ (gốc 1.450.000đ, badge -32%), sắp hết
  { productId: 'p5', variantId: 'v53', flashPrice: 990000, itemQuota: 30, itemSoldCount: 29 },
  // Bàn trà gỗ Sồi (Tự nhiên) — giảm 20%: 3.450.000đ -> 2.760.000đ
  { productId: 'p3', variantId: 'v31', discountPercent: 20, itemQuota: 15, itemSoldCount: 6 },
  // Đèn sàn trang trí (Đen) — giá cố định 749.000đ (gốc 890.000đ, badge -16%)
  { productId: 'p9', variantId: 'v91', flashPrice: 749000, itemQuota: 15, itemSoldCount: 4 },
  // Ghế lười hạt xốp (Xám) — giảm 25%: 650.000đ -> 488.000đ, đã hết suất
  { productId: 'p11', variantId: 'v111', discountPercent: 25, itemQuota: 20, itemSoldCount: 20 },
];

function programDates(mode) {
  const start = new Date();
  const end = new Date();
  if (mode === 'upcoming') {
    start.setDate(start.getDate() + 1);
    start.setHours(20, 0, 0, 0);
    end.setDate(end.getDate() + 2);
    end.setHours(22, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 1);
    start.setHours(20, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    end.setHours(22, 0, 0, 0);
  }
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function computeFlashPrice(cfg, originalPrice) {
  if (cfg.flashPrice != null) return cfg.flashPrice;
  if (cfg.discountPercent == null) return originalPrice;
  const discount = Math.round((originalPrice * cfg.discountPercent) / 100);
  const raw = originalPrice - discount;
  if (raw <= 0) return 0;
  return Math.round(raw / 1000) * 1000; // làm tròn nghìn như backend
}

function discountPercentOf(cfg, originalPrice, flashPrice) {
  if (cfg.discountPercent != null) return cfg.discountPercent;
  if (!originalPrice || flashPrice >= originalPrice) return 0;
  return Math.round(((originalPrice - flashPrice) / originalPrice) * 100);
}

function findConfig(productId, variantId) {
  return (
    ITEM_CONFIG.find(
      (c) => c.productId === productId && (c.variantId == null || c.variantId === variantId)
    ) || null
  );
}

/**
 * Field flashSale gắn vào variant (khớp ProductVariant.FlashSaleInfo backend) —
 * chỉ cho chương trình ĐANG DIỄN RA ở mock. null nếu variant không thuộc chương trình.
 */
export function mockFlashInfoFor(productId, variant) {
  const cfg = findConfig(productId, variant?.id);
  if (!cfg) return null;
  const { startAt, endAt } = programDates('running');
  const itemSoldOut = cfg.itemQuota != null && cfg.itemSoldCount >= cfg.itemQuota;
  return {
    programId: MOCK_FLASH_PROGRAM_ID,
    flashPrice: computeFlashPrice(cfg, variant.price),
    discountPercent: discountPercentOf(cfg, variant.price, computeFlashPrice(cfg, variant.price)),
    startAt,
    endAt,
    upcoming: false,
    itemSoldOut,
    itemQuota: cfg.itemQuota,
    itemSoldCount: cfg.itemSoldCount,
  };
}

/** Trả bản sao product với variants đã gắn flashSale (mock) — giữ nguyên nếu không liên quan. */
export function attachFlashSale(product) {
  if (!product || !Array.isArray(product.variants)) return product;
  let touched = false;
  const variants = product.variants.map((v) => {
    const info = mockFlashInfoFor(product.id, v);
    if (!info) return v;
    touched = true;
    return { ...v, flashSale: info };
  });
  return touched ? { ...product, variants } : product;
}

function buildItem(product, cfg, mode) {
  const programVariants = (product.variants || []).filter(
    (v) => cfg.variantId == null || v.id === cfg.variantId
  );
  const inStock = programVariants.filter((v) => v.stock > 0);
  const pool = inStock.length > 0 ? inStock : programVariants;
  const def = pool.reduce((best, v) => (best == null || v.price < best.price ? v : best), null);
  const sold = mode === 'upcoming' ? 0 : cfg.itemSoldCount;
  const itemSoldOut = cfg.itemQuota != null && sold >= cfg.itemQuota;
  const stockOut = programVariants.every((v) => v.stock <= 0);
  const flashPrice = computeFlashPrice(cfg, def.price);
  const distinct = new Set(programVariants.map((v) => computeFlashPrice(cfg, v.price)));
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.images?.[0]?.url || null,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    badge: product.badge || null,
    colors: (product.variants || []).map((v) => ({
      variantId: v.id,
      color: v.color,
      colorHex: v.colorHex,
      stock: v.stock,
    })),
    flashVariantIds: programVariants.map((v) => v.id),
    variantId: def.id,
    originalPrice: def.price,
    flashPrice,
    discountPercent: discountPercentOf(cfg, def.price, flashPrice),
    hasMultipleFlashPrices: distinct.size > 1,
    itemQuota: cfg.itemQuota,
    itemSoldCount: sold,
    itemSoldOut,
    stockOut,
    soldOut: itemSoldOut || stockOut,
  };
}

/** Chương trình hiện hành (mock) theo mode: 'running' | 'upcoming'. */
export function getMockFlashSaleProgram(mode = 'running') {
  const { startAt, endAt } = programDates(mode);
  return {
    id: MOCK_FLASH_PROGRAM_ID,
    status: mode === 'upcoming' ? 'UPCOMING' : 'RUNNING',
    startAt,
    endAt,
    serverNow: new Date().toISOString(),
    totalUsageLimit: TOTAL_USAGE_LIMIT,
    usedCount: mode === 'upcoming' ? 0 : USED_COUNT,
    items: ITEM_CONFIG.map((cfg) => {
      const product = mockAllProducts.find((p) => p.id === cfg.productId);
      return buildItem(product, cfg, mode);
    }),
  };
}
