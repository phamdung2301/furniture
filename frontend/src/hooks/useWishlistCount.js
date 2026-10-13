import { useEffect, useState } from 'react';
import { getLocalWishlistCount } from '../utils/wishlist';
import { isLoggedIn } from '../utils/auth';
import { getWishlistCount } from '../api/wishlistApi';

/** Số món trong wishlist — tự cập nhật khi wishlist đổi (kể cả từ màn khác). */
export function useWishlistCount() {
  const [count, setCount] = useState(() => getLocalWishlistCount());

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (isLoggedIn()) {
        getWishlistCount()
          .then((n) => {
            if (alive) setCount(n);
          })
          .catch(() => {});
      } else {
        setCount(getLocalWishlistCount());
      }
    };
    refresh();
    window.addEventListener('mocan:wishlist-changed', refresh);
    window.addEventListener('mocan:auth-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      alive = false;
      window.removeEventListener('mocan:wishlist-changed', refresh);
      window.removeEventListener('mocan:auth-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return count;
}
