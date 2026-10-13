/**
 * API Khuyến mãi (admin) — màn 22: Flash sale (FR-028 · F-022 · US-019) +
 * Phí vận chuyển (FR-029 · F-023 · US-021) — admin-flash-sale-shipping.md §8.
 *
 * Contract (khớp AdminFlashSaleController + AdminShippingController backend):
 *   GET    /admin/flash-sales?q=&status=&page=0&size=20&sort=startAt,desc
 *     -> { items: [{ id, code, name, startAt, endAt, totalUsageLimit, usedCount,
 *          active, status, itemCount, items: [{ productId, productName, image,
 *          variantId, color, flashPrice, discountPercent, maxDiscount,
 *          itemQuota, itemSoldCount, originalPrice }] }], total, page, size }
 *        (status: RUNNING | UPCOMING | ENDED | INACTIVE — server suy ra §2.3;
 *         totalUsageLimit 0 = không giới hạn; itemQuota null = không giới hạn
 *         theo món; code server tự sinh FS-XXXXXX, khách không thấy)
 *   GET    /admin/flash-sales/{id} -> 1 chương trình đầy đủ như trên
 *   POST   /admin/flash-sales      -> 201 · 422 { message, field? } validate §3
 *                                     (kèm trùng lịch §3.2 + khóa §3.5)
 *   PUT    /admin/flash-sales/{id} -> 200 · 422 như POST
 *   PATCH  /admin/flash-sales/{id}/active { active } -> 200
 *   DELETE /admin/flash-sales/{id} -> 204 · 409 khi đã chạy / đã có lượt bán (§4.2)
 *   GET    /admin/shipping-rules   -> { rules: [{ id, minAreaM2, maxAreaM2, fee,
 *          active }] (sort minAreaM2 asc), config: { freeThreshold, maxAreaM2 } }
 *   POST   /admin/shipping-rules   -> 201 · 422 chồng lấp / max <= min (§5.2.1)
 *   PUT    /admin/shipping-rules/{id} -> 200 · 422 như POST (bật/tắt qua active)
 *   DELETE /admin/shipping-rules/{id} -> 204
 *   GET    /admin/shipping-config  -> { freeThreshold }
 *   PUT    /admin/shipping-config { freeThreshold } -> 200 { freeThreshold }
 *   POST   /admin/shipping-rules/preview { areaM2, subtotal }
 *     -> { tier: { min, max } | null, originalFee, fee, freeShipping, overLimit }
 *        (backend dùng lại logic ShippingService: tra bậc + ngưỡng CẤU HÌNH
 *         đã lưu + trần 10 m² — divergence §10.3: ngưỡng không còn hardcode)
 *
 * Lỗi ném ra có dạng Error kèm .status / .code / .field để form gắn lỗi đúng
 * trường và trang xử lý riêng khi xóa/tắt.
 *
 * Mock: chương trình 1 khớp TỪNG SỐ với màn 13 (flash-sale.md §9): 5 món,
 * 73/100 suất (14+29+6+4+20). Bậc phí mẫu đúng 02-ERD §4: 0–1/1–3/3–6/6–10 m²
 * = 100k/200k/350k/550k; ngưỡng miễn phí mặc định 10.000.000đ, sửa được trong
 * phiên (mock giữ trong biến — preview + quote mock dùng cùng giá trị này
 * qua getMockFreeThreshold()).
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { mockAllProducts } from '../mocks/homeMock';
import { formatAreaM2 } from './shippingApi';
import { formatDateTime, formatVND } from '../utils/format';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 400;

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

/* --------------------- Trạng thái suy ra (§2.3) --------------------- */

export const FLASH_SALE_STATUS = {
  RUNNING: { key: 'RUNNING', label: 'Đang chạy' },
  UPCOMING: { key: 'UPCOMING', label: 'Sắp chạy' },
  ENDED: { key: 'ENDED', label: 'Đã kết thúc' },
  INACTIVE: { key: 'INACTIVE', label: 'Đã tắt' },
};

