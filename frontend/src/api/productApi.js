/**
 * API module màn Chi tiết sản phẩm — F-004 / FR-005 / FR-006.
 *
 * Contract (khớp ProductController + ReviewController backend):
 *   GET /products/{slug}
 *     -> ProductDetailDto {
 *          id, name, slug, categoryId, categoryName, description, specs,
 *          images[], ratingAvg, ratingCount, soldCount, badge, active, featured,
 *          variants: ProductVariant[],           // theo màu, có sku/price/stock/colorHex
 *          reviewSummary: { average, total, distribution: {5,4,3,2,1} },
 *          related: ProductWithVariantsDto[]      // cùng danh mục, ≤8
 *        }
 *   GET /products/{slug}/reviews?page=1&size=5
 *     -> { content: Review[], totalElements, totalPages, page, size }
 *   (Review: id, productId, userName, rating, comment, images[], verifiedPurchase, createdAt)
 *
 * Khi backend chưa sẵn sàng, dùng mock data và áp đúng logic F-004 ở client.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { mockAllProducts, mockCategories, mockReviews } from '../mocks/homeMock';
import { attachFlashSale } from '../mocks/flashSaleMock';
import { getCart } from '../utils/cart';
import { validateOnServer } from './cartApi';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 500;
const REVIEW_PAGE_SIZE = 5;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function notFoundError() {
  const e = new Error('Không tìm thấy sản phẩm');
  e.status = 404;
  return e;
}

function toDetailShape(product) {
  const category = mockCategories.find((c) => c.id === product.categoryId);
  const reviews = mockReviews.filter((r) => r.productId === product.id);
  const related = mockAllProducts
    .filter((p) => p.id !== product.id && p.categoryId === product.categoryId && p.active !== false)
    .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    .slice(0, 8)
    .map(attachFlashSale);
  const withFlash = attachFlashSale(product);
  return {
    ...withFlash,
    categoryName: category?.name || '',
    categorySlug: category?.slug || '',
    reviewSummary: summarizeReviews(product, reviews),
    related,
  };
}

/** Tóm tắt đánh giá: điểm TB + tổng + phân bố % 5→1 sao. */
export function summarizeReviews(product, reviews) {
  const total = product.ratingCount || reviews.length;
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  // Tỉ lệ mẫu (spec §10) — production tính từ DB; ở mock dùng tỉ lệ cố định theo ratingAvg
  if (reviews.length > 0 && total > reviews.length) {
    dist[5] = 78; dist[4] = 15; dist[3] = 5; dist[2] = 1; dist[1] = 1;
  } else {
    reviews.forEach((r) => { dist[r.rating] = (dist[r.rating] || 0) + 1; });
    Object.keys(dist).forEach((k) => {
      dist[k] = total > 0 ? Math.round((dist[k] / total) * 100) : 0;
    });
  }
  return { average: product.ratingAvg || 0, total, distribution: dist };
}

/** Màu mặc định F-004: màu còn hàng rẻ nhất (bằng giá → đầu tiên). */
export function defaultVariant(product) {
  const variants = (product.variants || []).filter((v) => v.stock > 0);
  if (variants.length === 0) return (product.variants || [])[0] || null;
  return variants.reduce((best, v) => (v.price < best.price ? v : best), variants[0]);
}

/** Slug hoá tên màu cho ?mau= (Xám -> xam). */
export function colorSlug(color) {
  return (color || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function getProduct(slug) {
  if (!USE_MOCK) {
    const { data } = await axiosClient.get(`/products/${slug}`);
    return data;
  }
  await delay(MOCK_DELAY);
  const product = mockAllProducts.find((p) => p.slug === slug);
  if (!product || product.active === false) throw notFoundError();
  return toDetailShape(product);
}

export async function getProductReviews(slug, page = 1, size = REVIEW_PAGE_SIZE) {
  if (!USE_MOCK) {
    const { data } = await axiosClient.get(`/products/${slug}/reviews`, {
      params: { page, size },
    });
    return data;
  }
  await delay(MOCK_DELAY);
  const product = mockAllProducts.find((p) => p.slug === slug);
  if (!product || product.active === false) throw notFoundError();
  const all = mockReviews
    .filter((r) => r.productId === product.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalElements = all.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    content: all.slice((safePage - 1) * size, safePage * size),
    totalElements,
    totalPages,
    page: safePage,
    size,
  };
}

export { REVIEW_PAGE_SIZE };

/* ---------------- Giỏ hàng: validate (F-005) ---------------- */

/**
 * Tra cứu stock / giá / trạng thái hiện tại của các variant trong giỏ.
 * Mock: quét mockAllProducts theo id variant — active lấy từ product.active
 *   (mock variant KHÔNG có field active).
 * Real: gọi POST /cart/validate qua validateOnServer(), map currentPrice → price.
 * @returns Promise<map variantId -> { stock, price, active, productId,
 *   productName, color, colorHex, image } | null> (null = variant không tồn tại)
 */
export async function lookupVariants(variantIds) {
  const ids = [...new Set(variantIds || [])];
  if (!USE_MOCK) {
    const cartById = new Map(getCart().map((i) => [i.variantId, i]));
    const payload = ids.map((id) => {
      const it = cartById.get(id);
      return { variantId: id, qty: it?.qty || 1, price: it?.price || 0 };
    });
    const results = (await validateOnServer(payload)) || [];
    const map = {};
    for (const r of results) {
      if (!r || !r.variantId) continue;
      if (!r.exists || r.active === false) {
        map[r.variantId] = null;
      } else {
        map[r.variantId] = {
          stock: r.stock ?? 0,
          price: r.currentPrice,
          active: true,
          productId: r.productId,
          productName: r.productName,
          color: r.color,
          colorHex: r.colorHex,
          image: r.image,
        };
      }
    }
    ids.forEach((id) => {
      if (!(id in map)) map[id] = null;
    });
    return map;
  }
  await delay(MOCK_DELAY);
  const map = {};
  for (const id of ids) {
    map[id] = findMockVariantInfo(id);
  }
  return map;
}

/** Mock: tìm variant trong mockAllProducts, gom đủ field cho validateCart. */
function findMockVariantInfo(variantId) {
  for (const product of mockAllProducts) {
    const v = (product.variants || []).find((x) => x.id === variantId);
    if (v) {
      return {
        stock: v.stock ?? 0,
        price: v.price,
        active: product.active !== false,
        productId: product.id,
        productName: product.name,
        color: v.color,
        colorHex: v.colorHex,
        image: v.images?.[0]?.url || product.images?.[0]?.url,
        productSlug: product.slug, // phụ thêm cho link chi tiết SP ở giỏ hàng
      };
    }
  }
  return null;
}
