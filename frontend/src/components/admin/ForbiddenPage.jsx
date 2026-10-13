import { Link } from 'react-router-dom';

/**
 * Trang 403 khu vực quản trị — admin-dashboard.md §A.4:
 * đã đăng nhập nhưng role != ADMIN. Không lộ menu admin.
 */
export default function ForbiddenPage() {
  return (
    <div className="forbidden-page">
      <div className="forbidden-page__card">
        <div className="forbidden-page__icon" aria-hidden="true">
          🔒
        </div>
        <h1 className="forbidden-page__title">Không có quyền truy cập</h1>
        <p className="forbidden-page__text">
          Bạn không có quyền truy cập khu vực quản trị.
        </p>
        <Link to="/" className="btn btn-primary">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