/**
 * Suy ra trạng thái hiển thị tại thời điểm `now` — thứ tự ưu tiên §2.3, khớp
 * AdminFlashSaleService.statusOf (active=false trên cùng, còn lại theo
 * FlashSaleService.statusOf: hết giờ HOẶC hết suất -> ENDED).
 */
export function flashSaleStatus(p, now = new Date()) {
  if (!p || p.active === false) return FLASH_SALE_STATUS.INACTIVE;
  const start = p.startAt ? new Date(p.startAt) : null;
  const end = p.endAt ? new Date(p.endAt) : null;
  if (start && now < start) return FLASH_SALE_STATUS.UPCOMING;
  if (end && now >= end) return FLASH_SALE_STATUS.ENDED;
  const limit = p.totalUsageLimit || 0;
  if (limit > 0 && (p.usedCount || 0) >= limit) return FLASH_SALE_STATUS.ENDED;
  return FLASH_SALE_STATUS.RUNNING;
}

/* --------------------- Nhãn khoảng bậc phí (§5.2) --------------------- */

/** Chuỗi thân thiện của 1 bậc: đầu `0 – 1 m²` · sau `Trên 1 – 3 m²` · mở `Trên 6 m²`. */
export function shippingTierLabel(min, max) {
  if (max == null) return `Trên ${formatAreaM2(min)} m²`;
  if (Number(min) === 0) return `0 – ${formatAreaM2(max)} m²`;
  return `Trên ${formatAreaM2(min)} – ${formatAreaM2(max)} m²`;
}

/* ======================================================================
   FLASH SALE — mock store
   ====================================================================== */

function relDate(daysOffset, hh, mm) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

/** Item cấu hình thô — enrich thành shape §8 bằng dữ liệu mockAllProducts. */
function enrichItem(cfg) {
  const product = mockAllProducts.find((p) => p.id === cfg.productId);
  if (!product) return { ...cfg, productName: cfg.productId, image: null, color: null, originalPrice: null };
  const variants = product.variants || [];
  const scoped = cfg.variantId ? variants.find((v) => v.id === cfg.variantId) : null;
  // Variant mặc định F-004: màu còn hàng rẻ nhất, không còn hàng thì rẻ nhất.
  const pool = variants.filter((v) => v.stock > 0);
  const def = (pool.length ? pool : variants).reduce(
    (best, v) => (best == null || v.price < best.price ? v : best),
    null
  );
  return {
    productId: cfg.productId,
    productName: product.name,
    image: product.images?.[0]?.url || null,
    variantId: cfg.variantId ?? null,
    color: scoped ? scoped.color : null,
    flashPrice: cfg.flashPrice ?? null,
    discountPercent: cfg.discountPercent ?? null,
    maxDiscount: cfg.maxDiscount ?? null,
    itemQuota: cfg.itemQuota ?? null,
    itemSoldCount: cfg.itemSoldCount || 0,
    originalPrice: scoped ? scoped.price : def?.price ?? null,
  };
}

function makeProgram(base, itemCfgs) {
  const items = itemCfgs.map(enrichItem);
  return { ...base, itemCount: items.length, items };
}

