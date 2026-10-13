/**
 * API Quản lý banner (admin) — FR-027 · F-021 (admin-banner.md §8).
 *
 * Contract (khớp AdminBannerController backend):
 *   GET    /admin/banners            -> [{ id, imageUrl, linkUrl, title, subtitle,
 *                                        ctaText, sortOrder, active }]
 *                                        (toàn bộ kể cả đã tắt, sortOrder tăng dần)
 *   GET    /admin/banners/{id}       -> 1 banner cùng shape
 *   POST   /admin/banners            -> 201 banner đã tạo · 400 { field, message }
 *   PUT    /admin/banners/{id}       -> 200 · 400 như POST · 404 khi không tồn tại
 *   DELETE /admin/banners/{id}       -> 204 (xóa cứng; backend chuẩn hoá sortOrder 1..n)
 *   PATCH  /admin/banners/{id}       -> { active } -> 200 banner
 *   PUT    /admin/banners/reorder    -> { ids: [...] } -> 200 [{ id, sortOrder }] (1..n)
 *   POST   /admin/banners/images (multipart "file") -> { url } (≤5MB; JPG/PNG/WebP)
 *
 * Banner KHÔNG có startAt/endAt (ERD/model không có) — không gửi/nhận 2 trường này.
 *
 * Mock: thao tác TRỰC TIẾP trên mockBanners (kho dùng chung với homeApi phía
 * khách) để sửa/tắt/thêm ở admin thấy ngay ở trang chủ. Kho khởi tạo 4 banner
 * theo spec §2.2: 3 đang hiện + 1 đã tắt.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { mockBanners } from '../mocks/homeMock';

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

/* --------------------------- Mock internals --------------------------- */

// mockStore CHÍNH LÀ mockBanners (cùng tham chiếu) — không copy, để phía
// khách (homeApi lọc active + sort) thấy ngay mọi thay đổi từ admin.
const mockStore = mockBanners;

let idSeq = 100;
const genId = () => `bn${(idSeq += 1)}`;

const sortedMock = () => [...mockStore].sort((a, b) => a.sortOrder - b.sortOrder);
const toBanner = (b) => ({ ...b });

/** Chuẩn hoá sortOrder của toàn bộ danh sách thành dãy liên tục 1..n (§3). */
function normalizeMock(sorted) {
  sorted.forEach((b, i) => {
    b.sortOrder = i + 1;
  });
}

function findMockBanner(id) {
  const b = mockStore.find((x) => x.id === id);
  if (!b) {
    throw apiError(404, { code: 'BANNER_NOT_FOUND', message: 'Không tìm thấy banner.' });
  }
  return b;
}

/** Validate khớp AdminBannerService (§4.2/§4.4 + giới hạn [Giả định] của spec). */
function validateMockBanner(body) {
  if (!body?.imageUrl?.trim()) {
    throw apiError(400, {
      code: 'VALIDATION_ERROR',
      field: 'imageUrl',
      message: 'Ảnh banner là bắt buộc.',
    });
  }
  if (!body?.title?.trim()) {
    throw apiError(400, {
      code: 'VALIDATION_ERROR',
      field: 'title',
      message: 'Tiêu đề là bắt buộc.',
    });
  }
  if (body.title.trim().length > 80) {
    throw apiError(400, {
      code: 'VALIDATION_ERROR',
      field: 'title',
      message: 'Tiêu đề tối đa 80 ký tự.',
    });
  }
  if ((body.subtitle || '').trim().length > 120) {
    throw apiError(400, {
      code: 'VALIDATION_ERROR',
      field: 'subtitle',
      message: 'Mô tả phụ tối đa 120 ký tự.',
    });
  }
  if ((body.ctaText || '').trim().length > 20) {
    throw apiError(400, {
      code: 'VALIDATION_ERROR',
      field: 'ctaText',
      message: 'Chữ trên nút tối đa 20 ký tự.',
    });
  }
  if (!body?.linkUrl?.trim()) {
    throw apiError(400, {
      code: 'VALIDATION_ERROR',
      field: 'linkUrl',
      message: 'Link đích là bắt buộc.',
    });
  }
  const link = body.linkUrl.trim();
  if (!link.startsWith('/') && !/^https?:\/\//i.test(link)) {
    throw apiError(400, {
      code: 'VALIDATION_ERROR',
      field: 'linkUrl',
      message:
        'Link đích phải bắt đầu bằng / (trang trong cửa hàng) hoặc là địa chỉ web đầy đủ bắt đầu bằng http.',
    });
  }
  if (
    body.sortOrder != null &&
    body.sortOrder !== '' &&
    (!Number.isInteger(Number(body.sortOrder)) || Number(body.sortOrder) < 1)
  ) {
    throw apiError(400, {
      code: 'VALIDATION_ERROR',
      field: 'sortOrder',
      message: 'Thứ tự hiển thị phải là số nguyên từ 1 trở lên.',
    });
  }
}

