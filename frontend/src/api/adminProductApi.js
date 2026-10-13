/**
 * API Quản lý sản phẩm (admin) — FR-020 · F-014 · US-013.
 *
 * Contract (khớp AdminProductController backend — admin-san-pham.md §6):
 *   GET    /admin/products?q=&categoryId=&active=&sort=&page=&size=
 *     -> { content: [{ id, name, slug, image, categoryId, categoryName,
 *          variantCount, colorHexes, minPrice, totalStock,
 *          lowStockVariantCount, active, featured, hasOrders, createdAt }],
 *          totalElements, totalPages, page, size }   (page 1-indexed)
 *   GET    /admin/products/{id} -> chi tiết nạp form (kèm variants theo màu)
 *   POST   /admin/products      -> 201 · 409 { field: "slug"|"sku" } · 422 rule F-014
 *   PUT    /admin/products/{id} -> 200 · 409 { field: "variant" } khi xóa màu đã có đơn
 *   DELETE /admin/products/{id} -> 204 · 409 { code: "HAS_ORDERS" }
 *   PATCH  /admin/products/{id} -> { active } | { featured }
 *   POST   /admin/products/images (multipart "files") -> [{ url }]
 *
 * Lỗi ném ra có dạng Error kèm .status / .code / .field / .message để form
 * gắn lỗi đúng trường (slug/SKU) và trang xử lý HAS_ORDERS.
 *
 * Mock: thao tác trực tiếp trên mockAllProducts (homeMock.js) — các màn
 * khách hàng đọc cùng mảng này nên thấy thay đổi ngay.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { mockAllProducts, mockCategories } from '../mocks/homeMock';
import { getMockCategories } from './adminCategoryApi';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 450;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function apiError(status, { code = null, field = null, message }) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.field = field;
  return err;
}

function normalizeRealError(e) {
  const status = e?.response?.status;
  const data = e?.response?.data || {};
  return apiError(status || 0, {
    code: data.code || (e?.code === 'ERR_NETWORK' ? 'network' : 'unknown'),
    field: data.field || null,
    message: data.message || 'Không tải được dữ liệu. Kiểm tra kết nối và thử lại.',
  });
}

async function callApi(fn) {
  try {
    return await fn();
  } catch (e) {
    throw normalizeRealError(e);
  }
}

/* --------------------------- Mock internals --------------------------- */

/**
 * Sản phẩm "đã có đơn liên quan" trong dữ liệu mẫu (F-014 → chỉ ngừng bán):
 * p1/p3/p5/p11/p18/p22/p23 xuất hiện trong đơn mẫu của orderApi;
 * p6 (Kệ tivi) theo đúng kịch bản spec admin-san-pham §2.4/§5.
 */
const MOCK_HAS_ORDERS = new Set(['p1', 'p3', 'p5', 'p6', 'p11', 'p18', 'p22', 'p23']);

let idSeq = 1000;
const genId = (prefix) => `${prefix}${(idSeq += 1)}`;

const categoryName = (id) => mockCategories.find((c) => c.id === id)?.name || '';

function toListItem(p) {
  const variants = p.variants || [];
  const prices = variants.map((v) => v.price).filter((n) => typeof n === 'number');
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: [...(p.images || [])].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url || null,
    categoryId: p.categoryId,
    categoryName: categoryName(p.categoryId),
    variantCount: variants.length,
    colorHexes: variants.map((v) => v.colorHex),
    minPrice: prices.length ? Math.min(...prices) : null,
    totalStock: variants.reduce((s, v) => s + (v.stock || 0), 0),
    lowStockVariantCount: variants.filter(
      (v) => (v.stock || 0) <= (v.lowStockThreshold ?? 5)
    ).length,
    active: p.active !== false,
    featured: Boolean(p.featured),
    hasOrders: MOCK_HAS_ORDERS.has(p.id),
    createdAt: p.createdAt,
  };
}