// Khung giờ tương đối để trạng thái suy ra đúng §2.4 bất kể ngày chạy demo
// (mốc "hôm nay" của spec là 12/10/2026: ct1 hôm qua 20:00 -> ngày mai 22:00…).
const flashStore = [
  makeProgram(
    {
      id: 'fs-admin-1', code: 'FS-8K2QX4', name: 'Flash sale cuối tuần',
      startAt: relDate(-1, 20, 0), endAt: relDate(1, 22, 0),
      totalUsageLimit: 100, usedCount: 73, active: true,
    },
    [
      { productId: 'p1', variantId: 'v11', discountPercent: 30, itemQuota: 20, itemSoldCount: 14 },
      { productId: 'p5', variantId: 'v53', flashPrice: 990000, itemQuota: 30, itemSoldCount: 29 },
      { productId: 'p3', variantId: 'v31', discountPercent: 20, itemQuota: 15, itemSoldCount: 6 },
      { productId: 'p9', variantId: 'v91', flashPrice: 749000, itemQuota: 15, itemSoldCount: 4 },
      { productId: 'p11', variantId: 'v111', discountPercent: 25, itemQuota: 20, itemSoldCount: 20 },
    ]
  ),
  makeProgram(
    {
      id: 'fs-admin-2', code: 'FS-3MD7PA', name: 'Flash sale 20/10',
      startAt: relDate(8, 20, 0), endAt: relDate(9, 22, 0),
      totalUsageLimit: 50, usedCount: 0, active: true,
    },
    [
      { productId: 'p2', variantId: null, discountPercent: 15, itemQuota: 20, itemSoldCount: 0 },
      { productId: 'p6', variantId: 'v61', flashPrice: 3590000, itemQuota: 15, itemSoldCount: 0 },
      { productId: 'p7', variantId: null, discountPercent: 10, itemQuota: 15, itemSoldCount: 0 },
    ]
  ),
  makeProgram(
    {
      id: 'fs-admin-3', code: 'FS-9QW2ZE', name: 'Khai trương tháng 10',
      startAt: relDate(-11, 9, 0), endAt: relDate(-7, 23, 59),
      totalUsageLimit: 100, usedCount: 64, active: true,
    },
    [
      { productId: 'p4', variantId: null, discountPercent: 10, itemQuota: 25, itemSoldCount: 20 },
      { productId: 'p8', variantId: 'v81', flashPrice: 8990000, itemQuota: 20, itemSoldCount: 18 },
      { productId: 'p10', variantId: null, discountPercent: 20, itemQuota: 30, itemSoldCount: 14 },
      { productId: 'p14', variantId: null, discountPercent: 12, itemQuota: 25, itemSoldCount: 12 },
    ]
  ),
  makeProgram(
    {
      id: 'fs-admin-4', code: 'FS-5TBN8C', name: 'Flash sale thử nghiệm',
      startAt: relDate(3, 20, 0), endAt: relDate(3, 22, 0),
      totalUsageLimit: 20, usedCount: 0, active: false,
    },
    [
      { productId: 'p16', variantId: null, discountPercent: 18, itemQuota: 10, itemSoldCount: 0 },
      { productId: 'p15', variantId: null, discountPercent: 22, itemQuota: 10, itemSoldCount: 0 },
    ]
  ),
];

