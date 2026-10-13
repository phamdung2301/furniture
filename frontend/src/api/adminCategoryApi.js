/**
 * API Quản lý danh mục (admin) — FR-021 · F-015 (admin-danh-muc.md §7).
 *
 * Contract (khớp AdminCategoryController backend):
 *   GET    /admin/categories
 *     -> [{ id, name, slug, parentId, imageUrl, sortOrder, active,
 *           productCount, hasChildren, createdAt }]  (toàn bộ phẳng,
 *           sortOrder tăng dần — FE tự dựng cây + phân trang theo cụm cha)
 *   GET    /admin/categories/{id} -> { id, name, slug, parentId, imageUrl, sortOrder, active }
 *   POST   /admin/categories      -> 201 · 409 { field: "slug" } · 422 vi phạm cây 2 cấp
 *   PUT    /admin/categories/{id} -> 200 · 409/422 như POST
 *   DELETE /admin/categories/{id} -> 204 · 409 { code: "HAS_CHILDREN", childCount }
 *                                        · 409 { code: "HAS_PRODUCTS", productCount }
 *   PATCH  /admin/categories/{id}        -> { active } -> 200
 *   PATCH  /admin/categories/{id}/move   -> { direction: "up"|"down" }
 *                                        -> 200 [{ id, sortOrder }] nhóm anh em đã chuẩn hoá
 *   POST   /admin/categories/images (multipart "file") -> { url }
 *
 * Lỗi ném ra có dạng Error kèm .status / .code / .field / .childCount /
 * .productCount để form gắn lỗi tại trường slug và trang mở lại dialog chặn xóa.
 *
 * Mock: kho riêng khởi tạo từ mockCategories (8 danh mục gốc) + 3 danh mục con
 * mẫu theo spec §2.5; productCount đếm trực thuộc từ mockAllProducts.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { mockAllProducts, mockCategories } from '../mocks/homeMock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 400;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function apiError(status, { code = null, field = null, message, childCount, productCount }) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.field = field;
  if (childCount !== undefined) err.childCount = childCount;
  if (productCount !== undefined) err.productCount = productCount;
  return err;
}

function normalizeRealError(e) {
  const status = e?.response?.status;
  const data = e?.response?.data || {};
  return apiError(status || 0, {
    code: data.code || (e?.code === 'ERR_NETWORK' ? 'network' : 'unknown'),
    field: data.field || null,
    message: data.message || 'Không tải được dữ liệu. Kiểm tra kết nối và thử lại.',
    childCount: data.childCount,
    productCount: data.productCount,
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
 * 3 danh mục con mẫu (spec §2.5 — mock gốc cả 8 đều là cấp 1):
 * Sofa vừa có sản phẩm vừa có con → demo được cả 2 lớp chặn xóa §5;
 * Sofa giường rỗng → xóa thành công; Bàn ăn chỉ có sản phẩm → HAS_PRODUCTS.
 */
const MOCK_CHILDREN = [
  { id: 'c9', name: 'Sofa góc L', slug: 'sofa-goc-l', parentId: 'c1', imageUrl: '/images/sofa-nordic.jpg', sortOrder: 1, active: true },
  { id: 'c10', name: 'Sofa giường', slug: 'sofa-giuong', parentId: 'c1', imageUrl: '/images/sofa-nordic.jpg', sortOrder: 2, active: true },
  { id: 'c11', name: 'Ghế ăn', slug: 'ghe-an', parentId: 'c7', imageUrl: '/images/dining-2.jpg', sortOrder: 1, active: true },
];

// Kho mock riêng cho màn admin (không ghi vào mockCategories để trang chủ
// vẫn chỉ hiện 8 danh mục gốc). createdAt mock: null (model Category chưa có
// trường này phía dữ liệu mẫu — contract thật trả về từ backend khi có).
const mockStore = [
  ...mockCategories.map((c) => ({ ...c, createdAt: null })),
  ...MOCK_CHILDREN.map((c) => ({ ...c, createdAt: null })),
];

let idSeq = 100;
const genId = () => `c${(idSeq += 1)}`;

/** Bản chụp kho mock hiện tại — màn Sản phẩm (dropdown/lọc) dùng chung khi mock. */
export function getMockCategories() {
  return mockStore.map((c) => ({ ...c }));
}