function toDetail(p) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    description: p.description || '',
    specs: { ...(p.specs || {}) },
    basePrice: p.basePrice || 0,
    badge: p.badge ? { ...p.badge } : null,
    images: [...(p.images || [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((im) => ({ url: im.url, sortOrder: im.sortOrder })),
    featured: Boolean(p.featured),
    active: p.active !== false,
    variants: (p.variants || []).map((v) => ({
      id: v.id,
      sku: v.sku,
      color: v.color,
      colorHex: v.colorHex,
      price: v.price,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold ?? 5,
      lengthM: v.lengthM,
      widthM: v.widthM,
      sizeLabel: v.sizeLabel || '',
      materialNote: v.materialNote || '',
    })),
  };
}

function findMockProduct(id) {
  const p = mockAllProducts.find((x) => x.id === id);
  if (!p) {
    throw apiError(404, { code: 'PRODUCT_NOT_FOUND', message: 'Không tìm thấy sản phẩm.' });
  }
  return p;
}

function checkMockUnique(body, excludeId) {
  const slugDup = mockAllProducts.some((p) => p.id !== excludeId && p.slug === body.slug);
  if (slugDup) {
    throw apiError(409, {
      code: 'SLUG_EXISTS',
      field: 'slug',
      message: 'Slug đã được dùng bởi sản phẩm khác.',
    });
  }
  const seen = new Set();
  for (const v of body.variants || []) {
    const sku = (v.sku || '').trim();
    if (seen.has(sku.toLowerCase())) {
      throw apiError(409, {
        code: 'SKU_EXISTS',
        field: 'sku',
        message: `SKU ${sku} đã tồn tại.`,
      });
    }
    seen.add(sku.toLowerCase());
    const dup = mockAllProducts.some(
      (p) =>
        p.id !== excludeId &&
        (p.variants || []).some((x) => (x.sku || '').toLowerCase() === sku.toLowerCase())
    );
    if (dup) {
      throw apiError(409, {
        code: 'SKU_EXISTS',
        field: 'sku',
        message: `SKU ${sku} đã tồn tại.`,
      });
    }
  }
}

/* ------------------------------ Public API ------------------------------ */

/** Danh sách sản phẩm admin — lọc/tìm/sắp xếp/phân trang (FR-020). */
export async function listProducts(params = {}) {
  const { q = '', categoryId = '', active = '', sort = 'newest', page = 1, size = 10 } = params;
  if (!USE_MOCK) {
    return callApi(async () => {
      const query = { sort, page, size };
      if (q) query.q = q;
      if (categoryId) query.categoryId = categoryId;
      if (active !== '' && active !== null && active !== undefined) query.active = active;
      const { data } = await axiosClient.get('/admin/products', { params: query });
      return data;
    });
  }
  await delay(MOCK_DELAY);
  const needle = q.trim().toLowerCase();
  let rows = mockAllProducts.filter((p) => {
    if (categoryId && p.categoryId !== categoryId) return false;
    if (active !== '' && active !== null && active !== undefined) {
      if ((p.active !== false) !== Boolean(active)) return false;
    }
    if (needle) {
      const nameHit = p.name.toLowerCase().includes(needle);
      const skuHit = (p.variants || []).some((v) =>
        (v.sku || '').toLowerCase().includes(needle)
      );
      if (!nameHit && !skuHit) return false;
    }
    return true;
  });
  const by = {
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    name_asc: (a, b) => a.name.localeCompare(b.name, 'vi'),
    name_desc: (a, b) => b.name.localeCompare(a.name, 'vi'),
    price_asc: (a, b) => (toListItem(a).minPrice ?? 0) - (toListItem(b).minPrice ?? 0),
    price_desc: (a, b) => (toListItem(b).minPrice ?? 0) - (toListItem(a).minPrice ?? 0),
    stock_asc: (a, b) => toListItem(a).totalStock - toListItem(b).totalStock,
    stock_desc: (a, b) => toListItem(b).totalStock - toListItem(a).totalStock,
  };
  rows = [...rows].sort(by[sort] || by.newest);
  const totalElements = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const content = rows.slice((safePage - 1) * size, safePage * size).map(toListItem);
  return { content, totalElements, totalPages, page: safePage, size };
}

/** Chi tiết sản phẩm nạp vào form sửa. */
export async function getProduct(id) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get(`/admin/products/${id}`)).data);
  }
  await delay(MOCK_DELAY);
  return toDetail(findMockProduct(id));
}

/** Tạo sản phẩm mới → 201 chi tiết. */
export async function createProduct(body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.post('/admin/products', body)).data);
  }
  await delay(MOCK_DELAY);
  checkMockUnique(body, null);
  const id = genId('p');
  const product = {
    id,
    name: body.name,
    slug: body.slug,
    categoryId: body.categoryId,
    description: body.description || '',
    specs: { ...(body.specs || {}) },
    basePrice: body.basePrice || 0,
    badge: body.badge || null,
    images: (body.images || []).map((im, i) => ({ url: im.url, sortOrder: i + 1 })),
    ratingAvg: 0,
    ratingCount: 0,
    soldCount: 0,
    featured: Boolean(body.featured),
    active: body.active !== false,
    createdAt: new Date().toISOString(),
    variants: (body.variants || []).map((v) => ({
      id: genId('v'),
      productId: id,
      sku: v.sku,
      color: v.color,
      colorHex: v.colorHex,
      price: v.price,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold ?? 5,
      lengthM: v.lengthM,
      widthM: v.widthM,
      sizeLabel: v.sizeLabel || '',
      materialNote: v.materialNote || '',
    })),
  };
  mockAllProducts.unshift(product);
  return toDetail(product);
}