let fsIdSeq = 100;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genMockCode() {
  let code = '';
  do {
    code = 'FS-' + Array.from({ length: 6 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (flashStore.some((p) => p.code === code));
  return code;
}

function cloneProgram(p) {
  return {
    ...p,
    items: (p.items || []).map((i) => ({ ...i })),
    itemCount: (p.items || []).length,
    status: flashSaleStatus(p).key,
  };
}

function findMockProgram(id) {
  const p = flashStore.find((x) => x.id === id);
  if (!p) {
    throw apiError(404, { code: 'FLASH_SALE_NOT_FOUND', message: 'Không tìm thấy chương trình flash sale.' });
  }
  return p;
}

/** Trùng lịch §3.2 — chỉ giữa các chương trình đang active. */
function checkMockOverlap(body, excludeId) {
  if (body.active === false) return;
  const start = new Date(body.startAt);
  const end = new Date(body.endAt);
  for (const other of flashStore) {
    if (other.id === excludeId || !other.active) continue;
    if (start < new Date(other.endAt) && new Date(other.startAt) < end) {
      throw apiError(422, {
        code: 'VALIDATION_ERROR', field: 'startAt',
        message: `Khung giờ trùng với chương trình "${other.name}" (${formatDateTime(other.startAt)} – ${formatDateTime(other.endAt)}). Hãy đổi khung giờ hoặc tắt chương trình đó trước.`,
      });
    }
  }
}

function refPriceFor(productId, variantId) {
  const product = mockAllProducts.find((p) => p.id === productId);
  if (!product) return null;
  const variants = product.variants || [];
  if (variantId) return variants.find((v) => v.id === variantId)?.price ?? null;
  if (!variants.length) return null;
  return Math.min(...variants.map((v) => v.price));
}

/** Validate mock — mirror AdminFlashSaleService (§3 + ma trận khóa §3.5). */
function validateMockProgram(body, current) {
  const name = String(body?.name || '').trim();
  if (name.length < 3 || name.length > 80) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'name', message: 'Tên chương trình phải từ 3 đến 80 ký tự.' });
  }
  if (!body?.startAt) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'startAt', message: 'Thời gian bắt đầu là bắt buộc.' });
  }
  if (!body?.endAt) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'endAt', message: 'Thời gian kết thúc là bắt buộc.' });
  }
  if (new Date(body.endAt) <= new Date(body.startAt)) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'endAt', message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' });
  }
  const limit = body.totalUsageLimit == null ? 0 : Number(body.totalUsageLimit);
  if (limit < 0) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'totalUsageLimit', message: 'Tổng suất không được âm.' });
  }
  const usedCount = current?.usedCount || 0;
  if (limit > 0 && limit < usedCount) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR', field: 'totalUsageLimit',
      message: `Tổng suất phải từ ${usedCount} trở lên (đã bán ${usedCount}).`,
    });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Chương trình cần ít nhất 1 sản phẩm.' });
  }
  const keys = new Set();
  for (const ir of body.items) {
    const product = mockAllProducts.find((p) => p.id === ir.productId);
    if (!product) {
      throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Không tìm thấy sản phẩm tham gia.' });
    }
    if (product.active === false) {
      throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: `Sản phẩm "${product.name}" đang ngừng bán.` });
    }
    const key = `${ir.productId}|${ir.variantId ?? '*'}`;
    let dup;
    if (ir.variantId == null) {
      dup = [...keys].some((k) => k.startsWith(`${ir.productId}|`));
    } else {
      dup = keys.has(key) || keys.has(`${ir.productId}|*`);
    }
    keys.add(key);
    if (dup) {
      throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Sản phẩm/màu này đã có trong chương trình.' });
    }
    const hasFixed = ir.flashPrice != null;
    const hasPercent = ir.discountPercent != null;
    if (hasFixed === hasPercent) {
      throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Mỗi sản phẩm chỉ chọn 1 kiểu giảm: giá flash cố định hoặc giảm %.' });
    }
    const ref = refPriceFor(ir.productId, ir.variantId ?? null);
    if (hasFixed) {
      if (Number(ir.flashPrice) <= 0) {
        throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Giá flash phải lớn hơn 0đ.' });
      }
      if (ref != null && Number(ir.flashPrice) >= ref) {
        throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: `Giá flash phải nhỏ hơn giá bán (${formatVND(ref)}).` });
      }
    } else {
      const pct = Number(ir.discountPercent);
      if (!Number.isInteger(pct) || pct < 1 || pct > 99) {
        throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: '% giảm phải từ 1 đến 99.' });
      }
      if (ir.maxDiscount != null && Number(ir.maxDiscount) <= 0) {
        throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Mức giảm tối đa phải lớn hơn 0đ.' });
      }
    }
    if (ir.itemQuota != null && Number(ir.itemQuota) < 1) {
      throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Suất riêng của món phải từ 1 trở lên.' });
    }
  }
  // Ma trận khóa §3.5 ở tầng mock-server.
  if (current) {
    const st = flashSaleStatus(current).key;
    if (st === 'ENDED') {
      throw apiError(422, { code: 'VALIDATION_ERROR', message: 'Chương trình đã kết thúc — chỉ xem, không sửa được.' });
    }
    if (st === 'RUNNING' || (st === 'INACTIVE' && current.usedCount > 0)) {
      if (new Date(body.startAt).getTime() !== new Date(current.startAt).getTime()) {
        throw apiError(422, { code: 'VALIDATION_ERROR', field: 'startAt', message: 'Chương trình đang chạy nên không đổi được thời gian bắt đầu.' });
      }
      if (limit !== 0 && current.totalUsageLimit !== 0 && limit < current.totalUsageLimit) {
        throw apiError(422, { code: 'VALIDATION_ERROR', field: 'totalUsageLimit', message: 'Chương trình đang chạy nên chỉ tăng được tổng suất, không giảm.' });
      }
      if (body.items.length !== current.items.length) {
        throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Chương trình đang chạy nên không thêm/xóa được sản phẩm.' });
      }
      for (const ir of body.items) {
        const cur = current.items.find(
          (i) => i.productId === ir.productId && (i.variantId ?? null) === (ir.variantId ?? null)
        );
        if (!cur) {
          throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Chương trình đang chạy nên không đổi được danh sách sản phẩm/màu.' });
        }
        if ((cur.flashPrice ?? null) !== (ir.flashPrice ?? null)
          || (cur.discountPercent ?? null) !== (ir.discountPercent ?? null)
          || (cur.maxDiscount ?? null) !== (ir.maxDiscount ?? null)) {
          throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Chương trình đang chạy nên giá flash của sản phẩm đã khóa.' });
        }
        if (ir.itemQuota != null && cur.itemQuota != null && Number(ir.itemQuota) < cur.itemQuota) {
          throw apiError(422, { code: 'VALIDATION_ERROR', field: 'items', message: 'Chương trình đang chạy nên chỉ tăng được suất riêng của món.' });
        }
      }
    }
  }
  return name;
}

