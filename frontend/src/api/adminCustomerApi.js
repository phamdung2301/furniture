/**
 * API Quản lý khách hàng (admin) — FR-025 · F-019 (admin-khach-hang.md §7).
 *
 * Contract (khớp AdminCustomerController backend):
 *   GET   /admin/customers?q=&status=ACTIVE|LOCKED&phoneVerified=true|false
 *         &sort=createdAt,desc|createdAt,asc|totalSpent,desc|totalSpent,asc
 *         &page=0&size=10
 *     -> { items: [{ id, fullName, email, phone, phoneVerified, avatarUrl,
 *          status, lockSource: "ADMIN"|"AUTO"|null, lockedUntil, createdAt,
 *          orderCount, totalSpent }], total, page, size }   (page 0-indexed)
 *        (chỉ user ROLE_CUSTOMER; status/lockSource là trạng thái HIỆU LỰC
 *         do BE suy ra §4.3 — khóa tự động đã hết hạn trả về ACTIVE;
 *         orderCount = mọi trạng thái, totalSpent = chỉ đơn HOÀN THÀNH)
 *   GET   /admin/customers/{id}
 *     -> { ...CustomerRow, lockReason, failedLoginAttempts, hasPassword,
 *          addresses: [Address], stats: { orderCount, completedOrderCount,
 *          totalSpent, countByStatus: { completed, processing, cancelled,
 *          returned }, lastOrder: { orderNumber, createdAt, status, total }
 *          | null }, recentOrders: [{ orderNumber, createdAt, itemCount,
 *          total, status }] (tối đa 5) }
 *        (DTO cấm chứa passwordHash / passwordResetToken — NFR-004 §5)
 *   PATCH /admin/customers/{id}/lock    body { reason? }
 *     -> CustomerRow đã cập nhật · 409 khi đã bị khóa do admin
 *   PATCH /admin/customers/{id}/unlock  -> CustomerRow đã cập nhật
 *     · 409 khi tài khoản đang hoạt động
 *
 * Tham số của listCustomers dùng tên `verified` (true|false|''): hàm tự ánh
 * xạ sang query `phoneVerified` của contract.
 *
 * Mock: 10 khách đúng bảng §2.3 (đủ Hoạt động / Đã khóa admin / Tạm khóa tự
 * động), chi tiết Nguyễn Văn An đúng §3.6 — mutable trong phiên: khóa/mở
 * khóa cập nhật trực tiếp lên kho để bảng + chi tiết nhất quán. Số liệu
 * hàng (orderCount/totalSpent) SUY RA từ danh sách đơn của từng khách nên
 * luôn khớp chi tiết. Lưu ý: mock là ảnh chụp dữ liệu demo (như các màn
 * admin trước), trạng thái Tạm khóa của Phạm Thu Dung giữ nguyên theo
 * §2.3; bản thật do BE trả trạng thái hiệu lực.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { normalizeVi } from '../utils/search';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 400;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

function apiError(status, { code = null, message } = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeRealError(e) {
  const status = e?.response?.status;
  const data = e?.response?.data || {};
  return apiError(status || 0, {
    code: data.code || (e?.code === 'ERR_NETWORK' ? 'network' : 'unknown'),
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

/* ------------------------------ Mock store ------------------------------ */

const at = (s) => `${s}+07:00`;
const ord = (orderNumber, date, itemCount, total, status) => ({
  orderNumber,
  createdAt: at(`${date}T08:00:00`),
  itemCount,
  total,
  status,
});
const addr = (label, receiverName, phone, detail, ward, district, province, isDefault) => ({
  label,
  receiverName,
  phone,
  detail,
  ward,
  district,
  province,
  isDefault,
});

/**
 * 10 khách §2.3. orderCount/totalSpent KHÔNG lưu cứng — suy ra từ `orders`
 * (totalSpent chỉ cộng đơn HOÀN THÀNH) để bảng và chi tiết không lệch nhau.
 */
