import { useEffect, useRef } from 'react';

/**
 * Scroll reveal — §4 spec: fade-up 1 lần qua IntersectionObserver,
 * tôn trọng prefers-reduced-motion (xử lý bằng CSS).
 */
export default function useRevealRoot() {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return ref;
}