function applyMockProgram(p, body, name) {
  const soldByKey = new Map(
    (p.items || []).map((i) => [`${i.productId}|${i.variantId ?? '*'}`, i.itemSoldCount || 0])
  );
  p.name = name;
  p.startAt = body.startAt;
  p.endAt = body.endAt;
  p.totalUsageLimit = body.totalUsageLimit == null ? 0 : Number(body.totalUsageLimit);
  p.active = body.active !== false;
  p.items = body.items.map((ir) =>
    enrichItem({
      productId: ir.productId,
      variantId: ir.variantId ?? null,
      flashPrice: ir.flashPrice ?? null,
      discountPercent: ir.discountPercent ?? null,
      maxDiscount: ir.maxDiscount ?? null,
      itemQuota: ir.itemQuota ?? null,
      itemSoldCount: soldByKey.get(`${ir.productId}|${ir.variantId ?? '*'}`) || 0,
    })
  );
  p.itemCount = p.items.length;
  return p;
}

const FS_SORTS = {
  'name,asc': (a, b) => a.name.localeCompare(b.name, 'vi'),
  'name,desc': (a, b) => b.name.localeCompare(a.name, 'vi'),
  'startAt,asc': (a, b) => new Date(a.startAt) - new Date(b.startAt),
  'startAt,desc': (a, b) => new Date(b.startAt) - new Date(a.startAt),
  'usedCount,asc': (a, b) => a.usedCount - b.usedCount,
  'usedCount,desc': (a, b) => b.usedCount - a.usedCount,
};

/* --------------------- Flash sale — Public API --------------------- */

/** Danh sách chương trình flash sale — chỉ type=FLASH_SALE. */
export async function listFlashSales(params = {}) {
  const { q = '', status = '', page = 0, size = 20, sort = 'startAt,desc' } = params;
  if (!USE_MOCK) {
    return callApi(async () => {
      const query = { page, size, sort };
      if (q) query.q = q;
      if (status) query.status = status;
      const { data } = await axiosClient.get('/admin/flash-sales', { params: query });
      return data;
    });
  }
  await delay(MOCK_DELAY);
  const needle = q.trim().toLowerCase();
  let rows = [...flashStore];
  if (needle) rows = rows.filter((p) => p.name.toLowerCase().includes(needle));
  if (status) rows = rows.filter((p) => flashSaleStatus(p).key === status);
  rows.sort(FS_SORTS[sort] || FS_SORTS['startAt,desc']);
  const total = rows.length;
  const safePage = Math.max(0, page);
  const items = rows.slice(safePage * size, safePage * size + size).map(cloneProgram);
  return { items, total, page: safePage, size };
}

