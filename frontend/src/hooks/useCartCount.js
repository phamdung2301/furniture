import { useEffect, useState } from 'react';
import { getCartCount } from '../utils/cart';

/** Số lượng SP trong giỏ — tự cập nhật khi giỏ đổi (kể cả từ màn khác). */
export function useCartCount() {
  const [count, setCount] = useState(() => getCartCount());
  useEffect(() => {
    const refresh = () => setCount(getCartCount());
    window.addEventListener('mocan:cart-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('mocan:cart-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return count;
}
