/**
 * Lưu trữ phiên đăng nhập — dùng đúng key `accessToken` mà axiosClient đang đọc.
 * remember=true  -> localStorage (giữ đăng nhập sau khi đóng trình duyệt)
 * remember=false -> sessionStorage (đăng nhập 1 phiên)
 * Mọi thay đổi trạng thái phát event `mocan:auth-changed` để UI cập nhật realtime.
 */

const TOKEN_KEY = 'accessToken';
const USER_KEY = 'mocan_user';

function readStore(key) {
  try {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getToken() {
  return readStore(TOKEN_KEY);
}

export function getUser() {
  const raw = readStore(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(getToken());
}

function emitAuthChanged() {
  window.dispatchEvent(new CustomEvent('mocan:auth-changed'));
}

export function setSession(token, user, remember = true) {
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  try {
    other.removeItem(TOKEN_KEY);
    other.removeItem(USER_KEY);
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user || null));
  } catch {
    // Storage đầy/bị chặn: phiên chỉ giữ trong bộ nhớ của tab hiện tại.
  }
  emitAuthChanged();
}

/**
 * Cập nhật một phần thông tin user đang lưu (VD: sau khi sửa hồ sơ/đổi SĐT)
 * mà KHÔNG đổi token — Header/sidebar tự cập nhật qua `mocan:auth-changed`.
 */
export function updateStoredUser(patch) {
  const current = getUser();
  if (!current || !patch) return current;
  const next = { ...current, ...patch };
  try {
    if (localStorage.getItem(USER_KEY)) {
      localStorage.setItem(USER_KEY, JSON.stringify(next));
    }
    if (sessionStorage.getItem(USER_KEY)) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(next));
    }
  } catch {
    // Bỏ qua — UI vẫn giữ state trong bộ nhớ trang hiện tại.
  }
  emitAuthChanged();
  return next;
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    // Bỏ qua — đã cố gắng xóa hết có thể.
  }
  emitAuthChanged();
}