/** Chi tiết nạp vào form sửa/xem. */
export async function getFlashSale(id) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get(`/admin/flash-sales/${id}`)).data);
  }
  await delay(MOCK_DELAY);
  return cloneProgram(findMockProgram(id));
}

/** Tạo chương trình → 201 · 422 validate/trùng lịch (code server tự sinh). */
export async function createFlashSale(body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.post('/admin/flash-sales', body)).data);
  }
  await delay(MOCK_DELAY);
  const name = validateMockProgram(body, null);
  checkMockOverlap(body, null);
  const p = applyMockProgram(
    { id: `fs-admin-${(fsIdSeq += 1)}`, code: genMockCode(), usedCount: 0, items: [] },
    body,
    name
  );
  flashStore.unshift(p);
  return cloneProgram(p);
}

/** Cập nhật chương trình → 200 · 422 (kèm ma trận khóa §3.5). */
export async function updateFlashSale(id, body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.put(`/admin/flash-sales/${id}`, body)).data);
  }
  await delay(MOCK_DELAY);
  const p = findMockProgram(id);
  const name = validateMockProgram(body, p);
  checkMockOverlap(body, id);
  applyMockProgram(p, body, name);
  return cloneProgram(p);
}

/** PATCH bật/tắt nhanh: { active } (§4.1) — tắt chương trình đang chạy hiệu lực ngay. */
export async function patchFlashSale(id, patch) {
  if (!USE_MOCK) {
    return callApi(
      async () => (await axiosClient.patch(`/admin/flash-sales/${id}/active`, patch)).data
    );
  }
  await delay(250);
  const p = findMockProgram(id);
  if (patch?.active !== undefined) {
    if (patch.active) checkMockOverlap(p, id);
    p.active = Boolean(patch.active);
  }
  return cloneProgram(p);
}

/** Xóa — 409 khi đã chạy hoặc đã có lượt bán (§4.2). */
export async function deleteFlashSale(id) {
  if (!USE_MOCK) {
    return callApi(async () => {
      await axiosClient.delete(`/admin/flash-sales/${id}`);
      return null;
    });
  }
  await delay(MOCK_DELAY);
  const p = findMockProgram(id);
  const sold = p.usedCount > 0 || (p.items || []).some((i) => (i.itemSoldCount || 0) > 0);
  if (sold) {
    throw apiError(409, { code: 'FLASH_SALE_USED', message: 'Chương trình đã có lượt bán — chỉ có thể tắt, không thể xóa.' });
  }
  const now = new Date();
  if (p.startAt && now >= new Date(p.startAt)) {
    if (p.endAt && now >= new Date(p.endAt)) {
      throw apiError(409, { code: 'FLASH_SALE_ENDED', message: 'Chương trình đã kết thúc — giữ lại làm lịch sử, không thể xóa.' });
    }
    throw apiError(409, { code: 'FLASH_SALE_RUNNING', message: 'Chương trình đang chạy — hãy tắt chương trình thay vì xóa.' });
  }
  flashStore.splice(flashStore.indexOf(p), 1);
  return null;
}

/**
 * Lỗ hổng phủ của tập bậc ACTIVE trong miền [0, maxArea] (§5.2): các bậc sắp
 * theo min tăng dần phải phủ liên tục từ 0; trả về [{ from, to }] các khoảng
 * chưa có bậc phí. Bậc "trở lên" (max null) phủ tới vô hạn nên không còn
 * khoảng trống phía sau. Dùng cho dải cảnh báo ở tab Phí vận chuyển + câu
 * cảnh báo trong confirm §5.5 (FE tự suy từ danh sách đã tải — BE không trả).
 */
export function findShippingGaps(rules, maxArea = 10) {
  const active = (rules || [])
    .filter((r) => r.active)
    .slice()
    .sort((a, b) => Number(a.minAreaM2) - Number(b.minAreaM2));
  const gaps = [];
  let cursor = 0;
  for (const r of active) {
    const min = Number(r.minAreaM2);
    if (min > cursor) gaps.push({ from: cursor, to: min });
    cursor = Math.max(cursor, r.maxAreaM2 == null ? Infinity : Number(r.maxAreaM2));
    if (cursor === Infinity) return gaps;
  }
  if (cursor < maxArea) gaps.push({ from: cursor, to: maxArea });
  return gaps;
}

