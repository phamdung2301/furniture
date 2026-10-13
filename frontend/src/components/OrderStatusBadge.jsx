/**
 * Badge trạng thái đơn hàng — theo-doi-don.md §4 (6 trạng thái, màu nhất
 * quán toàn site). Bọc component Badge có sẵn, chỉ thêm variant màu
 * trong orders.css (.badge-status-*).
 */
import Badge from './Badge';

const TYPE_BY_STATUS = {
  'MỚI': 'status-moi',
  'ĐÃ XÁC NHẬN': 'status-xac-nhan',
  'ĐANG GIAO': 'status-dang-giao',
  'HOÀN THÀNH': 'status-hoan-thanh',
  'ĐÃ HỦY': 'status-da-huy',
  'HOÀN TRẢ': 'status-hoan-tra',
};

export default function OrderStatusBadge({ status }) {
  if (!status) return null;
  return <Badge type={TYPE_BY_STATUS[status] || 'status-da-huy'} label={status} />;
}
