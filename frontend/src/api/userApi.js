/**
 * API module hồ sơ tài khoản — FR-015 / F-010 / F-024 (spec ho-so.md).
 *
 * Contract (khớp UserController backend):
 *   GET /users/me                    -> Profile
 *   PUT /users/me                    { fullName?, avatarUrl? } -> Profile
 *                                      (avatarUrl = "" nghĩa là xóa ảnh)
 *   PUT /users/me/password           { currentPassword, newPassword, logoutOtherDevices? }
 *                                      -> { message }  (tài khoản Google: currentPassword để trống)
 *   PUT /users/me/phone              { phone, otpCode } -> Profile
 * Profile: { id, fullName, email, phone, phoneVerified, avatarUrl,
 *            hasPassword, status, roles, createdAt }
 * Error code (đã chuẩn hóa phía FE): wrong_current | same_password |
 *   weak_password | phone_used | same_phone | otp_invalid | network | unknown
 *
 * OTP đổi SĐT: gửi mã qua authApi.sendOtp(phone, 'change-phone') trước,
 * xác thực kèm luôn trong PUT /users/me/phone (server kiểm tra qua OtpService).
 *
 * Khi backend chưa sẵn sàng, dùng mock và áp đúng logic ở client.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 * (vite.config.js đã có proxy entry /users.)
 */
import axiosClient from './axiosClient';
import { DEMO_OTP } from './authApi';
import { getUser, updateStoredUser } from '../utils/auth';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mật khẩu của tài khoản demo trong authApi (0901234567) — chỉ dùng cho mock. */
const MOCK_DEMO_PASSWORD = 'matkhau123';

function userError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** Map mã lỗi backend (UPPER_SNAKE) -> mã FE dùng trong component. */
const REAL_CODE_MAP = {
  WRONG_CURRENT_PASSWORD: 'wrong_current',
  SAME_PASSWORD: 'same_password',
  WEAK_PASSWORD: 'weak_password',
  PHONE_EXISTS: 'phone_used',
  SAME_PHONE: 'same_phone',
  OTP_INVALID: 'otp_invalid',
  OTP_EXPIRED: 'otp_invalid',
  OTP_ATTEMPTS_EXCEEDED: 'otp_invalid',
  INVALID_NAME: 'invalid_name',
  INVALID_PHONE: 'invalid_phone',
};

function normalizeRealError(e) {
  const data = e?.response?.data;
  const rawCode = data?.code || '';
  const code =
    REAL_CODE_MAP[rawCode] || (e?.code === 'ERR_NETWORK' ? 'network' : 'unknown');
  const message = data?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  return userError(code, message);
}

/* ------------------------------ Mock state ------------------------------ */

/**
 * Hồ sơ mock suy từ phiên đang lưu (sau login mock, user là tài khoản demo
 * của authApi); thiếu phiên thì dùng đúng dữ liệu mẫu spec ho-so.md §7.
 */
function baseMockProfile() {
  const u = getUser();
  return {
    id: u?.id || 'demo-user',
    fullName: u?.fullName || 'Nguyễn Minh Anh',
    email: u?.email || 'minhanh.nguyen@gmail.com',
    phone: u?.phone || '0901234567',
    phoneVerified: u?.phoneVerified ?? true,
    avatarUrl: u?.avatarUrl || null,
    hasPassword: u?.hasPassword ?? true,
    status: u?.status || 'ACTIVE',
    roles: u?.roles || ['ROLE_CUSTOMER'],
    createdAt: u?.createdAt || '2026-10-01T08:00:00.000Z',
  };
}

let mockProfile = null;

function currentMockProfile() {
  if (!mockProfile) mockProfile = baseMockProfile();
  return mockProfile;
}

/** Đồng bộ các field hiển thị ra phiên đang lưu để Header cập nhật ngay. */
function syncStoredUser(profile) {
  updateStoredUser({
    fullName: profile.fullName,
    phone: profile.phone,
    phoneVerified: profile.phoneVerified,
    avatarUrl: profile.avatarUrl,
  });
}

