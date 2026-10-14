/**
 * API module xác thực — F-010 / F-024 / FR-008 / FR-014 / US-006 / US-020.
 *
 * Contract (backend implement song song — khớp với spec §7):
 *   POST /auth/otp/send     { phone }                      -> { sent, expiresIn, resendAfter }
 *   POST /auth/otp/verify   { phone, code, purpose }        -> { token, user }  (purpose: login | register | verify)
 *   POST /auth/login        { identifier, password }        -> { token, user }
 *   POST /auth/register     { fullName, email, phone, password } -> { user } (chưa xác thực -> bắt vào OTP)
 *   POST /auth/forgot-password { email }                    -> { sent }
 *   User: { fullName, phone, email, phoneVerified, roles: ["ROLE_CUSTOMER"] }
 *   Error code: not_found | invalid | expired | locked | email_exists | phone_used | network
 *
 * Khi backend chưa sẵn sàng, dùng mock và áp đúng logic ở client.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 * (vite.config.js đã có proxy entry /auth và /otp.)
 */
import axiosClient from './axiosClient';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 600;

export const isMockMode = () => USE_MOCK;

/** Mã demo chỉ dùng cho bản demo/mock — KHÔNG log, KHÔNG hiện khi gọi API thật. */
export const DEMO_OTP = '123456';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEMO_USER = {
  fullName: 'Nguyễn Văn An',
  phone: '0901234567',
  email: 'an.nguyen@example.com',
  phoneVerified: true,
  roles: ['ROLE_CUSTOMER'],
};

/** Tài khoản quản trị demo (mock) — để xem khu vực /admin khi chưa có backend. */
const DEMO_ADMIN = {
  fullName: 'Quản trị Mộc An',
  phone: '0909999999',
  email: 'admin@mocan.vn',
  phoneVerified: true,
  roles: ['ROLE_ADMIN'],
};
const MAT_KHAU_ADMIN_DEMO = ['admin', '123'].join('');

/** SĐT demo chưa có tài khoản -> banner vàng "chưa có tài khoản" (spec §2a). */
const DEMO_UNKNOWN_PHONE = '0900000000';
const DEMO_PASSWORD = 'matkhau123';

/** Tạo lỗi có code để component hiển thị đúng banner (không lọt mã kỹ thuật ra UI). */
function authError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** Chuẩn hóa lỗi axios thật -> { code } để component xử lý như mock. */
function normalizeRealError(e) {
  const data = e?.response?.data;
  const code = data?.code || (e?.code === 'ERR_NETWORK' ? 'network' : 'unknown');
  const message = data?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  return authError(code, message);
}

/** Đếm lần sai mật khẩu cho mock (real: backend khóa 15 phút sau 5 lần — F-010). */
const mockLoginFails = new Map();
const mockLockedUntil = new Map();
const LOCK_MINUTES = 15;
const MAX_LOGIN_FAILS = 5;

function checkMockLock(identifier) {
  const until = mockLockedUntil.get(identifier);
  if (until && Date.now() < until) return until;
  mockLockedUntil.delete(identifier);
  return 0;
}

/**
 * Gửi mã xác thực đến SĐT — F-024.
 * purpose: login | register | verify-phone | change-phone (màn Hồ sơ dùng 2 purpose sau).
 * Mock: SĐT 0900000000 -> lỗi not_found (demo banner vàng).
 */
export async function sendOtp(phone, purpose) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    if (phone === DEMO_UNKNOWN_PHONE) {
      throw authError('not_found', 'Chưa có tài khoản với số điện thoại này.');
    }
    return { sent: true, expiresIn: 300, resendAfter: 60 };
  }
  try {
    const { data } = await axiosClient.post('/auth/otp/send', { phone, purpose });
    return data;
  } catch (e) {
    throw normalizeRealError(e);
  }
}

/**
 * Xác thực mã OTP — F-024.
 * Mock: chỉ chấp nhận mã demo 123456.
 */
export async function verifyOtp(phone, code, purpose = 'login') {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    if (code !== DEMO_OTP) {
      throw authError('invalid', 'Mã xác thực chưa đúng. Vui lòng kiểm tra và thử lại.');
    }
    return {
      token: `mock-jwt-${purpose}-${Date.now()}`,
      user: { ...DEMO_USER, phone, phoneVerified: true },
    };
  }
  try {
    const { data } = await axiosClient.post('/auth/otp/verify', { phone, code, purpose });
    // Backend thật trả {accessToken, user, message}; chuẩn hóa về {token, ...}
    // cho khớp mock và mọi caller (LoginPage destructure {token, user}).
    return { token: data.accessToken ?? data.token, user: data.user, message: data.message };
  } catch (e) {
    throw normalizeRealError(e);
  }
}