const mockCustomers = [
  {
    id: 'c1', fullName: 'Đỗ Thị Lan', email: 'lan.do@gmail.com', phone: '0990123456',
    phoneVerified: false, avatarUrl: null, status: 'ACTIVE', lockSource: null,
    lockedUntil: null, lockReason: null, failedLoginAttempts: 0, hasPassword: true,
    createdAt: at('2026-10-12T08:02:00'), addresses: [], orders: [],
  },
  {
    id: 'c2', fullName: 'Vũ Thu Hằng', email: 'hang.vu@gmail.com', phone: '0918765432',
    phoneVerified: true, avatarUrl: null, status: 'ACTIVE', lockSource: null,
    lockedUntil: null, lockReason: null, failedLoginAttempts: 0, hasPassword: true,
    createdAt: at('2026-10-12T07:40:00'), addresses: [
      addr('Nhà', 'Vũ Thu Hằng', '0918765432', 'Số 12 Trần Hưng Đạo', 'Phường Phan Chu Trinh', 'Quận Hoàn Kiếm', 'TP. Hà Nội', true),
    ],
    orders: [ord('NT-20261012-0006', '2026-10-12', 1, 1450000, 'MỚI')],
  },
  {
    id: 'c3', fullName: 'Trần Minh Tuấn', email: 'tuan.tran@gmail.com', phone: '0903456789',
    phoneVerified: true, avatarUrl: null, status: 'ACTIVE', lockSource: null,
    lockedUntil: null, lockReason: null, failedLoginAttempts: 0, hasPassword: false,
    createdAt: at('2026-10-12T06:15:00'), addresses: [], orders: [],
  },
  {
    id: 'c4', fullName: 'Hà Văn Phúc', email: 'phuc.ha@gmail.com', phone: '0989012345',
    phoneVerified: true, avatarUrl: null, status: 'ACTIVE', lockSource: null,
    lockedUntil: null, lockReason: null, failedLoginAttempts: 0, hasPassword: true,
    createdAt: at('2026-10-11T15:05:00'), addresses: [
      addr('Nhà', 'Hà Văn Phúc', '0989012345', '120 Nguyễn Tất Thành', 'Phường 13', 'Quận 4', 'TP. Hồ Chí Minh', true),
    ],
    orders: [
      ord('NT-20261011-0013', '2026-10-11', 1, 2900000, 'HOÀN TRẢ'),
      ord('NT-20261005-0008', '2026-10-05', 1, 2900000, 'HOÀN THÀNH'),
    ],
  },
  {
    id: 'c5', fullName: 'Ngô Quang Huy', email: 'huy.ngo@gmail.com', phone: '0978901234',
    phoneVerified: true, avatarUrl: null, status: 'ACTIVE', lockSource: null,
    lockedUntil: null, lockReason: null, failedLoginAttempts: 0, hasPassword: true,
    createdAt: at('2026-10-10T10:20:00'), addresses: [],
    orders: [
      ord('NT-20261011-0014', '2026-10-11', 2, 5560000, 'ĐÃ HỦY'),
      ord('NT-20261002-0003', '2026-10-02', 2, 2470000, 'HOÀN THÀNH'),
      ord('NT-20260926-0006', '2026-09-26', 1, 1650000, 'HOÀN THÀNH'),
    ],
  },
  {
    id: 'c6', fullName: 'Bùi Thanh Hà', email: 'ha.bui@gmail.com', phone: '0967890123',
    phoneVerified: true, avatarUrl: null, status: 'LOCKED', lockSource: 'ADMIN',
    lockedUntil: null, lockReason: 'Khách yêu cầu khóa tài khoản qua hotline.',
    failedLoginAttempts: 0, hasPassword: true,
    createdAt: at('2026-10-08T09:30:00'), addresses: [
      addr('Nhà', 'Bùi Thanh Hà', '0967890123', '32 Phan Xích Long', 'Phường 2', 'Quận Phú Nhuận', 'TP. Hồ Chí Minh', true),
    ],
    orders: [
      ord('NT-20261011-0015', '2026-10-11', 3, 3380000, 'MỚI'),
      ord('NT-20260930-0010', '2026-09-30', 2, 5670000, 'HOÀN THÀNH'),
    ],
  },
  {
    id: 'c7', fullName: 'Đặng Ngọc Anh', email: 'anh.dang@gmail.com', phone: '0956789012',
    phoneVerified: true, avatarUrl: null, status: 'ACTIVE', lockSource: null,
    lockedUntil: null, lockReason: null, failedLoginAttempts: 0, hasPassword: true,
    createdAt: at('2026-10-05T14:45:00'), addresses: [
      addr('Nhà', 'Đặng Ngọc Anh', '0956789012', '99 Hai Bà Trưng', 'Phường Bến Nghé', 'Quận 1', 'TP. Hồ Chí Minh', true),
    ],
    orders: [ord('NT-20261011-0016', '2026-10-11', 2, 7900000, 'ĐÃ XÁC NHẬN')],
  },
  {
    id: 'c8', fullName: 'Võ Minh Đức', email: 'duc.vo@gmail.com', phone: '0945678901',
    phoneVerified: true, avatarUrl: null, status: 'ACTIVE', lockSource: null,
    lockedUntil: null, lockReason: null, failedLoginAttempts: 0, hasPassword: true,
    createdAt: at('2026-10-03T11:12:00'), addresses: [
      addr('Nhà', 'Võ Minh Đức', '0945678901', '15 Nguyễn Đình Chiểu', 'Phường Đa Kao', 'Quận 1', 'TP. Hồ Chí Minh', true),
    ],
    orders: [
      ord('NT-20261011-0017', '2026-10-11', 1, 890000, 'HOÀN THÀNH'),
      ord('NT-20261003-0012', '2026-10-03', 2, 6200000, 'HOÀN THÀNH'),
      ord('NT-20260918-0005', '2026-09-18', 1, 5390000, 'HOÀN THÀNH'),
      ord('NT-20260910-0003', '2026-09-10', 1, 1200000, 'ĐÃ HỦY'),
      ord('NT-20260902-0001', '2026-09-02', 1, 750000, 'MỚI'),
    ],
  },
  {
    // Tạm khóa tự động (sai mật khẩu 5 lần — F-010): tự mở lúc 09:02 12/10 (§2.3).
    id: 'c9', fullName: 'Phạm Thu Dung', email: 'dung.pham@gmail.com', phone: '0934567890',
    phoneVerified: true, avatarUrl: null, status: 'LOCKED', lockSource: 'AUTO',
    lockedUntil: at('2026-10-12T09:02:00'), lockReason: null, failedLoginAttempts: 5,
    hasPassword: true,
    createdAt: at('2026-10-01T08:48:00'), addresses: [
      addr('Nhà', 'Phạm Thu Dung', '0934567890', '210 Võ Văn Tần', 'Phường 6', 'Quận 3', 'TP. Hồ Chí Minh', true),
    ],
    orders: [
      ord('NT-20261011-0018', '2026-10-11', 4, 2900000, 'ĐANG GIAO'),
      ord('NT-20261006-0009', '2026-10-06', 2, 3850000, 'HOÀN THÀNH'),
      ord('NT-20260922-0007', '2026-09-22', 1, 2500000, 'HOÀN THÀNH'),
    ],
  },
  {
    // Chi tiết đúng §3.6: 6 đơn (3 hoàn thành = 24.650.000đ), 2 địa chỉ.
    id: 'c10', fullName: 'Nguyễn Văn An', email: 'an.nguyen@gmail.com', phone: '0901234567',
    phoneVerified: true, avatarUrl: null, status: 'ACTIVE', lockSource: null,
    lockedUntil: null, lockReason: null, failedLoginAttempts: 0, hasPassword: true,
    createdAt: at('2026-09-25T09:14:00'), addresses: [
      addr('Nhà', 'Nguyễn Văn An', '0901234567', 'Số 45 Lê Lợi', 'Phường Bến Nghé', 'Quận 1', 'TP. Hồ Chí Minh', true),
      addr('Công ty', 'Nguyễn Văn An', '0901234567', 'Tầng 8, 208 Nguyễn Hữu Cảnh', 'Phường 22', 'Quận Bình Thạnh', 'TP. Hồ Chí Minh', false),
    ],
    orders: [
      ord('NT-20261012-0007', '2026-10-12', 3, 4250000, 'MỚI'),
      ord('NT-20261005-0011', '2026-10-05', 2, 12900000, 'HOÀN THÀNH'),
      ord('NT-20260928-0009', '2026-09-28', 1, 7900000, 'HOÀN THÀNH'),
      ord('NT-20260920-0004', '2026-09-20', 2, 3850000, 'HOÀN THÀNH'),
      ord('NT-20260912-0002', '2026-09-12', 2, 5560000, 'ĐÃ HỦY'),
      ord('NT-20260905-0001', '2026-09-05', 1, 1990000, 'HOÀN TRẢ'),
    ],
  },
];

