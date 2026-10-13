/**
 * API Quản lý voucher (admin) — FR-024 · F-018 · US-017 (admin-voucher.md §6).
 *
 * Contract (khớp AdminVoucherController backend):
 *   GET    /admin/vouchers?q=&status=&discountType=&page=0&size=20&sort=endAt,asc
 *     -> { items: [{ id, code, type, value, maxDiscount, minOrderValue,
 *          applicableCategories, applicableProductIds, perUserLimit,
 *          startAt, endAt, totalUsageLimit, usedCount, active }],
 *          total, page, size }
 *        (status: RUNNING | UPCOMING | EXPIRED | EXHAUSTED | INACTIVE — server
 *         suy ra theo §2.3; kết quả CHỈ gồm type PERCENT | FIXED, không bao
 *         giờ có FLASH_SALE; totalUsageLimit 0 / perUserLimit null|0 = không
 *         giới hạn — §9.1, §9.2)
 *   GET    /admin/vouchers/{id} -> 1 voucher đầy đủ như trên
 *   POST   /admin/vouchers      -> 201 · 409 { field: "code" } trùng mã
 *                                  (unique TOÀN CỤC gồm cả flash sale)
 *                                  · 422 { field } vi phạm validate §3
 *   PUT    /admin/vouchers/{id} -> 200 · 409/422 như POST (+ 422 khi đổi mã
 *                                  lúc usedCount > 0, giới hạn < đã dùng)
 *   PATCH  /admin/vouchers/{id}/active { active } -> 200 voucher đã cập nhật
 *   DELETE /admin/vouchers/{id} -> 204 · 409 khi usedCount > 0 hoặc đã có
 *                                  đơn tham chiếu mã
 *
 * Lỗi ném ra có dạng Error kèm .status / .code / .field để form gắn lỗi đúng
 * trường (code khi 409) và trang xử lý riêng khi xóa.
 *
 * Mock: kho riêng 8 voucher đúng §2.4 + 1 chương trình FLASH_SALE (chứng
 * minh list luôn lọc bỏ + trùng mã vẫn 409). Trạng thái mock SUY RA bằng
 * đúng hàm voucherStatus() dưới đây — cùng thứ tự ưu tiên §2.3 với backend.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';

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

export const VOUCHER_STATUS = {
  RUNNING: { key: 'RUNNING', label: 'Đang chạy' },
  UPCOMING: { key: 'UPCOMING', label: 'Sắp chạy' },
  EXPIRED: { key: 'EXPIRED', label: 'Hết hạn' },
  EXHAUSTED: { key: 'EXHAUSTED', label: 'Hết lượt' },
  INACTIVE: { key: 'INACTIVE', label: 'Đã tắt' },
};

/**
 * Suy ra trạng thái hiển thị tại thời điểm `now` — thứ tự ưu tiên §2.3:
 * Đã tắt → Hết hạn → Sắp chạy → Hết lượt → Đang chạy.
 * totalUsageLimit trống/0 = không giới hạn nên không bao giờ "Hết lượt" (§9.2).
 */
export function voucherStatus(v, now = new Date()) {
  if (!v || v.active === false) return VOUCHER_STATUS.INACTIVE;
  const start = v.startAt ? new Date(v.startAt) : null;
  const end = v.endAt ? new Date(v.endAt) : null;
  if (end && now > end) return VOUCHER_STATUS.EXPIRED;
  if (start && now < start) return VOUCHER_STATUS.UPCOMING;
  const limit = v.totalUsageLimit || 0;
  if (limit > 0 && (v.usedCount || 0) >= limit) return VOUCHER_STATUS.EXHAUSTED;
  return VOUCHER_STATUS.RUNNING;
}

/* --------------------------- Mock internals --------------------------- */

// Giờ VN (+07:00) để "hôm nay" của demo (12/10/2026) cho trạng thái đúng §2.4.
const at = (s) => `${s}+07:00`;

