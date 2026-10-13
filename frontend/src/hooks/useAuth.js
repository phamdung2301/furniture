import { useCallback, useEffect, useState } from 'react';
import { getUser, isLoggedIn, clearSession } from '../utils/auth';

/**
 * Đọc trạng thái đăng nhập, cập nhật realtime khi phiên đổi
 * (kể cả từ màn/tab khác qua event `mocan:auth-changed`).
 */
export function useAuth() {
  const [user, setUser] = useState(() => getUser());
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());

  useEffect(() => {
    const refresh = () => {
      setUser(getUser());
      setLoggedIn(isLoggedIn());
    };
    window.addEventListener('mocan:auth-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('mocan:auth-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, []);

  return { user, isLoggedIn: loggedIn, logout };
}