function findMockCustomer(id) {
  const c = mockCustomers.find((x) => x.id === id);
  if (!c) {
    throw apiError(404, { code: 'CUSTOMER_NOT_FOUND', message: 'Không tìm thấy khách hàng.' });
  }
  return c;
}

function totalSpentOf(c) {
  return (c.orders || [])
    .filter((o) => o.status === 'HOÀN THÀNH')
    .reduce((s, o) => s + (o.total || 0), 0);
}

function toRow(c) {
  return {
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    phoneVerified: c.phoneVerified,
    avatarUrl: c.avatarUrl,
    status: c.status,
    lockSource: c.lockSource,
    lockedUntil: c.lockedUntil,
    createdAt: c.createdAt,
    orderCount: (c.orders || []).length,
    totalSpent: totalSpentOf(c),
  };
}

function toDetail(c) {
  const orders = [...(c.orders || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const byStatus = {
    completed: orders.filter((o) => o.status === 'HOÀN THÀNH').length,
    processing: orders.filter((o) =>
      ['MỚI', 'ĐÃ XÁC NHẬN', 'ĐANG GIAO'].includes(o.status)
    ).length,
    cancelled: orders.filter((o) => o.status === 'ĐÃ HỦY').length,
    returned: orders.filter((o) => o.status === 'HOÀN TRẢ').length,
  };
  const last = orders[0] || null;
  return {
    ...toRow(c),
    lockReason: c.lockSource === 'ADMIN' ? c.lockReason : null,
    failedLoginAttempts: c.failedLoginAttempts || 0,
    hasPassword: c.hasPassword !== false,
    addresses: (c.addresses || []).slice(0, 5).map((a) => ({
      ...a,
      fullAddress: [a.detail, a.ward, a.district, a.province].filter(Boolean).join(', '),
    })),
    stats: {
      orderCount: orders.length,
      completedOrderCount: byStatus.completed,
      totalSpent: totalSpentOf(c),
      countByStatus: byStatus,
      lastOrder: last
        ? {
            orderNumber: last.orderNumber,
            createdAt: last.createdAt,
            status: last.status,
            total: last.total,
          }
        : null,
    },
    recentOrders: orders.slice(0, 5).map((o) => ({ ...o })),
  };
}

const MOCK_SORTS = {
  'createdAt,desc': (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  'createdAt,asc': (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  'totalSpent,desc': (a, b) => totalSpentOf(b) - totalSpentOf(a),
  'totalSpent,asc': (a, b) => totalSpentOf(a) - totalSpentOf(b),
};

/* ------------------------------ Public API ------------------------------ */

/**
 * Danh sách khách hàng (chỉ ROLE_CUSTOMER phía BE).
 * params: { q, status: ''|'ACTIVE'|'LOCKED', verified: ''|true|false,
 *           sort, page (0-indexed), size }.
 */
export async function listCustomers(params = {}) {
  const { q = '', status = '', verified = '', page = 0, size = 10, sort = 'createdAt,desc' } = params;
  if (!USE_MOCK) {
    return callApi(async () => {
      const query = { page, size, sort };
      if (q) query.q = q;
      if (status) query.status = status;
      if (verified !== '' && verified !== null && verified !== undefined) {
        query.phoneVerified = verified;
      }
      const { data } = await axiosClient.get('/admin/customers', { params: query });
      return data;
    });
  }
  await delay(MOCK_DELAY);
  const needle = normalizeVi(q.trim());
  const needleDigits = q.replace(/\D/g, '');
  let rows = [...mockCustomers];
  if (needle || needleDigits) {
    rows = rows.filter(
      (c) =>
        normalizeVi(c.fullName).includes(needle) ||
        normalizeVi(c.email).includes(needle) ||
        (needleDigits && c.phone.replace(/\D/g, '').includes(needleDigits))
    );
  }
  if (status) rows = rows.filter((c) => c.status === status);
  if (verified !== '' && verified !== null && verified !== undefined) {
    rows = rows.filter((c) => c.phoneVerified === (verified === true || verified === 'true'));
  }
  rows.sort(MOCK_SORTS[sort] || MOCK_SORTS['createdAt,desc']);
  const total = rows.length;
  const safePage = Math.max(0, page);
  const items = rows.slice(safePage * size, safePage * size + size).map(toRow);
  return { items: clone(items), total, page: safePage, size };
}

/** Chi tiết khách hàng cho slide-over — 404 khi không tồn tại / không phải khách. */
export async function getCustomer(id) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get(`/admin/customers/${id}`)).data);
  }
  await delay(MOCK_DELAY);
  return clone(toDetail(findMockCustomer(id)));
}