/* ======================================================================
   PHÍ VẬN CHUYỂN — mock store (§5.2.2 + ngưỡng §5.3)
   ====================================================================== */

export const MOCK_MAX_AREA_M2 = 10;

const shippingStore = {
  rules: [
    { id: 'sr1', minAreaM2: 0, maxAreaM2: 1, fee: 100000, active: true },
    { id: 'sr2', minAreaM2: 1, maxAreaM2: 3, fee: 200000, active: true },
    { id: 'sr3', minAreaM2: 3, maxAreaM2: 6, fee: 350000, active: true },
    { id: 'sr4', minAreaM2: 6, maxAreaM2: 10, fee: 550000, active: true },
  ],
  freeThreshold: 10000000,
};

let srIdSeq = 100;
const cloneRule = (r) => ({ ...r });
const sortedRules = () =>
  [...shippingStore.rules].sort((a, b) => a.minAreaM2 - b.minAreaM2).map(cloneRule);

/** Ngưỡng miễn phí hiện hành của mock — shippingApi (màn 7) đọc qua đây nếu cần. */
export function getMockFreeThreshold() {
  return shippingStore.freeThreshold;
}

function findMockRule(id) {
  const r = shippingStore.rules.find((x) => x.id === id);
  if (!r) {
    throw apiError(404, { code: 'SHIPPING_RULE_NOT_FOUND', message: 'Không tìm thấy bậc phí.' });
  }
  return r;
}

/** Khoảng dạng thô cho message lỗi: `3 – 6 m²` / `6 – trở lên m²` (khớp BE). */
function plainRange(min, max) {
  return `${formatAreaM2(min)} – ${max == null ? 'trở lên' : formatAreaM2(max)} m²`;
}

/** Chồng lấp theo biên findTier: chạm đúng 1 điểm biên KHÔNG tính chồng (§5.2.1). */
function rangesOverlap(aMin, aMax, bMin, bMax) {
  const lo = Math.max(aMin, bMin);
  const hi = Math.min(aMax ?? Infinity, bMax ?? Infinity);
  return lo < hi;
}

/** Validate mock — mirror AdminShippingService. */
function validateMockRule(body, excludeId) {
  if (body?.minAreaM2 == null || Number.isNaN(Number(body.minAreaM2))) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'minAreaM2', message: 'Diện tích "từ" là bắt buộc.' });
  }
  const min = Number(body.minAreaM2);
  const max = body.maxAreaM2 == null ? null : Number(body.maxAreaM2);
  if (min < 0) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'minAreaM2', message: 'Diện tích "từ" không được âm.' });
  }
  if (max != null && max <= min) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'maxAreaM2', message: 'Diện tích "đến" phải lớn hơn diện tích "từ".' });
  }
  if (body?.fee == null || Number.isNaN(Number(body.fee))) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'fee', message: 'Phí vận chuyển là bắt buộc.' });
  }
  if (Number(body.fee) < 0) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'fee', message: 'Phí vận chuyển không được âm.' });
  }
  const active = body.active !== false;
  if (active) {
    for (const other of shippingStore.rules) {
      if (other.id === excludeId || !other.active) continue;
      if (max == null && other.maxAreaM2 == null) {
        throw apiError(422, {
          code: 'VALIDATION_ERROR', field: 'maxAreaM2',
          message: `Đã có bậc "trở lên" đang áp dụng (từ ${formatAreaM2(other.minAreaM2)} m²).`,
        });
      }
      if (rangesOverlap(min, max, other.minAreaM2, other.maxAreaM2)) {
        throw apiError(422, {
          code: 'VALIDATION_ERROR',
          message: `Khoảng ${plainRange(min, max)} đang chồng với bậc ${plainRange(other.minAreaM2, other.maxAreaM2)} (phí ${formatVND(other.fee)}). Hãy chỉnh lại khoảng.`,
        });
      }
    }
  }
  return { minAreaM2: min, maxAreaM2: max, fee: Number(body.fee), active };
}