const mockStore = [
  {
    id: 'v1', code: 'KHAITRUONG', type: 'PERCENT', value: 10, maxDiscount: 200000,
    minOrderValue: 1000000, applicableCategories: [], applicableProductIds: [],
    perUserLimit: 1, startAt: at('2026-10-01T00:00:00'), endAt: at('2026-10-31T23:59:00'),
    totalUsageLimit: 500, usedCount: 128, active: true,
  },
  {
    id: 'v2', code: 'NOITHAT50', type: 'PERCENT', value: 50, maxDiscount: 200000,
    minOrderValue: 1000000, applicableCategories: [], applicableProductIds: [],
    perUserLimit: null, startAt: at('2026-10-01T00:00:00'), endAt: at('2026-12-31T23:59:00'),
    totalUsageLimit: 1000, usedCount: 342, active: true,
  },
  {
    id: 'v3', code: 'NOITHAT10', type: 'FIXED', value: 500000, maxDiscount: null,
    minOrderValue: 10000000, applicableCategories: [], applicableProductIds: [],
    perUserLimit: null, startAt: at('2026-10-01T00:00:00'), endAt: at('2026-12-31T23:59:00'),
    totalUsageLimit: 200, usedCount: 200, active: true,
  },
  {
    id: 'v4', code: 'NOITHAT20', type: 'PERCENT', value: 20, maxDiscount: 100000,
    minOrderValue: 20000000, applicableCategories: ['c1'], applicableProductIds: [],
    perUserLimit: null, startAt: at('2026-10-01T00:00:00'), endAt: at('2026-12-31T23:59:00'),
    totalUsageLimit: 300, usedCount: 45, active: true,
  },
  {
    id: 'v5', code: 'NOEL2026', type: 'FIXED', value: 300000, maxDiscount: null,
    minOrderValue: 5000000, applicableCategories: [], applicableProductIds: [],
    perUserLimit: null, startAt: at('2026-12-20T00:00:00'), endAt: at('2026-12-26T23:59:00'),
    totalUsageLimit: 150, usedCount: 0, active: true,
  },
  {
    id: 'v6', code: 'TRUNGTHU', type: 'PERCENT', value: 15, maxDiscount: 150000,
    minOrderValue: 500000, applicableCategories: [], applicableProductIds: [],
    perUserLimit: null, startAt: at('2026-09-01T00:00:00'), endAt: at('2026-09-30T23:59:00'),
    totalUsageLimit: 200, usedCount: 89, active: true,
  },
  {
    id: 'v7', code: 'SINHNHAT', type: 'FIXED', value: 100000, maxDiscount: null,
    minOrderValue: 0, applicableCategories: [], applicableProductIds: [],
    perUserLimit: null, startAt: at('2026-10-01T00:00:00'), endAt: at('2026-10-31T23:59:00'),
    totalUsageLimit: 100, usedCount: 12, active: false,
  },
  {
    id: 'v8', code: 'WELCOME', type: 'PERCENT', value: 5, maxDiscount: 50000,
    minOrderValue: 0, applicableCategories: [], applicableProductIds: [],
    perUserLimit: null, startAt: at('2026-10-01T00:00:00'), endAt: at('2026-12-31T23:59:00'),
    totalUsageLimit: 50, usedCount: 0, active: true,
  },
  {
    // Chương trình flash sale DÙNG CHUNG kho (màn 22): list phải lọc bỏ,
    // nhưng tạo voucher trùng mã FLASH1012 vẫn bị 409 (unique toàn cục §0.1).
    id: 'fs1', code: 'FLASH1012', type: 'FLASH_SALE', value: 25, maxDiscount: 500000,
    minOrderValue: 0, applicableCategories: [], applicableProductIds: ['p1'],
    perUserLimit: null, startAt: at('2026-10-12T09:00:00'), endAt: at('2026-10-12T21:00:00'),
    totalUsageLimit: 100, usedCount: 37, active: true,
  },
];

let idSeq = 100;
const genId = () => `v${(idSeq += 1)}`;

function clone(v) {
  return {
    ...v,
    applicableCategories: [...(v.applicableCategories || [])],
    applicableProductIds: [...(v.applicableProductIds || [])],
  };
}

function findMockVoucher(id) {
  const v = mockStore.find((x) => x.id === id);
  if (!v || v.type === 'FLASH_SALE') {
    throw apiError(404, { code: 'VOUCHER_NOT_FOUND', message: 'Không tìm thấy voucher.' });
  }
  return v;
}