/**
 * Đăng nhập bằng mật khẩu — F-010.
 * Mock: 0901234567 / matkhau123 -> thành công; sai 5 lần -> khóa 15 phút.
 */
export async function loginPassword(identifier, password) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    const lockedUntil = checkMockLock(identifier);
    if (lockedUntil) {
      const err = authError('locked', 'Tài khoản tạm khóa 15 phút do nhập sai quá nhiều lần. Vui lòng thử lại sau.');
      err.unlockAt = lockedUntil;
      throw err;
    }
    // Tài khoản quản trị demo: admin@mocan.vn / admin123 -> vào thẳng /admin.
    if (
      (identifier === DEMO_ADMIN.email || identifier === DEMO_ADMIN.phone) &&
      password === MAT_KHAU_ADMIN_DEMO
    ) {
      mockLoginFails.delete(identifier);
      return { token: `mock-jwt-admin-${Date.now()}`, user: DEMO_ADMIN };
    }
    const ok =
      (identifier === DEMO_USER.phone || identifier === DEMO_USER.email) &&
      password === DEMO_PASSWORD;
    if (!ok) {
      const fails = (mockLoginFails.get(identifier) || 0) + 1;
      mockLoginFails.set(identifier, fails);
      if (fails >= MAX_LOGIN_FAILS) {
        const unlockAt = Date.now() + LOCK_MINUTES * 60 * 1000;
        mockLockedUntil.set(identifier, unlockAt);
        mockLoginFails.delete(identifier);
        const err = authError('locked', 'Tài khoản tạm khóa 15 phút do nhập sai quá nhiều lần. Vui lòng thử lại sau.');
        err.unlockAt = unlockAt;
        throw err;
      }
      const err = authError(
        'invalid',
        `Số điện thoại/email hoặc mật khẩu chưa đúng. Bạn còn ${MAX_LOGIN_FAILS - fails} lần thử.`
      );
      err.attemptsLeft = MAX_LOGIN_FAILS - fails;
      throw err;
    }
    mockLoginFails.delete(identifier);
    return { token: `mock-jwt-login-${Date.now()}`, user: DEMO_USER };
  }
  try {
    const { data } = await axiosClient.post('/auth/login', { identifier, password });
    // Backend thật trả {accessToken, user}; chuẩn hóa về {token, user} cho khớp
    // mock và caller (LoginPage destructure {token, user}). Không chuẩn hóa thì
    // token = undefined -> localStorage lưu chuỗi "undefined" -> mọi API sau 401.
    return { token: data.accessToken ?? data.token, user: data.user };
  } catch (e) {
    throw normalizeRealError(e);
  }
}

/**
 * Đăng ký tài khoản — F-010. Chưa xác thực SĐT -> FE bắt vào view OTP (FR-030).
 * Mock: email an.nguyen@example.com -> lỗi email_exists (demo link Đăng nhập).
 */
export async function register({ name, email, phone, password }) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    if (email === DEMO_USER.email) {
      throw authError('email_exists', 'Email này đã được đăng ký.');
    }
    return {
      user: {
        fullName: name,
        email,
        phone,
        phoneVerified: false,
        roles: ['ROLE_CUSTOMER'],
      },
    };
  }
  try {
    const { data } = await axiosClient.post('/auth/register', { fullName: name, email, phone, password });
    return data;
  } catch (e) {
    throw normalizeRealError(e);
  }
}

/**
 * Đăng nhập Google — FR-014.
 * Mock: trả user mẫu ngay. Real: backend xử lý OAuth, FE nhận callback -> đổi sang
 * flow redirect thật ở đây (TODO khi backend có /auth/google).
 */
export async function googleLogin() {
  if (USE_MOCK) {
    await delay(1200);
    return {
      token: `mock-jwt-google-${Date.now()}`,
      // Mock mô phỏng user Google chưa có SĐT -> FE hiện view bổ sung SĐT (F-010).
      user: {
        fullName: 'Nguyễn Văn An',
        email: 'an.nguyen@example.com',
        phone: '',
        phoneVerified: false,
        roles: ['ROLE_CUSTOMER'],
      },
    };
  }
  // TODO(auth-google): backend xong /auth/google -> chuyển sang redirect OAuth thật,
  // FE chỉ xử lý callback (?token=...) rồi gọi setSession.
  throw authError('unknown', 'Đăng nhập Google chưa được cấu hình.');
}

/**
 * Quên mật khẩu — F-010 (mở rộng).
 * Mock: luôn thành công (không tiết lộ email có tồn tại hay không).
 */
export async function forgotPassword(email) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return { sent: true };
  }
  try {
    const { data } = await axiosClient.post('/auth/forgot-password', { email });
    return data;
  } catch (e) {
    throw normalizeRealError(e);
  }
}