/** Tính thử mock — mirror ShippingService.preview (bậc active + ngưỡng + trần). */
function mockPreview(areaM2, subtotal) {
  const area = Number(areaM2) || 0;
  const sub = Number(subtotal) || 0;
  const overLimit = area > MOCK_MAX_AREA_M2;
  const tier = overLimit
    ? null
    : [...shippingStore.rules]
        .filter((r) => r.active)
        .sort((a, b) => a.minAreaM2 - b.minAreaM2)
        .find((r) => area >= r.minAreaM2 && (r.maxAreaM2 == null || area <= r.maxAreaM2)) || null;
  const originalFee = tier ? tier.fee : null;
  const freeShipping = !overLimit && sub >= shippingStore.freeThreshold;
  return {
    tier: tier ? { min: tier.minAreaM2, max: tier.maxAreaM2 } : null,
    originalFee,
    fee: overLimit ? null : freeShipping ? 0 : originalFee,
    freeShipping,
    overLimit,
  };
}

/* --------------------- Phí vận chuyển — Public API --------------------- */

/** GET /admin/shipping-rules -> { rules, config }. */
export async function listShippingRules() {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get('/admin/shipping-rules')).data);
  }
  await delay(MOCK_DELAY);
  return {
    rules: sortedRules(),
    config: { freeThreshold: shippingStore.freeThreshold, maxAreaM2: MOCK_MAX_AREA_M2 },
  };
}

export async function createShippingRule(body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.post('/admin/shipping-rules', body)).data);
  }
  await delay(MOCK_DELAY);
  const v = validateMockRule(body, null);
  const rule = { id: `sr${(srIdSeq += 1)}`, ...v };
  shippingStore.rules.push(rule);
  return cloneRule(rule);
}

export async function updateShippingRule(id, body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.put(`/admin/shipping-rules/${id}`, body)).data);
  }
  await delay(MOCK_DELAY);
  const rule = findMockRule(id);
  Object.assign(rule, validateMockRule(body, id));
  return cloneRule(rule);
}

export async function deleteShippingRule(id) {
  if (!USE_MOCK) {
    return callApi(async () => {
      await axiosClient.delete(`/admin/shipping-rules/${id}`);
      return null;
    });
  }
  await delay(MOCK_DELAY);
  const rule = findMockRule(id);
  shippingStore.rules.splice(shippingStore.rules.indexOf(rule), 1);
  return null;
}

export async function getShippingConfig() {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get('/admin/shipping-config')).data);
  }
  await delay(200);
  return { freeThreshold: shippingStore.freeThreshold };
}

export async function updateShippingConfig(body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.put('/admin/shipping-config', body)).data);
  }
  await delay(MOCK_DELAY);
  const value = Number(body?.freeThreshold);
  if (body?.freeThreshold == null || Number.isNaN(value)) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'freeThreshold', message: 'Ngưỡng miễn phí vận chuyển là bắt buộc.' });
  }
  if (value < 0) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'freeThreshold', message: 'Ngưỡng miễn phí vận chuyển không được âm.' });
  }
  shippingStore.freeThreshold = value;
  return { freeThreshold: value };
}

/** POST /admin/shipping-rules/preview — luôn dùng cấu hình ĐÃ LƯU (§5.4). */
export async function previewShipping(body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.post('/admin/shipping-rules/preview', body)).data);
  }
  await delay(300);
  const area = Number(body?.areaM2);
  if (body?.areaM2 == null || Number.isNaN(area) || area <= 0) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'areaM2', message: 'Tổng diện tích đơn phải lớn hơn 0.' });
  }
  if (body?.subtotal != null && Number(body.subtotal) < 0) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'subtotal', message: 'Tạm tính đơn không được âm.' });
  }
  return mockPreview(area, body?.subtotal);
}