/** Validate mock — mirror AdminVoucherService (F-018 + §3). */
function validateMockVoucher(body, excludeId, currentUsedCount = 0) {
  const code = String(body?.code || '').trim().toUpperCase();
  if (!code) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'code', message: 'Mã voucher là bắt buộc.' });
  }
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR', field: 'code',
      message: 'Mã chỉ gồm chữ in hoa, số, dấu - và _.',
    });
  }
  if (excludeId) {
    const current = findMockVoucher(excludeId);
    if (current.usedCount > 0 && code !== current.code) {
      throw apiError(422, {
        code: 'VALIDATION_ERROR', field: 'code',
        message: 'Không đổi được mã khi voucher đã có lượt dùng.',
      });
    }
  }
  const dup = mockStore.some((v) => v.id !== excludeId && v.code === code);
  if (dup) {
    throw apiError(409, {
      code: 'CODE_EXISTS', field: 'code',
      message: 'Mã này đã tồn tại. Hãy chọn mã khác.',
    });
  }
  if (!['PERCENT', 'FIXED'].includes(body?.type)) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR', field: 'type',
      message: 'Loại giảm phải là Giảm % hoặc Giảm số tiền.',
    });
  }
  const value = Number(body?.value);
  if (body?.value == null || Number.isNaN(value)) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'value', message: 'Giá trị giảm là bắt buộc.' });
  }
  if (body.type === 'PERCENT' && (value < 1 || value > 100)) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR', field: 'value',
      message: 'Phần trăm giảm phải từ 1 đến 100.',
    });
  }
  if (body.type === 'FIXED' && value <= 0) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR', field: 'value',
      message: 'Số tiền giảm phải lớn hơn 0đ.',
    });
  }
  if (body.type === 'PERCENT') {
    if (body.maxDiscount == null) {
      throw apiError(422, {
        code: 'VALIDATION_ERROR', field: 'maxDiscount',
        message: 'Nhập mức giảm tối đa khi giảm theo %.',
      });
    }
    if (Number(body.maxDiscount) <= 0) {
      throw apiError(422, {
        code: 'VALIDATION_ERROR', field: 'maxDiscount',
        message: 'Mức giảm tối đa phải lớn hơn 0đ.',
      });
    }
  }
  if (Number(body?.minOrderValue || 0) < 0) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR', field: 'minOrderValue',
      message: 'Giá trị đơn tối thiểu không được âm.',
    });
  }
  if (!body?.startAt) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'startAt', message: 'Thời gian bắt đầu là bắt buộc.' });
  }
  if (!body?.endAt) {
    throw apiError(422, { code: 'VALIDATION_ERROR', field: 'endAt', message: 'Thời gian kết thúc là bắt buộc.' });
  }
  if (new Date(body.endAt) <= new Date(body.startAt)) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR', field: 'endAt',
      message: 'Thời gian kết thúc phải sau thời gian bắt đầu.',
    });
  }
  const limit = body.totalUsageLimit == null ? 0 : Number(body.totalUsageLimit);
  if (limit < 0) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR', field: 'totalUsageLimit',
      message: 'Tổng giới hạn lượt không được âm.',
    });
  }
  if (limit > 0 && limit < currentUsedCount) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR', field: 'totalUsageLimit',
      message: `Giới hạn phải từ ${currentUsedCount} lượt trở lên (đã dùng ${currentUsedCount}).`,
    });
  }
  if (body.perUserLimit != null && Number(body.perUserLimit) < 0) {
    throw apiError(422, {
      code: 'VALIDATION_ERROR', field: 'perUserLimit',
      message: 'Giới hạn mỗi khách không được âm.',
    });
  }
  return code;
}

function applyMockBody(v, body, code) {
  v.code = code;
  v.type = body.type;
  v.value = Number(body.value);
  v.maxDiscount = body.type === 'PERCENT' ? Number(body.maxDiscount) : null;
  v.minOrderValue = Number(body.minOrderValue || 0);
  v.applicableCategories = [...(body.applicableCategories || [])];
  v.applicableProductIds = [...(body.applicableProductIds || [])];
  v.perUserLimit = body.perUserLimit == null ? null : Number(body.perUserLimit);
  v.startAt = body.startAt;
  v.endAt = body.endAt;
  v.totalUsageLimit = body.totalUsageLimit == null ? 0 : Number(body.totalUsageLimit);
  v.active = body.active !== false;
  return v;
}