function productCountOf(id) {
  return mockAllProducts.filter((p) => p.categoryId === id).length;
}

function toListItem(c) {
  return {
    ...c,
    productCount: productCountOf(c.id),
    hasChildren: mockStore.some((x) => x.parentId === c.id),
  };
}

function toDetail(c) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId ?? null,
    imageUrl: c.imageUrl ?? null,
    sortOrder: c.sortOrder,
    active: c.active !== false,
  };
}

function findMockCategory(id) {
  const c = mockStore.find((x) => x.id === id);
  if (!c) {
    throw apiError(404, { code: 'CATEGORY_NOT_FOUND', message: 'Không tìm thấy danh mục.' });
  }
  return c;
}

/** Validate cây 2 cấp + slug unique (mirror AdminCategoryService). */
function validateMockCategory(body, excludeId) {
  if (!body.name?.trim()) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'name', message: 'Tên danh mục là bắt buộc.' });
  }
  if (body.name.trim().length > 60) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'name', message: 'Tên danh mục tối đa 60 ký tự.' });
  }
  if (!body.slug?.trim()) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'slug', message: 'Slug là bắt buộc.' });
  }
  if (!/^[a-z0-9-]+$/.test(body.slug.trim())) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'slug', message: 'Slug chỉ gồm chữ thường, số và dấu gạch ngang.' });
  }
  const slugDup = mockStore.some((c) => c.id !== excludeId && c.slug === body.slug.trim());
  if (slugDup) {
    throw apiError(409, {
      code: 'SLUG_EXISTS',
      field: 'slug',
      message: 'Slug đã được dùng bởi danh mục khác.',
    });
  }
  if (body.sortOrder != null && (!Number.isInteger(Number(body.sortOrder)) || Number(body.sortOrder) < 0)) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'sortOrder', message: 'Thứ tự hiển thị phải là số nguyên lớn hơn hoặc bằng 0.' });
  }
  const parentId = body.parentId || null;
  if (parentId) {
    const parent = mockStore.find((c) => c.id === parentId);
    if (!parent) {
      throw apiError(422, { code: 'VALIDATION_ERROR', field: 'parentId', message: 'Danh mục cha không hợp lệ.' });
    }
    if (parent.parentId) {
      throw apiError(422, {
        code: 'INVALID_PARENT',
        field: 'parentId',
        message: 'Danh mục cha phải là danh mục gốc. Cây danh mục chỉ có 2 cấp.',
      });
    }
    if (parentId === excludeId) {
      throw apiError(422, { code: 'VALIDATION_ERROR', field: 'parentId', message: 'Danh mục cha không hợp lệ.' });
    }
    // Danh mục đang có con mà bị gán cha → sinh cấp 3.
    if (excludeId && mockStore.some((c) => c.parentId === excludeId)) {
      throw apiError(422, {
        code: 'HAS_CHILDREN',
        field: 'parentId',
        message: 'Danh mục đang có danh mục con nên không thể chuyển thành danh mục con.',
      });
    }
  }
}

/** Nhóm anh em (cùng parentId) đã sort theo sortOrder, hoà thì theo tên A–Z (§3). */
function siblingsOf(parentId) {
  return mockStore
    .filter((c) => (c.parentId ?? null) === (parentId ?? null))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'));
}

/** Chuẩn hoá sortOrder của 1 nhóm thành dãy liên tục 1..n (§4). */
function normalizeGroup(parentId) {
  const sibs = siblingsOf(parentId);
  sibs.forEach((c, i) => {
    c.sortOrder = i + 1;
  });
  return sibs.map((c) => ({ id: c.id, sortOrder: c.sortOrder }));
}

/* ------------------------------ Public API ------------------------------ */

/** Toàn bộ danh mục phẳng (FE dựng cây) — kèm productCount + hasChildren. */
export async function listCategories() {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get('/admin/categories')).data);
  }
  await delay(MOCK_DELAY);
  return mockStore
    .map(toListItem)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'));
}

/** Chi tiết nạp vào form sửa. */
export async function getCategory(id) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get(`/admin/categories/${id}`)).data);
  }
  await delay(MOCK_DELAY);
  return toDetail(findMockCategory(id));
}