/** Cập nhật sản phẩm → chi tiết. 409 field "variant" khi xóa màu đã có đơn. */
export async function updateProduct(id, body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.put(`/admin/products/${id}`, body)).data);
  }
  await delay(MOCK_DELAY);
  const p = findMockProduct(id);
  checkMockUnique(body, id);
  const keptIds = new Set((body.variants || []).map((v) => v.id).filter(Boolean));
  const removed = (p.variants || []).filter((v) => !keptIds.has(v.id));
  if (removed.length && MOCK_HAS_ORDERS.has(id)) {
    const first = removed[0];
    throw apiError(409, {
      code: 'VARIANT_HAS_ORDERS',
      field: 'variant',
      message:
        `Màu ${first.color} đã có trong đơn hàng, không thể xóa. ` +
        'Hãy đặt tồn kho = 0 hoặc ngừng bán sản phẩm.',
    });
  }
  p.name = body.name;
  p.slug = body.slug;
  p.categoryId = body.categoryId;
  p.description = body.description || '';
  p.specs = { ...(body.specs || {}) };
  p.basePrice = body.basePrice || 0;
  p.badge = body.badge || null;
  p.images = (body.images || []).map((im, i) => ({ url: im.url, sortOrder: i + 1 }));
  p.featured = Boolean(body.featured);
  p.active = body.active !== false;
  p.variants = (body.variants || []).map((v) => ({
    id: v.id || genId('v'),
    productId: id,
    sku: v.sku,
    color: v.color,
    colorHex: v.colorHex,
    price: v.price,
    stock: v.stock,
    lowStockThreshold: v.lowStockThreshold ?? 5,
    lengthM: v.lengthM,
    widthM: v.widthM,
    sizeLabel: v.sizeLabel || '',
    materialNote: v.materialNote || '',
  }));
  return toDetail(p);
}

/** Xóa cứng — chỉ khi chưa có đơn; có đơn → 409 HAS_ORDERS (F-014). */
export async function deleteProduct(id) {
  if (!USE_MOCK) {
    return callApi(async () => {
      await axiosClient.delete(`/admin/products/${id}`);
      return null;
    });
  }
  await delay(MOCK_DELAY);
  const p = findMockProduct(id);
  if (MOCK_HAS_ORDERS.has(id)) {
    throw apiError(409, {
      code: 'HAS_ORDERS',
      message:
        'Sản phẩm đã có trong đơn hàng nên không thể xóa. Hãy ngừng bán sản phẩm thay vì xóa.',
    });
  }
  const idx = mockAllProducts.indexOf(p);
  if (idx >= 0) mockAllProducts.splice(idx, 1);
  return null;
}

/** PATCH nhanh: { active } (ngừng bán/bán lại) hoặc { featured } (toggle ★). */
export async function patchProduct(id, patch) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.patch(`/admin/products/${id}`, patch)).data);
  }
  await delay(250);
  const p = findMockProduct(id);
  if (patch.active !== undefined) p.active = Boolean(patch.active);
  if (patch.featured !== undefined) p.featured = Boolean(patch.featured);
  return toListItem(p);
}

/**
 * Upload ảnh sản phẩm — gọi ngay khi admin chọn file.
 * Mock: trả object URL của chính file để xem trước.
 */
export async function uploadProductImages(files) {
  if (!USE_MOCK) {
    return callApi(async () => {
      const form = new FormData();
      (files || []).forEach((f) => form.append('files', f));
      const { data } = await axiosClient.post('/admin/products/images', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data; // [{ url }]
    });
  }
  await delay(600);
  return (files || []).map((f) => ({ url: URL.createObjectURL(f) }));
}

/**
 * Danh mục cho ô lọc + select trong form.
 * GET /admin/categories đã chính thức hoá ở màn 16 (admin-danh-muc.md §7 —
 * shape id, name, parentId tương thích dropdown màn này). Khi mock, lấy từ
 * kho dùng chung của adminCategoryApi để thấy cả danh mục con + thay đổi
 * vừa làm ở màn Danh mục trong cùng phiên.
 */
export async function listCategories() {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get('/admin/categories')).data);
  }
  await delay(200);
  return getMockCategories();
}
