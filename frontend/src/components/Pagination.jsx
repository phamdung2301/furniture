/**
 * Phân trang — §0 spec: nút số bo 10px, trang hiện tại nền brand-700 chữ trắng.
 * Đổi trang → parent scroll về đầu grid + cập nhật page trong URL.
 */
function pageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set([1, 2, page - 1, page, page + 1, totalPages - 1, totalPages]);
  const nums = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  nums.forEach((n) => {
    if (n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  });
  return out;
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Phân trang sản phẩm">
      <button
        type="button"
        className="page-btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Trang trước"
      >
        ‹
      </button>
      {pageList(page, totalPages).map((n, i) =>
        n === '…' ? (
          <span key={`gap-${i}`} className="page-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className={`page-btn${n === page ? ' page-btn--active' : ''}`}
            aria-current={n === page ? 'page' : undefined}
            aria-label={`Trang ${n}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        )
      )}
      <button
        type="button"
        className="page-btn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Trang sau"
      >
        ›
      </button>
      <span className="page-compact" aria-hidden="true">
        Trang {page}/{totalPages}
      </span>
    </nav>
  );
}