/* ------------------------------ Public API ------------------------------ */

export async function getProfile() {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return { ...currentMockProfile() };
  }
  try {
    const { data } = await axiosClient.get('/users/me');
    syncStoredUser(data);
    return data;
  } catch (e) {
    throw normalizeRealError(e);
  }
}

/**
 * Cập nhật họ tên / ảnh đại diện.
 * patch.avatarUrl: URL/data-URL mới; "" = xóa ảnh; không truyền = giữ nguyên.
 */
export async function updateProfile(patch) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const profile = currentMockProfile();
    if (patch.fullName !== undefined) {
      const name = String(patch.fullName).trim();
      if (name.length < 2 || name.length > 50) {
        throw userError('invalid_name', 'Họ tên cần từ 2 đến 50 ký tự.');
      }
      profile.fullName = name;
    }
    if (patch.avatarUrl !== undefined) {
      profile.avatarUrl = patch.avatarUrl === '' ? null : patch.avatarUrl;
    }
    syncStoredUser(profile);
    return { ...profile };
  }
  try {
    const { data } = await axiosClient.put('/users/me', patch);
    syncStoredUser(data);
    return data;
  } catch (e) {
    throw normalizeRealError(e);
  }
}

/**
 * Đổi mật khẩu (hoặc tạo mật khẩu cho tài khoản Google khi hasPassword=false
 * -> truyền currentPassword = null). F-010: mật khẩu mới >= 8 ký tự.
 */
export async function changePassword(currentPassword, newPassword, logoutOtherDevices = false) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const profile = currentMockProfile();
    if (newPassword == null || newPassword.length < 8) {
      throw userError('weak_password', 'Mật khẩu cần ít nhất 8 ký tự.');
    }
    if (profile.hasPassword) {
      if (currentPassword !== MOCK_DEMO_PASSWORD) {
        throw userError('wrong_current', 'Mật khẩu hiện tại chưa đúng.');
      }
      if (newPassword === currentPassword) {
        throw userError('same_password', 'Mật khẩu mới cần khác mật khẩu hiện tại.');
      }
    }
    profile.hasPassword = true;
    return { ok: true };
  }
  try {
    const { data } = await axiosClient.put('/users/me/password', {
      currentPassword,
      newPassword,
      logoutOtherDevices,
    });
    return data;
  } catch (e) {
    throw normalizeRealError(e);
  }
}

/**
 * Đồng bộ trạng thái SĐT sau khi panel Hồ sơ xác thực thành công qua
 * authApi.verifyOtp (màn 6). Real: server đã set phoneVerified ở endpoint
 * verify -> đọc lại hồ sơ. Mock: cập nhật state mock + phiên đang lưu.
 */
export async function syncPhoneVerified() {
  if (USE_MOCK) {
    await delay(200);
    const profile = currentMockProfile();
    profile.phoneVerified = true;
    syncStoredUser(profile);
    return { ...profile };
  }
  return getProfile();
}

/**
 * Đổi số điện thoại — bắt buộc kèm mã OTP đã gửi về SỐ MỚI (F-024).
 * Thành công: SĐT cập nhật + phoneVerified = true.
 */
export async function changePhone(newPhone, otpCode) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const profile = currentMockProfile();
    if (newPhone === profile.phone) {
      throw userError('same_phone', 'Số điện thoại mới trùng với số hiện tại.');
    }
    if (otpCode !== DEMO_OTP) {
      throw userError('otp_invalid', 'Mã xác thực chưa đúng. Vui lòng kiểm tra và thử lại.');
    }
    profile.phone = newPhone;
    profile.phoneVerified = true;
    syncStoredUser(profile);
    return { ...profile };
  }
  try {
    const { data } = await axiosClient.put('/users/me/phone', {
      phone: newPhone,
      otpCode,
    });
    syncStoredUser(data);
    return data;
  } catch (e) {
    throw normalizeRealError(e);
  }
}