function cleanBody(body) {
  return {
    imageUrl: body.imageUrl.trim(),
    linkUrl: body.linkUrl.trim(),
    title: body.title.trim(),
    subtitle: (body.subtitle || '').trim(),
    ctaText: (body.ctaText || '').trim(),
    active: body.active !== false,
  };
}

/**
 * Chèn banner vào vị trí mong muốn trong danh sách đã sort (kẹp 1..n+1),
 * các banner sau dịch xuống 1 bậc, rồi chuẩn hoá 1..n (§4.2).
 */
function insertMock(banner, desiredSortOrder, excludeId) {
  const others = sortedMock().filter((b) => b.id !== excludeId);
  const pos =
    desiredSortOrder == null || desiredSortOrder === ''
      ? others.length + 1
      : Math.min(Math.max(1, Number(desiredSortOrder)), others.length + 1);
  others.splice(pos - 1, 0, banner);
  normalizeMock(others);
  return banner;
}

/* ------------------------------ Public API ------------------------------ */

/** Toàn bộ banner (kể cả đã tắt), sortOrder tăng dần. */
export async function listBanners() {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get('/admin/banners')).data);
  }
  await delay(MOCK_DELAY);
  return sortedMock().map(toBanner);
}

/** Chi tiết nạp vào form sửa. */
export async function getBanner(id) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.get(`/admin/banners/${id}`)).data);
  }
  await delay(MOCK_DELAY);
  return toBanner(findMockBanner(id));
}

/** Tạo banner → 201 banner đã tạo (sortOrder đã chuẩn hoá 1..n). */
export async function createBanner(body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.post('/admin/banners', body)).data);
  }
  await delay(MOCK_DELAY);
  validateMockBanner(body);
  const banner = { id: genId(), ...cleanBody(body), sortOrder: 0 };
  // Chèn theo vị trí TRƯỚC khi đưa vào kho: insertMock dựng danh sách từ kho
  // hiện tại (chưa có banner mới) rồi chuẩn hoá 1..n lên chính object này.
  insertMock(banner, body.sortOrder, banner.id);
  mockStore.push(banner);
  return toBanner(banner);
}

/** Cập nhật banner → banner đã sửa. */
export async function updateBanner(id, body) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.put(`/admin/banners/${id}`, body)).data);
  }
  await delay(MOCK_DELAY);
  const banner = findMockBanner(id);
  validateMockBanner(body);
  Object.assign(banner, cleanBody(body));
  insertMock(banner, body.sortOrder, id);
  return toBanner(banner);
}

/** Xóa cứng — không entity nào tham chiếu Banner nên xóa được hẳn (§6.2). */
export async function deleteBanner(id) {
  if (!USE_MOCK) {
    return callApi(async () => {
      await axiosClient.delete(`/admin/banners/${id}`);
      return null;
    });
  }
  await delay(MOCK_DELAY);
  const banner = findMockBanner(id);
  mockStore.splice(mockStore.indexOf(banner), 1);
  normalizeMock(sortedMock());
  return null;
}

/** PATCH nhanh: { active } — bật/tắt ngay trên thẻ (§6.1). */
export async function patchBanner(id, patch) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.patch(`/admin/banners/${id}`, patch)).data);
  }
  await delay(250);
  const banner = findMockBanner(id);
  if (patch?.active !== undefined) banner.active = Boolean(patch.active);
  return toBanner(banner);
}

/**
 * Đổi thứ tự: gửi TOÀN BỘ ids theo thứ tự mới → trả [{ id, sortOrder }]
 * sau chuẩn hoá 1..n (§3). Id lạ bị bỏ qua; banner thiếu được nối cuối.
 */
export async function reorderBanners(ids) {
  if (!USE_MOCK) {
    return callApi(async () => (await axiosClient.put('/admin/banners/reorder', { ids })).data);
  }
  await delay(250);
  const byId = new Map(mockStore.map((b) => [b.id, b]));
  const ordered = [];
  (ids || []).forEach((id) => {
    if (byId.has(id)) {
      ordered.push(byId.get(id));
      byId.delete(id);
    }
  });
  sortedMock()
    .filter((b) => byId.has(b.id))
    .forEach((b) => ordered.push(b));
  normalizeMock(ordered);
  return ordered.map((b) => ({ id: b.id, sortOrder: b.sortOrder }));
}

/**
 * Upload ảnh banner — gọi ngay khi admin chọn file (pattern màn 15/16).
 * Mock: trả object URL của chính file để xem trước.
 */
export async function uploadBannerImage(file) {
  if (!USE_MOCK) {
    return callApi(async () => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axiosClient.post('/admin/banners/images', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data; // { url }
    });
  }
  await delay(600);
  return { url: URL.createObjectURL(file) };
}
