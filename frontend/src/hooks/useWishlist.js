import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { isWishedLocal, addWish, removeWish } from '../utils/wishlist';
import { defaultVariant } from '../api/productApi';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from '../api/wishlistApi';

/**
 * Hook toggle wishlist cho 1 sản phẩm — §2 spec.
 * useWishlist(productId, product, onToast?) -> { wished, toggle, busy }
 * - Guest: lưu localStorage (utils/wishlist).
 * - Đã login: gọi API (api/wishlistApi), 409 coi như đã lưu.
 * - Optimistic toggle ngay + toast; lỗi -> rollback + toast đỏ.
 * - wished đồng bộ realtime qua event `mocan:wishlist-changed`
 *   (bỏ qua trong lúc chính hook này đang toggle để tránh nháy).
 */
export function useWishlist(productId, product, onToast) {
  const { isLoggedIn } = useAuth();
  const [wished, setWished] = useState(() => !isLoggedIn && isWishedLocal(productId));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const wishedRef = useRef(wished);
  useEffect(() => {
    wishedRef.current = wished;
  }, [wished]);

  const resolveWished = useCallback(async () => {
    if (!productId) return;
    if (!isLoggedIn) {
      setWished(isWishedLocal(productId));
      return;
    }
    try {
      const items = await getWishlist();
      setWished((items || []).some((i) => i.productId === productId));
    } catch {
      // Giữ trạng thái hiện tại khi lỗi mạng.
    }
  }, [productId, isLoggedIn]);

  // Resolve lần đầu + khi đổi sản phẩm / đổi trạng thái đăng nhập.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!productId) return;
      if (!isLoggedIn) {
        if (alive) setWished(isWishedLocal(productId));
        return;
      }
      try {
        const items = await getWishlist();
        if (alive) setWished((items || []).some((i) => i.productId === productId));
      } catch {
        // Giữ trạng thái hiện tại khi lỗi mạng.
      }
    })();
    return () => {
      alive = false;
    };
  }, [productId, isLoggedIn]);

  // Realtime: wishlist đổi ở nơi khác -> resolve lại (trừ lúc chính mình đang toggle).
  useEffect(() => {
    const refresh = () => {
      if (busyRef.current) return;
      resolveWished();
    };
    window.addEventListener('mocan:wishlist-changed', refresh);
    return () => window.removeEventListener('mocan:wishlist-changed', refresh);
  }, [resolveWished]);

  const toggle = useCallback(async () => {
    if (!productId || busyRef.current) return;
    const adding = !wishedRef.current;
    busyRef.current = true;
    setBusy(true);
    wishedRef.current = adding;
    setWished(adding);
    onToast?.(
      adding ? 'Đã thêm vào danh sách yêu thích.' : 'Đã bỏ khỏi danh sách yêu thích.'
    );
    try {
      if (!isLoggedIn) {
        if (adding) {
          addWish({
            productId,
            slug: product?.slug,
            name: product?.name,
            image: product?.images?.[0]?.url || null,
            priceAtSave: defaultVariant(product)?.price ?? null,
            addedAt: new Date().toISOString(),
          });
        } else {
          removeWish(productId);
        }
      } else if (adding) {
        await addToWishlist(productId, defaultVariant(product)?.price ?? null);
      } else {
        await removeFromWishlist(productId);
      }
    } catch {
      // Rollback + toast đỏ (spec §2.2).
      wishedRef.current = !adding;
      setWished(!adding);
      onToast?.('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [productId, product, isLoggedIn, onToast]);

  return { wished, toggle, busy };
}