/**
 * Khóa tài khoản — đặt khóa do quản trị viên (không tự mở, §4.3).
 * body { reason? } -> CustomerRow · 409 khi đã bị khóa do admin.
 */
export async function lockCustomer(id, { reason } = {}) {
  if (!USE_MOCK) {
    return callApi(
      async () =>
        (await axiosClient.patch(`/admin/customers/${id}/lock`, reason ? { reason } : {}))
          .data
    );
  }
  await delay(MOCK_DELAY);
  const c = findMockCustomer(id);
  if (c.lockSource === 'ADMIN') {
    throw apiError(409, {
      code: 'ALREADY_LOCKED',
      message: 'Tài khoản này đã bị khóa bởi quản trị viên.',
    });
  }
  c.status = 'LOCKED';
  c.lockSource = 'ADMIN';
  c.lockedUntil = null;
  c.lockReason = reason?.trim() || null;
  return clone(toRow(c));
}

/** Mở khóa tài khoản — làm ngay · 409 khi tài khoản đang hoạt động. */
export async function unlockCustomer(id) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.patch(`/admin/customers/${id}/unlock`)).data);
  }
  await delay(MOCK_DELAY);
  const c = findMockCustomer(id);
  if (c.status === 'ACTIVE') {
    throw apiError(409, {
      code: 'NOT_LOCKED',
      message: 'Tài khoản đang hoạt động, không cần mở khóa.',
    });
  }
  c.status = 'ACTIVE';
  c.lockSource = null;
  c.lockedUntil = null;
  c.lockReason = null;
  c.failedLoginAttempts = 0;
  return clone(toRow(c));
}
