/**
 * API Quản lý tồn kho (admin) — FR-023 · F-017 · US-015 (admin-ton-kho.md §9).
 *
 * Contract (khớp AdminInventoryController backend):
 *   GET   /admin/inventory?status=all|low|out&q=&categoryId=&sort=&page=&size=
 *     -> { content: [{ variantId, productId, productName, productActive,
 *          categoryId, categoryName, image, color, colorHex, sku, price,
 *          stock, lowStockThreshold }],
 *          totalElements, totalPages, page, size,
 *          counts: { all, low, out } }
 *        (status=low = stock <= lowStockThreshold, GỒM cả hết hàng;
 *         counts tính theo tìm kiếm + danh mục, bỏ qua chính status)
 *   POST  /admin/inventory/{variantId}/adjust
 *         { mode: "RECEIVE"|"REMOVE"|"SET", qty?, newStock?, expectedStock,
 *           reason: "RESTOCK"|"STOCKTAKE"|"DAMAGED"|"RETURN"|"DISPOSAL"|"OTHER",
 *           note? }
 *     -> 200 { variantId, stock, lowStockThreshold }
 *        409 { code: "STOCK_CHANGED", currentStock } · 422 vi phạm validate
 *   PATCH /admin/inventory/{variantId}/threshold { lowStockThreshold }
 *     -> 200 { variantId, lowStockThreshold, stock } · 422 khi ngưỡng < 0
 *
 * Lỗi ném ra có dạng Error kèm .status / .code / .field / .currentStock
 * để modal gắn lỗi đúng trường và xử lý riêng 409 STOCK_CHANGED.
 *
 * Mock: derive trực tiếp từ variants của mockAllProducts (homeMock.js) —
 * điều chỉnh tồn/sửa ngưỡng mutate chính variant đó nên màn Sản phẩm và
 * các màn khách hàng đọc cùng mảng sẽ thấy số mới ngay trong phiên.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { mockAllProducts, mockCategories } from '../mocks/homeMock';
import { getMockCategories } from './adminCategoryApi';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 400;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const ADJUST_MODES = ['RECEIVE', 'REMOVE', 'SET'];
export const ADJUST_REASONS = [
  'RESTOCK',
  'STOCKTAKE',
  'DAMAGED',
  'RETURN',
  'DISPOSAL',
  'OTHER',
];

function apiError(status, { code = null, field = null, message, currentStock }) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.field = field;
  if (currentStock !== undefined) err.currentStock = currentStock;
  return err;
}

function normalizeRealError(e) {
  const status = e?.response?.status;
  const data = e?.response?.data || {};
  return apiError(status || 0, {
    code: data.code || (e?.code === 'ERR_NETWORK' ? 'network' : 'unknown'),
    field: data.field || null,
    message: data.message || 'Không tải được dữ liệu. Kiểm tra kết nối và thử lại.',
    currentStock: data.currentStock,
  });
}

async function callApi(fn) {
  try {
    return await fn();
  } catch (e) {
    throw normalizeRealError(e);
  }
}

/**
 * Trạng thái tồn của 1 variant (§2.1): 'out' | 'low' | 'ok'.
 * Nhóm "sắp hết" dùng cho counts/chip là stock <= ngưỡng (gồm 'out').
 */
export function inventoryStatus(stock, lowStockThreshold) {
  if (stock === 0) return 'out';
  if (stock <= lowStockThreshold) return 'low';
  return 'ok';
}

/* --------------------------- Mock internals --------------------------- */

function mockCategoryName(id) {
  const all = [...getMockCategories(), ...mockCategories];
  return all.find((c) => c.id === id)?.name || '';
}

/** Phạm vi danh mục lọc: danh mục được chọn + các danh mục con của nó (cây 2 cấp). */
function mockCategoryScope(categoryId) {
  if (!categoryId) return null;
  const all = getMockCategories();
  const scope = new Set([categoryId]);
  all.forEach((c) => {
    if (c.parentId === categoryId) scope.add(c.id);
  });
  return scope;
}

function toRow(p, v) {
  const image =
    [...(p.images || [])].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url || null;
  return {
    variantId: v.id,
    productId: p.id,
    productName: p.name,
    productActive: p.active !== false,
    categoryId: p.categoryId,
    categoryName: mockCategoryName(p.categoryId),
    image,
    color: v.color,
    colorHex: v.colorHex,
    sku: v.sku,
    price: v.price,
    stock: v.stock,
    lowStockThreshold: v.lowStockThreshold ?? 5,
  };
}

/** Mọi variant của mọi sản phẩm (kể cả sản phẩm ngừng bán — §2.2). */
function allRows() {
  const rows = [];
  mockAllProducts.forEach((p) => {
    (p.variants || []).forEach((v) => rows.push(toRow(p, v)));
  });
  return rows;
}

function findMockVariant(variantId) {
  for (const p of mockAllProducts) {
    const v = (p.variants || []).find((x) => x.id === variantId);
    if (v) return { product: p, variant: v };
  }
  throw apiError(404, { code: 'VARIANT_NOT_FOUND', message: 'Không tìm thấy biến thể.' });
}

const SORTS = {
  stock_asc: (a, b) => a.stock - b.stock || a.productName.localeCompare(b.productName, 'vi'),
  stock_desc: (a, b) => b.stock - a.stock || a.productName.localeCompare(b.productName, 'vi'),
  price_asc: (a, b) => a.price - b.price || a.productName.localeCompare(b.productName, 'vi'),
  price_desc: (a, b) => b.price - a.price || a.productName.localeCompare(b.productName, 'vi'),
  name_asc: (a, b) =>
    a.productName.localeCompare(b.productName, 'vi') || a.color.localeCompare(b.color, 'vi'),
  name_desc: (a, b) =>
    b.productName.localeCompare(a.productName, 'vi') || a.color.localeCompare(b.color, 'vi'),
};

