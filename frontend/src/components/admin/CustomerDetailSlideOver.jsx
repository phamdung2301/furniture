import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SlideOver from './SlideOver';
import CustomerAccountBadge from './CustomerAccountBadge';
import CustomerLockDialog from './CustomerLockDialog';
import OrderStatusBadge from '../OrderStatusBadge';
import { getCustomer, unlockCustomer } from '../../api/adminCustomerApi';
import { formatPhoneVN, formatVND } from '../../utils/format';

/**
 * Chi tiết khách hàng (admin) — slide-over 640px, admin-khach-hang.md §3.
 * Chỉ XEM: hồ sơ + địa chỉ (không nút sửa/xóa) + tổng quan mua hàng + 5 đơn
 * gần nhất. Hành động duy nhất: Khóa / Mở khóa tài khoản (§4) — đồng bộ
 * ngược ra bảng qua onChanged(updatedRow). KHÔNG có nút xóa khách (§4.6).
 * Click 1 đơn → /admin/don-hang?ma-don=... (màn 17 tự mở đúng đơn — §3.5).
 */

const pad2 = (n) => String(n).padStart(2, '0');

/** "HH:mm dd/MM/yyyy" — §3.3 ngày đăng ký. */
function formatTimeDateFull(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(
    d.getMonth() + 1
  )}/${d.getFullYear()}`;
}

/** "dd/MM/yyyy" — §3.5 ngày đặt của đơn gần nhất. */
function formatDateOnly(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function CustomerDetailSlideOver({ customerId, onClose, onToast, onChanged }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setLoadError(false);
    try {
      setDetail(await getCustomer(customerId));
    } catch {
      setLoadError(true);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    setDetail(null);
    setLockOpen(false);
    if (customerId) load();
  }, [customerId, load]);

  /* ------------------------- Khóa / mở khóa (§4) ------------------------- */

  const handleLocked = (updatedRow) => {
    onChanged?.(updatedRow);
    load(); // tải lại chi tiết để hiện lý do khóa vừa lưu (§3.3)
  };

  // Mở khóa: làm ngay, không confirm (§4.5) — chỉ đổi giao diện sau khi API xác nhận.
  const handleUnlock = async () => {
    if (!detail) return;
    setUnlocking(true);
    try {
      const updated = await unlockCustomer(detail.id);
      onChanged?.(updated);
      onToast?.(`Đã mở khóa tài khoản của ${detail.fullName}.`);
      load();
    } catch (e) {
      onToast?.(e?.message || 'Không mở khóa được tài khoản. Vui lòng thử lại.');
    } finally {
      setUnlocking(false);
    }
  };

  /* ------------------------------ Điều hướng đơn ------------------------------ */

  const openOrder = (orderNumber) => {
    onClose?.();
    navigate(`/admin/don-hang?ma-don=${orderNumber}`);
  };

  const copyOrderCode = async (e, orderNumber) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(orderNumber);
    } catch {
      /* clipboard không khả dụng */
    }
    onToast?.('Đã sao chép mã đơn.');
  };

  /* ------------------------------ Render ------------------------------ */

  const stats = detail?.stats;
  const chips = stats
    ? [
        { label: 'Hoàn thành', n: stats.countByStatus?.completed || 0 },
        { label: 'Đang xử lý', n: stats.countByStatus?.processing || 0 },
        { label: 'Đã hủy', n: stats.countByStatus?.cancelled || 0 },
        { label: 'Hoàn trả', n: stats.countByStatus?.returned || 0 },
      ].filter((c) => c.n > 0)
    : [];

  const isLocked = detail?.status === 'LOCKED';

  return (
    <>
      <SlideOver
        open={Boolean(customerId)}
        title="Chi tiết khách hàng"
        panelClassName="admin-slideover--customer"
        onClose={onClose}
      >
        {loading ? (
          <div className="customer-detail__skeleton" aria-hidden="true">
            <div className="skeleton" style={{ height: 56, width: '70%' }} />
            <div className="skeleton" style={{ height: 84 }} />
            <div className="skeleton" style={{ height: 18, width: '85%' }} />
            <div className="skeleton" style={{ height: 18, width: '75%' }} />
            <div className="skeleton" style={{ height: 18, width: '80%' }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        ) : loadError || !detail ? (
          <div className="data-table__state">
            <p>Không tải được thông tin khách hàng.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
              Thử lại
            </button>
          </div>
        ) : (
          <div className="customer-detail">
            {/* §3.1 Đầu slide-over */}
            <div className="customer-detail__head">
              {detail.avatarUrl ? (
                <img
                  className="customer-avatar customer-avatar--lg"
                  src={detail.avatarUrl}
                  alt=""
                />
              ) : (
                <span className="customer-avatar customer-avatar--lg" aria-hidden="true">
                  {(detail.fullName || '?').trim().charAt(0)}
                </span>
              )}
              <div className="customer-detail__head-meta">
                <h4 className="customer-detail__name">{detail.fullName}</h4>
                <p className="customer-detail__phone">{formatPhoneVN(detail.phone)}</p>
                <div className="customer-detail__badges">
                  <CustomerAccountBadge customer={detail} />
                  <span
                    className={`customer-badge ${
                      detail.phoneVerified ? 'is-verified' : 'is-unverified'
                    }`}
                  >
                    {detail.phoneVerified
                      ? 'Đã xác thực SĐT'
                      : 'Chưa xác thực SĐT'}
                  </span>
                </div>
              </div>
              {isLocked ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm customer-detail__action"
                  onClick={handleUnlock}
                  disabled={unlocking}
                >
                  {unlocking ? 'Đang xử lý…' : 'Mở khóa tài khoản'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm customer-detail__lock-btn"
                  onClick={() => setLockOpen(true)}
                >
                  Khóa tài khoản
                </button>
              )}
            </div>

            {/* §3.2 Tổng quan mua hàng */}
            <section className="customer-detail__section">
              <div className="customer-stats">
                <div className="customer-stats__box">
                  <span className="customer-stats__value">{stats?.orderCount ?? 0}</span>
                  <span className="customer-stats__label">Số đơn đã đặt</span>
                </div>
                <div className="customer-stats__box">
                  <span className="customer-stats__value">
                    {formatVND(stats?.totalSpent ?? 0)}
                  </span>
                  <span className="customer-stats__label">Tổng chi tiêu</span>
                  <span className="customer-stats__sub">
                    từ {stats?.completedOrderCount ?? 0} đơn hoàn thành
                  </span>
                </div>
                <div className="customer-stats__box">
                  {stats?.lastOrder ? (
                    <>
                      <button
                        type="button"
                        className="customer-stats__order"
                        onClick={() => openOrder(stats.lastOrder.orderNumber)}
                      >
                        {stats.lastOrder.orderNumber}
                      </button>
                      <span className="customer-stats__label">
                        Đơn gần nhất · {formatDateOnly(stats.lastOrder.createdAt)}
                      </span>
                      <span>
                        <OrderStatusBadge status={stats.lastOrder.status} />
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="customer-stats__value">—</span>
                      <span className="customer-stats__label">Đơn gần nhất</span>
                    </>
                  )}
                </div>
              </div>
              {chips.length > 0 ? (
                <div className="customer-chips">
                  {chips.map((c) => (
                    <span key={c.label} className="customer-chip">
                      {c.label} {c.n}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            {/* §3.3 Thông tin hồ sơ */}
            <section className="customer-detail__section">
              <h4 className="customer-detail__section-title">Thông tin hồ sơ</h4>
              <dl className="customer-profile">
                <div>
                  <dt>Họ tên</dt>
                  <dd>{detail.fullName}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{detail.email}</dd>
                </div>
                <div>
                  <dt>Số điện thoại</dt>
                  <dd>
                    {formatPhoneVN(detail.phone)}{' '}
                    <span
                      className={`customer-badge ${
                        detail.phoneVerified ? 'is-verified' : 'is-unverified'
                      }`}
                    >
                      {detail.phoneVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Ngày đăng ký</dt>
                  <dd>{formatTimeDateFull(detail.createdAt)}</dd>
                </div>
                <div>
                  <dt>Cách đăng nhập</dt>
                  <dd>{detail.hasPassword ? 'Email và mật khẩu' : 'Google'}</dd>
                </div>
                {detail.lockSource === 'AUTO' ? (
                  <>
                    <div>
                      <dt>Lý do trạng thái</dt>
                      <dd>
                        Nhập sai mật khẩu nhiều lần — tự mở lúc{' '}
                        {formatTimeDateFull(detail.lockedUntil)}
                      </dd>
                    </div>
                    {detail.failedLoginAttempts > 0 ? (
                      <div>
                        <dt>Số lần đăng nhập sai gần nhất</dt>
                        <dd>{detail.failedLoginAttempts}</dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {detail.lockSource === 'ADMIN' ? (
                  <div>
                    <dt>Lý do trạng thái</dt>
                    <dd>
                      Bị khóa bởi quản trị viên
                      {detail.lockReason ? <> — {detail.lockReason}</> : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {/* §3.4 Địa chỉ giao hàng (chỉ xem) */}
            <section className="customer-detail__section">
              <h4 className="customer-detail__section-title">Địa chỉ giao hàng</h4>
              {(detail.addresses || []).length === 0 ? (
                <p className="customer-detail__muted">Khách hàng chưa lưu địa chỉ nào.</p>
              ) : (
                <div className="customer-addresses">
                  {detail.addresses.map((a, idx) => (
                    <div className="customer-address" key={idx}>
                      <p className="customer-address__head">
                        <span className="customer-address__label">{a.label}</span>
                        {a.isDefault ? (
                          <span className="customer-badge is-default">Mặc định</span>
                        ) : null}
                      </p>
                      <p className="customer-address__receiver">
                        {a.receiverName} · {a.phone}
                      </p>
                      <p className="customer-address__full">
                        {a.fullAddress ||
                          [a.detail, a.ward, a.district, a.province]
                            .filter(Boolean)
                            .join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* §3.5 Lịch sử đơn hàng gần đây */}
            <section className="customer-detail__section">
              <h4 className="customer-detail__section-title">Lịch sử đơn hàng gần đây</h4>
              {(detail.recentOrders || []).length === 0 ? (
                <p className="customer-detail__muted">Khách hàng chưa có đơn hàng nào.</p>
              ) : (
                <>
                  <div className="customer-orders__scroll">
                    <table className="customer-orders">
                      <thead>
                        <tr>
                          <th>Mã đơn</th>
                          <th>Ngày đặt</th>
                          <th>Số món</th>
                          <th className="is-right">Tổng tiền</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.recentOrders.map((o) => (
                          <tr
                            key={o.orderNumber}
                            className="is-clickable"
                            onClick={() => openOrder(o.orderNumber)}
                          >
                            <td>
                              <span className="customer-orders__code-wrap">
                                <span className="customer-orders__code">
                                  {o.orderNumber}
                                </span>
                                <button
                                  type="button"
                                  className="orders-cell__copy"
                                  title="Sao chép mã đơn"
                                  aria-label={`Sao chép mã đơn ${o.orderNumber}`}
                                  onClick={(e) => copyOrderCode(e, o.orderNumber)}
                                >
                                  ⧉
                                </button>
                              </span>
                            </td>
                            <td>{formatDateOnly(o.createdAt)}</td>
                            <td>{o.itemCount}</td>
                            <td className="is-right customer-orders__total">
                              {formatVND(o.total)}
                            </td>
                            <td>
                              <OrderStatusBadge status={o.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className="customer-detail__all-orders"
                    onClick={() => {
                      onClose?.();
                      navigate(`/admin/don-hang?khach=${detail.id}`);
                    }}
                  >
                    Xem tất cả đơn của khách hàng này →
                  </button>
                </>
              )}
            </section>
          </div>
        )}
      </SlideOver>

      <CustomerLockDialog
        customer={lockOpen && detail ? detail : null}
        onClose={() => setLockOpen(false)}
        onLocked={handleLocked}
        onToast={onToast}
      />
    </>
  );
}
