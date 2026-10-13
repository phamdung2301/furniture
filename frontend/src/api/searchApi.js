/**
 * API module màn Tìm kiếm — F-003 / FR-004 / US-003.
 *
 * Contract (khớp SearchController backend):
 *   GET /products/search?q=ban+tra+go&page=1&size=24
 *       &priceMin=&priceMax=&colors=&materials=&sizes=
 *       &sort=relevance&inStock=
 *   -> { content: Product[], totalElements, totalPages, page, size, q }
 *
 * sort: relevance (mặc định, §3.2 spec) | popular | price_asc | price_desc | newest
 * q rỗng -> trả rỗng (F-003 edge case), trang gợi ý do SearchPage render.
 *
 * Khi backend chưa sẵn sàng, dùng mock và áp ĐÚNG logic xếp hạng ở client
 * (utils/search.rankProducts). Đổi VITE_USE_MOCK=false để gọi API thật.
 */
import axiosClient from './axiosClient';
import { mockAllProducts, mockCategories } from '../mocks/homeMock';
import { attachFlashSale } from '../mocks/flashSaleMock';
import { applyCatalogFilters, getFilterOptions } from './catalogApi';
import { rankProducts, normalizeVi } from '../utils/search';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const SEARCH_PAGE_SIZE = 24;
const MOCK_DELAY = 400;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const categoryNameOf = (p) =>
  mockCategories.find((c) => c.id === p.categoryId)?.name || '';

function toQuery(params) {
  const q = {};
  if (params.q) q.q = params.q;
  q.page = params.page || 1;
  q.size = params.size || SEARCH_PAGE_SIZE;
  if (params.priceMin != null) q.priceMin = params.priceMin;
  if (params.priceMax != null) q.priceMax = params.priceMax;
  if (params.colors?.length) q.colors = params.colors.join(',');
  if (params.materials?.length) q.materials = params.materials.join(',');
  if (params.sizes?.length) q.sizes = params.sizes.join(',');
  if (params.sort) q.sort = params.sort;
  if (params.inStock) q.inStock = true;
  return q;
}

const emptyPage = (q, size) => ({
  content: [],
  totalElements: 0,
  totalPages: 0,
  page: 1,
  size,
  q,
});

async function mockSearch(params) {
  const {
    q = '',
    sort = 'relevance',
    page = 1,
    size = SEARCH_PAGE_SIZE,
    ...filters
  } = params;
  await delay(MOCK_DELAY);
  const trimmed = q.trim();
  if (!trimmed) return emptyPage('', size);

  // 1. Xếp hạng liên quan trên toàn bộ catalog (§3.2 spec)
  const ranked = rankProducts(mockAllProducts, trimmed, categoryNameOf);
  const scores = new Map(ranked.map((r) => [r.product.id, r.score]));
  const candidates = ranked.map((r) => r.product);

  // 2. Áp 5 nhóm filter (tái dùng logic F-002), rồi khôi phục thứ tự
  //    liên quan nếu sort=relevance (filter không đổi thứ tự tương đối).
  let list = applyCatalogFilters(candidates, {
    ...filters,
    sort: sort === 'relevance' ? 'popular' : sort,
  });
  if (sort === 'relevance') {
    list = [...list].sort(
      (a, b) =>
        (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) ||
        (b.soldCount || 0) - (a.soldCount || 0)
    );
  }

  const totalElements = list.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    content: list.slice((safePage - 1) * size, safePage * size).map(attachFlashSale),
    totalElements,
    totalPages,
    page: safePage,
    size,
    q: trimmed,
  };
}

export function searchProducts(params = {}) {
  if (USE_MOCK) return mockSearch(params);
  return axiosClient
    .get('/products/search', { params: toQuery(params) })
    .then((r) => r.data);
}

/**
 * Gợi ý trực tiếp cho dropdown header (§1.1 spec):
 * tối đa 6 sản phẩm + 3 danh mục khớp nhất.
 * API thật: dùng /products/search?size=6 cho sản phẩm; danh mục tạm thời
 * chỉ có ở mock (TODO: thêm GET /categories/suggest khi backend sẵn sàng).
 */
export function getSuggestions(q) {
  const trimmed = q.trim();
  if (trimmed.length < 2) return Promise.resolve({ products: [], categories: [] });
  if (USE_MOCK) {
    const ranked = rankProducts(mockAllProducts, trimmed, categoryNameOf).slice(0, 6);
    const qN = normalizeVi(trimmed);
    const categories = mockCategories
      .filter((c) => normalizeVi(c.name).includes(qN))
      .slice(0, 3)
      .map((c) => ({
        ...c,
        count: mockAllProducts.filter(
          (p) => p.categoryId === c.id && p.active !== false
        ).length,
      }));
    return Promise.resolve({
      products: ranked.map((r) => attachFlashSale(r.product)),
      categories,
    });
  }
  return axiosClient
    .get('/products/search', { params: { q: trimmed, page: 1, size: 6, sort: 'relevance' } })
    .then((r) => ({ products: r.data.content || [], categories: [] }));
}

/**
 * Tuỳ chọn filter động theo tập kết quả tìm kiếm (§3.3 spec:
 * filter áp sau khi có tập kết quả). API thật: GET /products/search/facets?q=.
 */
export function getSearchFacets(q) {
  const trimmed = q.trim();
  if (USE_MOCK) {
    const ranked = rankProducts(mockAllProducts, trimmed, categoryNameOf);
    // Facets tính từ toàn bộ tập kết quả (chưa áp filter)
    return Promise.resolve(getFilterOptions(ranked.map((r) => r.product)));
  }
  return axiosClient
    .get('/products/search/facets', { params: { q: trimmed } })
    .then((r) => r.data);
}