/* ------------------------------ Public API ------------------------------ */

/** Danh sách tồn kho theo biến thể + counts — FR-023 / F-017. */
export async function listInventory(params = {}) {
  const {
    status = 'all',
    q = '',
    categoryId = '',
    sort = 'stock_asc',
    page = 1,
    size = 10,
  } = params;
  if (!USE_MOCK) {
    return callApi(async () => {
      const query = { status, sort, page, size };
      if (q) query.q = q;
      if (categoryId) query.categoryId = categoryId;
      const { data } = await axiosClient.get('/admin/inventory', { params: query });
      return data;
    });
  }
  await delay(MOCK_DELAY);
  const needle = q.trim().toLowerCase();
  const scope = mockCategoryScope(categoryId);
  const base = allRows().filter((r) => {
    if (scope && !scope.has(r.categoryId)) return false;
    if (needle) {
      const hit =
        r.productName.toLowerCase().includes(needle) ||
        (r.color || '').toLowerCase().includes(needle) ||
        (r.sku || '').toLowerCase().includes(needle);
      if (!hit) return false;
    }
    return true;
  });
  const counts = {
    all: base.length,
    low: base.filter((r) => r.stock <= r.lowStockThreshold).length,
    out: base.filter((r) => r.stock === 0).length,
  };
  let rows = base;
  if (status === 'low') rows = base.filter((r) => r.stock <= r.lowStockThreshold);
  else if (status === 'out') rows = base.filter((r) => r.stock === 0);
  rows = [...rows].sort(SORTS[sort] || SORTS.stock_asc);
  const totalElements = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const content = rows.slice((safePage - 1) * size, safePage * size);
  return { content, totalElements, totalPages, page: safePage, size, counts };
}

/**
 * Điều chỉnh tồn 3 chế độ — mirror AdminInventoryService:
 * validate lý do/số lượng trước, chống ghi đè bằng expectedStock sau (409).
 */
export async function adjustStock(variantId, body) {
  if (!USE_MOCK) {
    return callApi(
      async () => (await axiosClient.post(`/admin/inventory/${variantId}/adjust`, body)).data
    );
  }
  await delay(MOCK_DELAY);
  const { variant } = findMockVariant(variantId);
  const mode = body?.mode;
  if (!ADJUST_MODES.includes(mode)) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR',
      field: 'mode',
      message: 'Chế độ điều chỉnh phải là RECEIVE, REMOVE hoặc SET.',
    });
  }
  if (!ADJUST_REASONS.includes(body?.reason)) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR',
      field: 'reason',
      message: 'Vui lòng chọn lý do điều chỉnh.',
    });
  }
  const note = (body?.note || '').trim();
  if (note.length > 200) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR',
      field: 'note',
      message: 'Ghi chú tối đa 200 ký tự.',
    });
  }
  if (body.reason === 'OTHER' && !note) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR',
      field: 'note',
      message: 'Vui lòng ghi rõ lý do trong ô ghi chú.',
    });
  }
  const stock = variant.stock;
  let newStock;
  if (mode === 'RECEIVE') {
    if (!Number.isInteger(body.qty) || body.qty <= 0) {
      throw apiError(422, {
        code: 'VALIDATION_ERROR',
        field: 'qty',
        message: 'Số lượng nhập phải là số nguyên lớn hơn 0.',
      });
    }
    newStock = stock + body.qty;
  } else if (mode === 'REMOVE') {
    if (!Number.isInteger(body.qty) || body.qty <= 0) {
      throw apiError(422, {
        code: 'VALIDATION_ERROR',
        field: 'qty',
        message: 'Số lượng giảm phải là số nguyên lớn hơn 0.',
      });
    }
    if (body.qty > stock) {
      throw apiError(422, {
        code: 'VALIDATION_ERROR',
        field: 'qty',
        message: `Số lượng giảm không được lớn hơn tồn hiện tại (${stock}).`,
      });
    }
    newStock = stock - body.qty;
  } else {
    if (!Number.isInteger(body.newStock) || body.newStock < 0) {
      throw apiError(422, {
        code: 'VALIDATION_ERROR',
        field: 'newStock',
        message: 'Tồn thực tế phải là số nguyên lớn hơn hoặc bằng 0.',
      });
    }
    newStock = body.newStock;
  }
  if (body.expectedStock == null) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR',
      field: 'expectedStock',
      message: 'Thiếu số tồn tại thời điểm mở điều chỉnh.',
    });
  }
  if (body.expectedStock !== stock) {
    throw apiError(409, {
      code: 'STOCK_CHANGED',
      message: 'Tồn kho vừa thay đổi do giao dịch khác.',
      currentStock: stock,
    });
  }
  variant.stock = newStock;
  return { variantId, stock: newStock, lowStockThreshold: variant.lowStockThreshold ?? 5 };
}

/** Sửa ngưỡng cảnh báo của 1 biến thể (số nguyên >= 0) — F-017. */
export async function updateThreshold(variantId, body) {
  if (!USE_MOCK) {
    return callApi(
      async () =>
        (await axiosClient.patch(`/admin/inventory/${variantId}/threshold`, body)).data
    );
  }
  await delay(250);
  const { variant } = findMockVariant(variantId);
  const value = body?.lowStockThreshold;
  if (!Number.isInteger(value) || value < 0) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR',
      field: 'lowStockThreshold',
      message: 'Ngưỡng phải là số nguyên ≥ 0.',
    });
  }
  variant.lowStockThreshold = value;
  return { variantId, lowStockThreshold: value, stock: variant.stock };
}