const MOCK_SORTS = {
  'code,asc': (a, b) => a.code.localeCompare(b.code),
  'code,desc': (a, b) => b.code.localeCompare(a.code),
  'endAt,asc': (a, b) => new Date(a.endAt) - new Date(b.endAt),
  'endAt,desc': (a, b) => new Date(b.endAt) - new Date(a.endAt),
  'usedCount,asc': (a, b) => a.usedCount - b.usedCount,
  'usedCount,desc': (a, b) => b.usedCount - a.usedCount,
};

/* ------------------------------ Public API ------------------------------ */

/**
 * Danh sách voucher thường — luôn loại FLASH_SALE kể cả khi lọc.
 * params: { q, status, discountType, page (0-indexed), size, sort }.
 */
export async function listVouchers(params = {}) {
  const { q = '', status = '', discountType = '', page = 0, size = 20, sort = 'endAt,asc' } = params;
  if (!USE_MOCK) {
    return callApi(async () => {
      const query = { page, size, sort };
      if (q) query.q = q;
      if (status) query.status = status;
      if (discountType) query.discountType = discountType;
      const { data } = await axiosClient.get('/admin/vouchers', { params: query });
      return data;
    });
  }
  await delay(MOCK_DELAY);
  const needle = q.trim().toUpperCase();
  let rows = mockStore.filter((v) => v.type !== 'FLASH_SALE');
  if (needle) rows = rows.filter((v) => v.code.includes(needle));
  if (discountType) rows = rows.filter((v) => v.type === discountType);
  if (status) rows = rows.filter((v) => voucherStatus(v).key === status);
  rows = [...rows].sort(MOCK_SORTS[sort] || MOCK_SORTS['endAt,asc']);
  const total = rows.length;
  const safePage = Math.max(0, page);
  const items = rows.slice(safePage * size, safePage * size + size).map(clone);
  return { items, total, page: safePage, size };
}

/** Chi tiết nạp vào form sửa. */
export async function getVoucher(id) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get(`/admin/vouchers/${id}`)).data);
  }
  await delay(MOCK_DELAY);
  return clone(findMockVoucher(id));
}

/** Tạo voucher → 201 chi tiết · 409 trùng mã · 422 vi phạm validate. */
export async function createVoucher(body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.post('/admin/vouchers', body)).data);
  }
  await delay(MOCK_DELAY);
  const code = validateMockVoucher(body, null, 0);
  const v = applyMockBody({ id: genId(), usedCount: 0 }, body, code);
  mockStore.push(v);
  return clone(v);
}

/** Cập nhật voucher → chi tiết · 409/422 như tạo. */
export async function updateVoucher(id, body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.put(`/admin/vouchers/${id}`, body)).data);
  }
  await delay(MOCK_DELAY);
  const v = findMockVoucher(id);
  const code = validateMockVoucher(body, id, v.usedCount);
  applyMockBody(v, body, code);
  return clone(v);
}

/** PATCH bật/tắt nhanh: { active } → voucher đã cập nhật (§4.1). */
export async function patchVoucher(id, patch) {
  if (!USE_MOCK) {
    return callApi(
      async () => (await axiosClient.patch(`/admin/vouchers/${id}/active`, patch)).data
    );
  }
  await delay(250);
  const v = findMockVoucher(id);
  if (patch?.active !== undefined) v.active = Boolean(patch.active);
  return clone(v);
}

/** Xóa — 409 khi đã có lượt dùng / đơn tham chiếu (§4.2). */
export async function deleteVoucher(id) {
  if (!USE_MOCK) {
    return callApi(async () => {
      await axiosClient.delete(`/admin/vouchers/${id}`);
      return null;
    });
  }
  await delay(MOCK_DELAY);
  const v = findMockVoucher(id);
  if (v.usedCount > 0) {
    throw apiError(409, {
      code: 'VOUCHER_USED',
      message: 'Voucher đã có lượt dùng — chỉ có thể vô hiệu hóa, không thể xóa.',
    });
  }
  mockStore.splice(mockStore.indexOf(v), 1);
  return null;
}
