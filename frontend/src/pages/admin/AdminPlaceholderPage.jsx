/**
 * Trang tạm cho các màn quản lý 15–22 chưa xây dựng — giữ điều hướng
 * trong khu vực quản trị không bị văng ra trang chủ. Mỗi màn thật
 * sẽ thay thế placeholder tương ứng trong App.jsx khi hoàn thành.
 */
export default function AdminPlaceholderPage({ title }) {
  return (
    <div className="admin-card admin-placeholder">
      <div className="admin-placeholder__icon" aria-hidden="true">
        🛠️
      </div>
      <h2 className="admin-placeholder__title">{title}</h2>
      <p className="admin-placeholder__text">Màn hình đang được xây dựng.</p>
    </div>
  );
}
