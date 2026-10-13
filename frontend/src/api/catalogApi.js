/**
 * API module màn Danh mục — F-002 / FR-002 / FR-003.
 *
 * Contract (khớp CatalogController backend):
 *   GET /products?categorySlug=sofa&page=1&size=24
 *       &priceMin=5000000&priceMax=10000000
 *       &colors=Xám,Be&materials=Vải bố&sizes=vua
 *       &sort=popular&inStock=true
 *   -> { content: Product[], totalElements, totalPages, page, size }
 *
 * sort: popular | price_asc | price_desc | newest
 * sizes: nho (<1m) | vua (1-2m) | lon (>2m) — theo lengthM lớn nhất của variant
 *
 * Khi backend chưa sẵn sàng, dùng mock data và áp ĐÚNG logic F-002 ở client
 * (lọc trên "giá từ" = min giá màu còn hàng — utils/format.getCardInfo).
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { mockAllProducts, mockCategories } from '../mocks/homeMock';
import { attachFlashSale } from '../mocks/flashSaleMock';
import { getCardInfo } from '../utils/format';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const PAGE_SIZE = 24;
const MOCK_DELAY = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Chuẩn hoá chuỗi để so khớp chất liệu (bỏ dấu, thường) */
function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function cardPrice(p) {
  return getCardInfo(p).price;
}

function inSizeBucket(lengthM, bucket) {
  if (bucket === 'nho') return lengthM < 1;
  if (bucket === 'vua') return lengthM >= 1 && lengthM <= 2;
  if (bucket === 'lon') return lengthM > 2;
  return false;
}

function productMaterials(p) {
  const fromSpecs = p.specs?.['Chất liệu'] || '';
  const fromVariants = (p.variants || []).map((v) => v.materialNote || '').join(' ');
  return `${fromSpecs} ${fromVariants}`;
}

/** Áp logic F-002 lên danh sách sản phẩm (dùng cho mock; backend làm tương tự). */
export function applyCatalogFilters(products, params) {
  const {
    categoryId = null,
    priceMin = null,
    priceMax = null,
    colors = [],
    materials = [],
    sizes = [],
    sort = 'popular',
    inStock = false,
  } = params;

  let list = products.filter((p) => p.active !== false);
  if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
  if (inStock) list = list.filter((p) => !getCardInfo(p).outOfStock);
  if (priceMin != null) list = list.filter((p) => cardPrice(p) >= priceMin);
  if (priceMax != null) list = list.filter((p) => cardPrice(p) <= priceMax);
  if (colors.length > 0) {
    list = list.filter((p) =>
      (p.variants || []).some((v) => colors.includes(v.color) && v.stock > 0)
    );
  }
  if (materials.length > 0) {
    const wants = materials.map(norm);
    list = list.filter((p) => {
      const have = norm(productMaterials(p));
      return wants.some((w) => have.includes(w));
    });
  }
  if (sizes.length > 0) {
    list = list.filter((p) =>
      (p.variants || []).some((v) => sizes.some((b) => inSizeBucket(v.lengthM || 0, b)))
    );
  }

  const sorted = [...list];
  switch (sort) {
    case 'price_asc':
      sorted.sort((a, b) => cardPrice(a) - cardPrice(b));
      break;
    case 'price_desc':
      sorted.sort((a, b) => cardPrice(b) - cardPrice(a));
      break;
    case 'newest':
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'popular':
    default:
      sorted.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
      break;
  }
  return sorted;
}

/** Tìm danh mục theo slug (mock). Trả null nếu không khớp — trang sẽ hiện tất cả. */
export function getCategoryBySlug(slug) {
  return mockCategories.find((c) => c.slug === slug) || null;
}

/**
 * Tuỳ chọn filter động theo danh mục hiện tại (§3.2, §3.3 spec):
 * chỉ liệt kê màu/chất liệu xuất hiện trong các sản phẩm của danh mục.
 */
export function getFilterOptions(products) {
  const colorMap = new Map();
  const materialSet = new Set();
  products.forEach((p) => {
    (p.variants || []).forEach((v) => {
      if (!v.color) return;
      const cur = colorMap.get(v.color) || { name: v.color, colorHex: v.colorHex, inStock: false };
      cur.inStock = cur.inStock || v.stock > 0;
      if (!cur.colorHex && v.colorHex) cur.colorHex = v.colorHex;
      colorMap.set(v.color, cur);
    });
    const mat = p.specs?.['Chất liệu'];
    if (mat) materialSet.add(mat);
  });
  return {
    colors: [...colorMap.values()],
    materials: [...materialSet].sort((a, b) => a.localeCompare(b, 'vi')),
  };
}

function toQuery(params) {
  const q = {};
  if (params.categorySlug) q.categorySlug = params.categorySlug;
  q.page = params.page || 1;
  q.size = params.size || PAGE_SIZE;
  if (params.priceMin != null) q.priceMin = params.priceMin;
  if (params.priceMax != null) q.priceMax = params.priceMax;
  if (params.colors?.length) q.colors = params.colors.join(',');
  if (params.materials?.length) q.materials = params.materials.join(',');
  if (params.sizes?.length) q.sizes = params.sizes.join(',');
  if (params.sort) q.sort = params.sort;
  if (params.inStock) q.inStock = true;
  return q;
}

async function mockGetProducts(params) {
  await delay(MOCK_DELAY);
  const category = params.categorySlug ? getCategoryBySlug(params.categorySlug) : null;
  const filtered = applyCatalogFilters(mockAllProducts, {
    ...params,
    categoryId: category ? category.id : null,
  });
  const page = Math.max(1, params.page || 1);
  const size = params.size || PAGE_SIZE;
  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const safePage = Math.min(page, totalPages);
  const content = filtered.slice((safePage - 1) * size, safePage * size).map(attachFlashSale);
  return { content, totalElements, totalPages, page: safePage, size };
}

export function getProducts(params = {}) {
  if (USE_MOCK) return mockGetProducts(params);
  return axiosClient.get('/products', { params: toQuery(params) }).then((r) => r.data);
}

export function getCategory(slug) {
  if (USE_MOCK) return Promise.resolve(getCategoryBySlug(slug));
  return axiosClient.get('/categories/by-slug', { params: { slug } }).then((r) => r.data);
}

/**
 * Tuỳ chọn filter động theo danh mục (§3.2, §3.3 spec).
 * Mock: tính từ toàn bộ sản phẩm của danh mục. API thật: GET /products/facets.
 */
export function getFacets(categorySlug) {
  if (USE_MOCK) {
    const category = categorySlug ? getCategoryBySlug(categorySlug) : null;
    const products = category
      ? mockAllProducts.filter((p) => p.categoryId === category.id && p.active !== false)
      : mockAllProducts.filter((p) => p.active !== false);
    return Promise.resolve(getFilterOptions(products));
  }
  return axiosClient
    .get('/products/facets', { params: { categorySlug } })
    .then((r) => r.data);
}