/** Tạo danh mục → 201 chi tiết. */
export async function createCategory(body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.post('/admin/categories', body)).data);
  }
  await delay(MOCK_DELAY);
  validateMockCategory(body, null);
  const cat = {
    id: genId(),
    name: body.name.trim(),
    slug: body.slug.trim(),
    parentId: body.parentId || null,
    imageUrl: body.imageUrl || null,
    sortOrder: body.sortOrder != null ? Number(body.sortOrder) : 0,
    active: body.active !== false,
    createdAt: new Date().toISOString(),
  };
  mockStore.push(cat);
  return toDetail(cat);
}

/** Cập nhật danh mục → chi tiết. */
export async function updateCategory(id, body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.put(`/admin/categories/${id}`, body)).data);
  }
  await delay(MOCK_DELAY);
  const cat = findMockCategory(id);
  validateMockCategory(body, id);
  cat.name = body.name.trim();
  cat.slug = body.slug.trim();
  cat.parentId = body.parentId || null;
  cat.imageUrl = body.imageUrl || null;
  cat.sortOrder = body.sortOrder != null ? Number(body.sortOrder) : cat.sortOrder;
  cat.active = body.active !== false;
  return toDetail(cat);
}

/**
 * Xóa cứng — thứ tự kiểm: còn danh mục con (409 HAS_CHILDREN) trước,
 * còn sản phẩm (409 HAS_PRODUCTS) sau (F-015 + spec §5).
 */
export async function deleteCategory(id) {
  if (!USE_MOCK) {
    return callApi(async () => {
      await axiosClient.delete(`/admin/categories/${id}`);
      return null;
    });
  }
  await delay(MOCK_DELAY);
  const cat = findMockCategory(id);
  const childCount = mockStore.filter((c) => c.parentId === id).length;
  if (childCount > 0) {
    throw apiError(409, {
      code: 'HAS_CHILDREN',
      childCount,
      message: 'Danh mục đang có danh mục con nên chưa thể xóa.',
    });
  }
  const productCount = productCountOf(id);
  if (productCount > 0) {
    throw apiError(409, {
      code: 'HAS_PRODUCTS',
      productCount,
      message: 'Danh mục đang có sản phẩm nên không thể xóa.',
    });
  }
  mockStore.splice(mockStore.indexOf(cat), 1);
  return null;
}

/** PATCH nhanh: { active } (hiển thị / ẩn phía khách hàng). */
export async function patchCategory(id, patch) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.patch(`/admin/categories/${id}`, patch)).data);
  }
  await delay(250);
  const cat = findMockCategory(id);
  if (patch.active !== undefined) cat.active = Boolean(patch.active);
  return toListItem(cat);
}

/**
 * Đổi thứ tự trong cùng nhóm anh em → trả nhóm đã chuẩn hoá sortOrder 1..n.
 * Ở biên nhóm: không lỗi, trả nguyên nhóm (nút tương ứng đã disabled ở FE).
 */
export async function moveCategory(id, direction) {
  if (!USE_MOCK) {
    return callApi(async () =>
      (await axiosClient.patch(`/admin/categories/${id}/move`, { direction })).data
    );
  }
  await delay(250);
  const cat = findMockCategory(id);
  const sibs = siblingsOf(cat.parentId ?? null);
  const idx = sibs.findIndex((c) => c.id === id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx >= 0 && swapIdx >= 0 && swapIdx < sibs.length) {
    const tmp = sibs[idx].sortOrder;
    sibs[idx].sortOrder = sibs[swapIdx].sortOrder;
    sibs[swapIdx].sortOrder = tmp;
  }
  return normalizeGroup(cat.parentId ?? null);
}

/**
 * Upload ảnh danh mục — gọi ngay khi admin chọn file (pattern màn 15).
 * Mock: trả object URL của chính file để xem trước.
 */
export async function uploadCategoryImage(file) {
  if (!USE_MOCK) {
    return callApi(async () => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axiosClient.post('/admin/categories/images', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data; // { url }
    });
  }
  await delay(600);
  return { url: URL.createObjectURL(file) };
}
