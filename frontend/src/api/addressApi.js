/**
 * API module địa chỉ nhận hàng — FR-009 · F-007 · F-011.
 *
 * Contract (khớp AddressController backend — đã có từ màn Đăng nhập):
 *   GET /addresses        -> Address[]
 *   POST /addresses       (body AddressInput) -> Address (201)
 *   PUT /addresses/{id}   (body AddressInput) -> Address
 *   DELETE /addresses/{id} -> 204
 * Address: { id, label, receiverName, phone, province, district, ward,
 *            detail, note?, isDefault }
 * AddressInput: như Address trừ id.
 *
 * Quy tắc F-011: tối đa 5 địa chỉ, luôn có đúng 1 mặc định; xóa địa chỉ
 * mặc định -> chuyển mặc định sang địa chỉ còn lại đầu tiên.
 *
 * Khi backend chưa sẵn sàng, dùng mock và áp đúng logic ở client.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 400;

const MAX_ADDRESSES = 5;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 2 địa chỉ mẫu: 1 mặc định (mock, reset khi reload trang). */
let mockAddresses = [
  {
    id: 'a1',
    label: 'Nhà',
    receiverName: 'Nguyễn Văn An',
    phone: '0901234567',
    province: 'TP. Hồ Chí Minh',
    district: 'Quận 1',
    ward: 'Phường Bến Nghé',
    detail: '123 Nguyễn Huệ',
    note: 'Gọi trước 30 phút khi giao',
    isDefault: true,
  },
  {
    id: 'a2',
    label: 'Công ty',
    receiverName: 'Nguyễn Văn An',
    phone: '0901234567',
    province: 'TP. Hồ Chí Minh',
    district: 'Quận 3',
    ward: 'Phường Võ Thị Sáu',
    detail: '456 Lê Văn Sỹ, Tầng 5',
    note: '',
    isDefault: false,
  },
];

function mockError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** Đảm bảo đúng 1 mặc định sau mỗi thay đổi (F-011). */
function normalizeDefault(list) {
  const withDefault = list.filter((a) => a.isDefault);
  if (withDefault.length === 0 && list.length > 0) {
    list[0].isDefault = true;
  } else if (withDefault.length > 1) {
    let first = true;
    list.forEach((a) => {
      if (a.isDefault) {
        if (first) first = false;
        else a.isDefault = false;
      }
    });
  }
  return list;
}

function toMockAddress(data, id) {
  return {
    id,
    label: data.label === 'Công ty' ? 'Công ty' : 'Nhà',
    receiverName: String(data.receiverName || '').trim(),
    phone: String(data.phone || '').trim(),
    province: data.province || '',
    district: data.district || '',
    ward: data.ward || '',
    detail: String(data.detail || '').trim(),
    note: String(data.note || '').trim(),
    isDefault: Boolean(data.isDefault),
  };
}

/** Chỉ dùng nội bộ mock (orderApi cần snapshot địa chỉ khi tạo đơn). */
export function findMockAddress(id) {
  return mockAddresses.find((a) => a.id === id) || null;
}

export function getMaxAddresses() {
  return MAX_ADDRESSES;
}

export async function getAddresses() {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return normalizeDefault([...mockAddresses.map((a) => ({ ...a }))]);
  }
  const { data } = await axiosClient.get('/addresses');
  return data;
}

export async function createAddress(data) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    if (mockAddresses.length >= MAX_ADDRESSES) {
      throw mockError('max_reached', 'Bạn đã lưu tối đa 5 địa chỉ.');
    }
    const created = toMockAddress(data, `a${Date.now()}`);
    if (mockAddresses.length === 0) created.isDefault = true;
    if (created.isDefault) {
      mockAddresses = mockAddresses.map((a) => ({ ...a, isDefault: false }));
    }
    mockAddresses = normalizeDefault([...mockAddresses, created]);
    return { ...created };
  }
  const { data: created } = await axiosClient.post('/addresses', data);
  return created;
}

export async function updateAddress(id, data) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const index = mockAddresses.findIndex((a) => a.id === id);
    if (index === -1) throw mockError('not_found', 'Không tìm thấy địa chỉ.');
    const updated = { ...toMockAddress(data, id) };
    if (updated.isDefault) {
      mockAddresses = mockAddresses.map((a) =>
        a.id === id ? updated : { ...a, isDefault: false }
      );
    } else {
      mockAddresses = mockAddresses.map((a) => (a.id === id ? updated : a));
    }
    mockAddresses = normalizeDefault(mockAddresses);
    return { ...mockAddresses.find((a) => a.id === id) };
  }
  const { data: updated } = await axiosClient.put(`/addresses/${id}`, data);
  return updated;
}

export async function deleteAddress(id) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    mockAddresses = mockAddresses.filter((a) => a.id !== id);
    // F-011: xóa mặc định -> địa chỉ còn lại đầu tiên thành mặc định.
    mockAddresses = normalizeDefault(mockAddresses);
    return true;
  }
  await axiosClient.delete(`/addresses/${id}`);
  return true;
}
