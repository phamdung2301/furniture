import { useCallback, useEffect, useState } from 'react';
import SlideOver from './SlideOver';
import ConfirmDialog from './ConfirmDialog';
import AdminModal from './AdminModal';
import OrderStatusBadge from '../OrderStatusBadge';
import OrderTimeline from '../OrderTimeline';
import { formatTimeDate, formatVND } from '../../utils/format';
import {
  confirmBankTransfer,
  getOrder,
  updateAdminNote,
  updateStatus,
} from '../../api/adminOrderApi';

/**
 * Chi tiết đơn hàng (admin) — slide-over 720px, admin-don-hang.md §3/§4.
 * Đọc + hành động rời rạc: chuyển trạng thái theo ma trận FR-012 (chỉ hiện
 * đích hợp lệ), xác nhận chuyển khoản, ghi chú nội bộ (adminNote — khách
 * không thấy). Mọi chuyển trạng thái đều qua API; lỗi 422 -> toast message
 * cụ thể từ API + tải lại chi tiết (trạng thái có thể đã bị đổi — §4.2).
 */

const METHOD_LABEL = {
  MOMO: 'Ví MoMo',
  COD: 'Thanh toán khi nhận hàng (COD)',
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
};
const METHOD_SHORT = { MOMO: 'Ví MoMo', COD: 'COD', BANK_TRANSFER: 'Chuyển khoản' };

const PAY_PILL = {
  'ĐÃ THANH TOÁN': 'is-success',
  'CHƯA THANH TOÁN': 'is-muted',
  'THẤT BẠI': 'is-error',
  'HOÀN TIỀN': 'is-refund',
};

/** Nhãn Title Case — thuật ngữ hiển thị màn 11 (không hiện enum thô). */
const PAY_LABEL = {
  'ĐÃ THANH TOÁN': 'Đã thanh toán',
  'CHƯA THANH TOÁN': 'Chưa thanh toán',
  'THẤT BẠI': 'Thất bại',
  'HOÀN TIỀN': 'Hoàn tiền',
};

const fmtArea = (v) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v ?? 0);

/** Nội dung chuyển khoản kỳ vọng — cùng công thức trang đặt hàng thành công. */
const transferContent = (orderNumber) =>
  orderNumber ? `NT${orderNumber.replace(/\D/g, '')}` : '';

function completedAtOf(order) {
  const done = [...(order.statusHistory || [])]
    .reverse()
    .find((h) => h.status === 'HOÀN THÀNH');
  return done?.at || order.createdAt;
}

export default function OrderDetailSlideOver({ orderNumber, onClose, onToast, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaved, setNoteSaved] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  // dialog: 'cancel' | 'return' | 'tracking' | 'complete' | 'bank' | null
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingNote, setTrackingNote] = useState('');
  const [trackingError, setTrackingError] = useState('');

  const load = useCallback(async () => {
    if (!orderNumber) return;
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getOrder(orderNumber);
      setDetail(data);
      setNoteDraft(data.adminNote || '');
      setNoteSaved(data.adminNote || '');
    } catch {
      setLoadError(true);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    setDetail(null);
    setDialog(null);
    if (orderNumber) load();
  }, [orderNumber, load]);

  const noteDirty = detail ? noteDraft !== noteSaved : false;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(orderNumber);
    } catch {
      /* clipboard không khả dụng — vẫn báo như các màn khác */
    }
    onToast?.('Đã sao chép mã đơn.');
  };

  /**
   * Chuyển trạng thái qua API. Thành công: toast theo hành động + cập nhật
   * slide-over và bảng. Lỗi 422: toast message cụ thể + tải lại chi tiết.
   */
  const applyStatus = async (toStatus, payload, successMessage) => {
    setBusy(true);
    try {
      const updated = await updateStatus(orderNumber, { toStatus, ...payload });
      setDetail(updated);
      setDialog(null);
      onToast?.(successMessage);
      onChanged?.();
      return true;
    } catch (e) {
      onToast?.(e?.message || 'Không thực hiện được thao tác. Vui lòng thử lại.');
      if (e?.status === 422) {
        load();
        onChanged?.();
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openReasonDialog = (type) => {
    setReason('');
    setReasonError('');
    setDialog(type);
  };

  const handleCancelConfirm = async () => {
    if (!reason.trim()) {
      setReasonError('Vui lòng nhập lý do hủy.');
      return;
    }
    await applyStatus('ĐÃ HỦY', { reason: reason.trim() }, `Đã hủy đơn ${orderNumber}.`);
  };

  const handleReturnConfirm = async () => {
    if (!reason.trim()) {
      setReasonError('Vui lòng nhập lý do hoàn trả.');
      return;
    }
    await applyStatus('HOÀN TRẢ', { reason: reason.trim() }, `Đã chuyển đơn ${orderNumber} sang Hoàn trả.`);
  };

  const handleTrackingConfirm = async () => {
    if (!trackingCode.trim()) {
      setTrackingError('Vui lòng nhập mã vận đơn.');
      return;
    }
    await applyStatus(
      'ĐANG GIAO',
      { trackingCode: trackingCode.trim(), reason: trackingNote.trim() || undefined },
      `Đơn ${orderNumber} đã chuyển sang Đang giao.`
    );
  };

  const handleComplete = () => {
    if (detail.paymentMethod === 'COD' && detail.payment?.status !== 'ĐÃ THANH TOÁN') {
      setDialog('complete');
    } else {
      applyStatus('HOÀN THÀNH', {}, `Đơn ${orderNumber} đã hoàn thành.`);
    }
  };

  const handleBankConfirm = async () => {
    setBusy(true);
    try {
      const updated = await confirmBankTransfer(orderNumber);
      setDetail(updated);
      setDialog(null);
      onToast?.(`Đã xác nhận thanh toán cho đơn ${orderNumber}.`);
      onChanged?.();
    } catch (e) {
      onToast?.(e?.message || 'Không xác nhận được thanh toán. Vui lòng thử lại.');
      if (e?.status === 422) load();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveNote = async () => {
    setNoteSaving(true);
    try {
      const updated = await updateAdminNote(orderNumber, { adminNote: noteDraft });
      setDetail(updated);
      setNoteSaved(updated.adminNote || '');
      setNoteDraft(updated.adminNote || '');
      onToast?.('Đã lưu ghi chú nội bộ.');
    } catch (e) {
      onToast?.(e?.message || 'Không lưu được ghi chú. Vui lòng thử lại.');
    } finally {
      setNoteSaving(false);
    }
  };

  /* ------------------------- Khối hành động (§4.2) ------------------------- */

  const renderActions = () => {
    if (!detail) return null;
    const { status } = detail;
    const isMomoPending =
      status === 'MỚI' &&
      detail.paymentMethod === 'MOMO' &&
      detail.payment?.status !== 'ĐÃ THANH TOÁN';
    const withinReturnWindow =
      status === 'HOÀN THÀNH' &&
      Date.now() <= new Date(completedAtOf(detail)).getTime() + 7 * 24 * 3600 * 1000;

    let buttons = null;
    if (status === 'MỚI') {
      buttons = (
        <>
          <button
            type="button" className="btn btn-primary" disabled={busy}
            onClick={() => applyStatus('ĐÃ XÁC NHẬN', {}, `Đã xác nhận đơn ${orderNumber}.`)}
          >
            Xác nhận đơn
          </button>
          <button
            type="button" className="btn btn-text order-detail__danger" disabled={busy}
            onClick={() => openReasonDialog('cancel')}
          >
            Hủy đơn
          </button>
        </>
      );
    } else if (status === 'ĐÃ XÁC NHẬN') {
      buttons = (
        <>
          <button
            type="button" className="btn btn-primary" disabled={busy}
            onClick={() => {
              setTrackingCode('');
              setTrackingNote('');
              setTrackingError('');
              setDialog('tracking');
            }}
          >
            Chuyển đang giao
          </button>
          <button
            type="button" className="btn btn-text order-detail__danger" disabled={busy}
            onClick={() => openReasonDialog('cancel')}
          >
            Hủy đơn
          </button>
        </>
      );
    } else if (status === 'ĐANG GIAO') {
      buttons = (
        <>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={handleComplete}>
            Đánh dấu hoàn thành
          </button>
          <button
            type="button" className="btn btn-text order-detail__danger" disabled={busy}
            onClick={() => openReasonDialog('return')}
          >
            Hoàn trả (khách từ chối nhận)
          </button>
        </>
      );
    } else if (status === 'HOÀN THÀNH') {
      buttons = withinReturnWindow ? (
        <button
          type="button" className="btn btn-text order-detail__danger" disabled={busy}
          onClick={() => openReasonDialog('return')}
        >
          Hoàn trả
        </button>
      ) : (
        <p className="order-detail__ended">
          Đã quá 7 ngày kể từ khi hoàn thành — không thể hoàn trả.
        </p>
      );
    } else {
      buttons = <p className="order-detail__ended">Đơn đã kết thúc — không còn thao tác trạng thái.</p>;
    }

    return (
      <section className="order-detail__actions">
        {isMomoPending ? (
          <p className="order-detail__momo-banner">
            Đơn đang chờ thanh toán qua Ví MoMo — hệ thống sẽ tự hủy sau 30 phút nếu khách
            không thanh toán.
          </p>
        ) : null}
        <div className="order-detail__action-row">{buttons}</div>
      </section>
    );
  };

  /* ------------------------------ Render ------------------------------ */

  const paidWarning = detail?.payment?.status === 'ĐÃ THANH TOÁN' && (
    <p className="order-detail__refund-warn">
      Đơn đã thanh toán {formatVND(detail.total)} qua {METHOD_SHORT[detail.paymentMethod]} —{' '}
      {dialog === 'cancel' ? 'hủy' : 'hoàn trả'} đơn sẽ cần hoàn tiền cho khách.
    </p>
  );

  return (
    <>
      <SlideOver
        open={Boolean(orderNumber)}
        title="Chi tiết đơn hàng"
        wide
        dirty={noteDirty}
        onClose={onClose}
      >
        {loading ? (
          <div className="order-detail__skeleton" aria-hidden="true">
            <div className="skeleton" style={{ height: 28, width: '55%' }} />
            <div className="skeleton" style={{ height: 90 }} />
            <div className="skeleton" style={{ height: 18, width: '80%' }} />
            <div className="skeleton" style={{ height: 18, width: '70%' }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        ) : loadError || !detail ? (
          <div className="data-table__state">
            <p>Không tải được chi tiết đơn hàng.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
              Thử lại
            </button>
          </div>
        ) : (
          <div className="order-detail">
            {/* §3.1 Header */}
            <div className="order-detail__head">
              <div className="order-detail__code-row">
                <span className="order-detail__code">{detail.orderNumber}</span>
                <button
                  type="button" className="order-detail__copy" title="Sao chép mã đơn"
                  aria-label="Sao chép mã đơn" onClick={copyCode}
                >
                  ⧉
                </button>
                <span className="order-detail__badge">
                  <OrderStatusBadge status={detail.status} />
                </span>
              </div>
              <p className="order-detail__placed">
                Đặt lúc {formatTimeDate(detail.createdAt)}
              </p>
            </div>

            {renderActions()}

            {/* §3.3 Khách hàng & địa chỉ giao (snapshot) */}
            <section className="order-detail__section">
              <h4 className="order-detail__section-title">Khách hàng & địa chỉ giao</h4>
              <div className="order-detail__grid2">
                <div>
                  <p className="order-detail__receiver-name">{detail.receiver?.name}</p>
                  <p>
                    <a href={`tel:${detail.receiver?.phone}`}>{detail.receiver?.phone}</a>
                  </p>
                  {detail.note ? (
                    <blockquote className="order-detail__customer-note">
                      <span className="order-detail__note-label">Ghi chú của khách</span>
                      {detail.note}
                    </blockquote>
                  ) : null}
                </div>
                <div>
                  <p>
                    {[detail.receiver?.detail, detail.receiver?.ward, detail.receiver?.district,
                      detail.receiver?.province].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            </section>

            {/* §3.4 Danh sách món (snapshot) */}
            <section className="order-detail__section">
              <h4 className="order-detail__section-title">Danh sách món</h4>
              <div className="order-detail__items">
                {(detail.items || []).map((it, idx) => (
                  <div className="order-detail__item" key={idx}>
                    {it.image ? (
                      <img className="order-detail__item-img" src={it.image} alt="" />
                    ) : (
                      <span className="order-detail__item-img order-detail__item-img--empty" aria-hidden="true">🪑</span>
                    )}
                    <div className="order-detail__item-meta">
                      <span className="order-detail__item-name">{it.productName}</span>
                      <span className="order-detail__item-variant">
                        <span
                          className="order-detail__dot"
                          style={{ background: it.colorHex || 'transparent' }}
                          aria-hidden="true"
                        />
                        {it.color}
                        {it.flashSaleProgramId ? (
                          <span className="order-detail__flash">Flash sale</span>
                        ) : null}
                      </span>
                      <span className="order-detail__item-sku">{it.sku}</span>
                    </div>
                    <span className="order-detail__item-price">{formatVND(it.price)}</span>
                    <span className="order-detail__item-qty">×{it.qty}</span>
                    <span className="order-detail__item-total">
                      {formatVND((it.price || 0) * (it.qty || 0))}
                    </span>
                  </div>
                ))}
              </div>
              <p className="order-detail__area">
                Tổng diện tích chiếm chỗ: {fmtArea(detail.totalAreaM2)} m²
              </p>
            </section>

            {/* §3.5 Tóm tắt tiền (snapshot) */}
            <section className="order-detail__section order-detail__money">
              <div className="order-detail__money-row">
                <span>Tạm tính</span>
                <span>{formatVND(detail.subtotal)}</span>
              </div>
              {(detail.discount || 0) > 0 ? (
                <div className="order-detail__money-row">
                  <span>
                    Giảm giá voucher{' '}
                    {detail.voucherCode ? (
                      <span className="order-detail__voucher-chip">{detail.voucherCode}</span>
                    ) : null}
                  </span>
                  <span className="order-detail__discount">−{formatVND(detail.discount)}</span>
                </div>
              ) : null}
              <div className="order-detail__money-row">
                <span>
                  Phí vận chuyển
                  <span className="order-detail__money-sub">
                    theo tổng diện tích {fmtArea(detail.totalAreaM2)} m²
                  </span>
                </span>
                {(detail.shippingFee || 0) === 0 ? (
                  <span className="order-detail__free">Miễn phí</span>
                ) : (
                  <span>{formatVND(detail.shippingFee)}</span>
                )}
              </div>
              <div className="order-detail__money-row order-detail__money-row--total">
                <span>Tổng cộng</span>
                <span>{formatVND(detail.total)}</span>
              </div>
            </section>

            {/* §3.6 Thanh toán */}
            <section className="order-detail__section">
              <h4 className="order-detail__section-title">Thanh toán</h4>
              <dl className="order-detail__pay">
                <div>
                  <dt>Phương thức</dt>
                  <dd>{METHOD_LABEL[detail.paymentMethod] || detail.paymentMethod}</dd>
                </div>
                <div>
                  <dt>Trạng thái thanh toán</dt>
                  <dd>
                    <span className={`admin-pill ${PAY_PILL[detail.payment?.status] || 'is-muted'}`}>
                      {PAY_LABEL[detail.payment?.status] || detail.payment?.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Số tiền</dt>
                  <dd>{formatVND(detail.payment?.amount ?? detail.total)}</dd>
                </div>
                <div>
                  <dt>Mã giao dịch</dt>
                  <dd className="order-detail__mono">
                    {detail.paymentMethod === 'MOMO'
                      ? detail.payment?.providerRef || '—'
                      : detail.paymentMethod === 'BANK_TRANSFER'
                        ? transferContent(detail.orderNumber)
                        : '—'}
                  </dd>
                </div>
                {detail.paymentMethod === 'BANK_TRANSFER' && detail.payment?.providerRef ? (
                  <div>
                    <dt>Mã đối soát</dt>
                    <dd className="order-detail__mono">{detail.payment.providerRef}</dd>
                  </div>
                ) : null}
                {detail.payment?.paidAt ? (
                  <div>
                    <dt>Thời gian thanh toán</dt>
                    <dd>{formatTimeDate(detail.payment.paidAt)}</dd>
                  </div>
                ) : null}
              </dl>
              {detail.paymentMethod === 'BANK_TRANSFER'
              && detail.payment?.status === 'CHƯA THANH TOÁN' ? (
                <button
                  type="button" className="btn btn-secondary btn-sm" disabled={busy}
                  onClick={() => setDialog('bank')}
                >
                  Xác nhận đã nhận chuyển khoản
                </button>
              ) : null}
            </section>

            {/* §3.7 Timeline */}
            <section className="order-detail__section">
              <h4 className="order-detail__section-title">Tiến trình đơn hàng</h4>
              <OrderTimeline order={detail} adminView />
            </section>

            {/* §3.8 Ghi chú nội bộ */}
            <section className="order-detail__section">
              <h4 className="order-detail__section-title">Ghi chú nội bộ</h4>
              <p className="order-detail__note-hint">
                Chỉ quản trị viên thấy — khách hàng không thấy ghi chú này.
              </p>
              <textarea
                className="order-detail__note-input"
                rows={3}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="VD: Khách hẹn giao sau 18h, gọi trước 30 phút…"
                aria-label="Ghi chú nội bộ"
              />
              <button
                type="button" className="btn btn-secondary btn-sm"
                disabled={!noteDirty || noteSaving}
                onClick={handleSaveNote}
              >
                {noteSaving ? 'Đang lưu…' : 'Lưu ghi chú'}
              </button>
            </section>
          </div>
        )}
      </SlideOver>

      {/* §4.3 Hủy đơn — lý do bắt buộc */}
      <ConfirmDialog
        open={dialog === 'cancel'}
        title={`Hủy đơn ${orderNumber}?`}
        confirmLabel="Xác nhận hủy đơn"
        cancelLabel="Quay lại"
        loading={busy}
        onCancel={() => setDialog(null)}
        onConfirm={handleCancelConfirm}
      >
        <p>
          Đơn sẽ chuyển sang Đã hủy. Tồn kho của {detail?.items?.length || 0} loại sản phẩm
          được hoàn lại, lượt dùng voucher (nếu có) và suất flash sale (nếu có) được hoàn.
          Thao tác này không thể hoàn tác.
        </p>
        {paidWarning}
        <label className="order-detail__field">
          <span>Lý do hủy đơn *</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError('');
            }}
            placeholder="Lý do hủy đơn (khách hàng sẽ thấy lý do này)"
            aria-label="Lý do hủy đơn"
          />
          {reasonError ? <span className="order-detail__field-error">{reasonError}</span> : null}
        </label>
      </ConfirmDialog>

      {/* §4.6 Hoàn trả — lý do bắt buộc, không tự hoàn kho */}
      <ConfirmDialog
        open={dialog === 'return'}
        title={`Hoàn trả đơn ${orderNumber}?`}
        confirmLabel="Xác nhận hoàn trả"
        cancelLabel="Quay lại"
        loading={busy}
        onCancel={() => setDialog(null)}
        onConfirm={handleReturnConfirm}
      >
        <p>
          Đơn chuyển sang Hoàn trả. Hàng hoàn về sẽ được kiểm tra trước khi nhập lại kho —
          tồn kho không tự cộng lại ngay khi hoàn trả.
        </p>
        {paidWarning}
        <label className="order-detail__field">
          <span>Lý do hoàn trả *</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError('');
            }}
            placeholder="Lý do hoàn trả (khách hàng sẽ thấy lý do này)"
            aria-label="Lý do hoàn trả"
          />
          {reasonError ? <span className="order-detail__field-error">{reasonError}</span> : null}
        </label>
      </ConfirmDialog>

      {/* §4.4 Chuyển ĐANG GIAO — bắt buộc mã vận đơn */}
      <AdminModal
        open={dialog === 'tracking'}
        title="Chuyển đang giao"
        onClose={busy ? undefined : () => setDialog(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)} disabled={busy}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={handleTrackingConfirm} disabled={busy}>
              {busy ? 'Đang xử lý…' : 'Xác nhận đang giao'}
            </button>
          </>
        }
      >
        <label className="order-detail__field">
          <span>Mã vận đơn *</span>
          <input
            type="text"
            value={trackingCode}
            onChange={(e) => {
              setTrackingCode(e.target.value);
              setTrackingError('');
            }}
            placeholder="VD: GHN123456789"
            aria-label="Mã vận đơn"
          />
          {trackingError ? <span className="order-detail__field-error">{trackingError}</span> : null}
        </label>
        <label className="order-detail__field">
          <span>Ghi chú (tùy chọn)</span>
          <input
            type="text"
            value={trackingNote}
            onChange={(e) => setTrackingNote(e.target.value)}
            placeholder="Ghi chú cho mốc đang giao (khách hàng sẽ thấy)"
            aria-label="Ghi chú đang giao"
          />
        </label>
      </AdminModal>

      {/* §4.5 COD: xác nhận đã giao + đã thu tiền */}
      <AdminModal
        open={dialog === 'complete'}
        title="Đánh dấu hoàn thành?"
        onClose={busy ? undefined : () => setDialog(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)} disabled={busy}>
              Quay lại
            </button>
            <button
              type="button" className="btn btn-primary" disabled={busy}
              onClick={() => applyStatus('HOÀN THÀNH', {}, `Đơn ${orderNumber} đã hoàn thành.`)}
            >
              {busy ? 'Đang xử lý…' : 'Đã giao & đã thu tiền'}
            </button>
          </>
        }
      >
        <p>
          Xác nhận đã giao thành công và đã thu {formatVND(detail?.total)} tiền mặt từ khách?
        </p>
      </AdminModal>

      {/* §3.6 Xác nhận đã nhận chuyển khoản */}
      <AdminModal
        open={dialog === 'bank'}
        title="Xác nhận đã nhận chuyển khoản?"
        onClose={busy ? undefined : () => setDialog(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)} disabled={busy}>
              Quay lại
            </button>
            <button type="button" className="btn btn-primary" onClick={handleBankConfirm} disabled={busy}>
              {busy ? 'Đang xử lý…' : 'Xác nhận đã nhận'}
            </button>
          </>
        }
      >
        <p>
          Xác nhận shop đã nhận {formatVND(detail?.payment?.amount ?? detail?.total)} chuyển
          khoản cho đơn <strong>{orderNumber}</strong> (nội dung chuyển khoản{' '}
          {transferContent(orderNumber || '')}). Trạng thái đơn hàng không thay đổi.
        </p>
      </AdminModal>
    </>
  );
}
