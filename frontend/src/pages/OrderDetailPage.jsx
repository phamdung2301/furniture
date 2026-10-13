/**
 * Trang chi tiết đơn hàng — route /don-hang/:orderNumber (màn 11,
 * theo-doi-don.md §3). FR-012 · FR-016 · F-009 · US-009/010/011.
 * Timeline từ statusHistory; hành động đúng trạng thái; poll 4s khi
 * đơn MoMo đang chờ thanh toán (pattern màn 8, F-008).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import OrderStatusBadge from '../components/OrderStatusBadge';
import OrderTimeline from '../components/OrderTimeline';
import Button from '../components/Button';
import { paymentMethodName } from '../components/PaymentMethodSelector';
import { useCartCount } from '../hooks/useCartCount';
import { formatVND, formatTimeDate } from '../utils/format';
import { isLoggedIn } from '../utils/auth';
import {
  getOrder,
  cancelOrder,
  reorderItems,
  __mockExpireOrder,
} from '../api/orderApi';

async function copyText(text, onToast) {
  try {
    await navigator.clipboard.writeText(text);
    onToast?.('Đã sao chép mã đơn.');
  } catch {
    onToast?.('Không sao chép được, bạn vui lòng ghi lại thủ công.');
  }
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function hhmm(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const SKIP_REASON_TEXT = {
  out_of_stock: 'hết hàng',
  discontinued: 'ngừng kinh doanh',
  not_found: 'không còn bán',
};

const PAYMENT_STATUS_UI = {
  'ĐÃ THANH TOÁN': { label: 'Đã thanh toán', cls: 'success' },
  'CHƯA THANH TOÁN': { label: 'Chưa thanh toán', cls: 'warning' },
  'THẤT BẠI': { label: 'Thất bại', cls: 'error' },
};

export default function OrderDetailPage({ darkMode, onToggleDark, onToast }) {
  const cartCount = useCartCount();
  const navigate = useNavigate();
  const { orderNumber } = useParams();

  const [phase, setPhase] = useState('loading'); // loading | ready | error | forbidden | not_found
  const [order, setOrder] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [reordering, setReordering] = useState(false);
  const paidToastShownRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate(`/dang-nhap?returnTo=/don-hang/${orderNumber}`, { replace: true });
    }
  }, [navigate, orderNumber]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setPhase('loading');
      try {
        const data = await getOrder(orderNumber);
        setOrder(data);
        setPhase('ready');
        return data;
      } catch (e) {
        if (silent) return null;
        const status = e?.response?.status;
        if (status === 403 || e?.code === 'forbidden') setPhase('forbidden');
        else if (status === 404 || e?.code === 'not_found') setPhase('not_found');
        else setPhase('error');
        return null;
      }
    },
    [orderNumber]
  );

  useEffect(() => {
    if (isLoggedIn()) load();
  }, [load]);

  const waitingPayment =
    order?.status === 'MỚI' &&
    order?.paymentMethod === 'MOMO' &&
    order?.payment?.status === 'CHƯA THANH TOÁN';

  /* ---------- Poll 4s khi chờ thanh toán MoMo (theo-doi-don.md §7) ---------- */
  useEffect(() => {
    if (phase !== 'ready' || !waitingPayment) return;
    let alive = true;
    let timer = null;
    const poll = async () => {
      const fresh = await load(true);
      if (!alive || !fresh) return;
      if (fresh.payment?.status === 'ĐÃ THANH TOÁN' && !paidToastShownRef.current) {
        paidToastShownRef.current = true;
        onToast?.('Thanh toán thành công!');
      }
    };
    const start = (ms) => {
      if (timer) clearInterval(timer);
      timer = setInterval(poll, ms);
    };
    start(4000);
    const onVisibility = () => {
      if (document.hidden) start(15000);
      else {
        poll();
        start(4000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase, waitingPayment, load, onToast]);

  /* ---------- Countdown giữ đơn (từ payment.expiresAt) ---------- */
  useEffect(() => {
    if (!waitingPayment || !order?.payment?.expiresAt) {
      setRemaining(null);
      return;
    }
    const target = new Date(order.payment.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.round((target - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        // Hết giờ: backend tự hủy (F-008); mock giả lập rồi tải lại trạng thái.
        __mockExpireOrder(orderNumber);
        load(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [waitingPayment, order?.payment?.expiresAt, orderNumber, load]);

  /* ---------- Hành động ---------- */
  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    setCancelError('');
    try {
      await cancelOrder(orderNumber, cancelReason);
      setConfirmCancel(false);
      setCancelReason('');
      await load(true);
      onToast?.('Đã hủy đơn hàng.');
    } catch (e) {
      setCancelError(
        e?.response?.data?.message ||
          e?.message ||
          'Không hủy được đơn hàng. Vui lòng thử lại.'
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleReorder = async () => {
    if (reordering) return;
    setReordering(true);
    try {
      const res = await reorderItems(orderNumber);
      const skippedText = (res.skipped || [])
        .map(
          (s) =>
            `${s.productName} (màu ${s.color}) — ${SKIP_REASON_TEXT[s.reason] || 'không thêm được'}`
        )
        .join('; ');
      if (res.added > 0) {
        onToast?.(
          `Đã thêm lại ${res.added} món vào giỏ hàng.` +
            (skippedText ? ` Bỏ qua: ${skippedText}.` : '')
        );
        navigate('/gio-hang');
      } else {
        onToast?.(
          skippedText
            ? `Chưa thêm được món nào. Bỏ qua: ${skippedText}.`
            : 'Chưa thêm được món nào vào giỏ hàng.'
        );
      }
    } catch {
      onToast?.('Không đặt lại được đơn hàng. Vui lòng thử lại.');
    } finally {
      setReordering(false);
    }
  };

  /* ---------- Chuẩn hoá dữ liệu hiển thị ---------- */
  const receiver =
    order?.receiver ||
    (order?.address
      ? {
          name: order.address.receiverName,
          phone: order.address.phone,
          line: order.address.line,
        }
      : null);
  const receiverLine =
    receiver?.line ||
    [receiver?.detail, receiver?.ward, receiver?.district, receiver?.province]
      .filter(Boolean)
      .join(', ');
  const deliveryNote = order?.note || order?.address?.note || '';
  const cancelEntry = (order?.statusHistory || []).find((h) => h.status === 'ĐÃ HỦY');
  const cancelNote = cancelEntry?.note || '';
  const cancelByTimeout = /thời gian|30 phút/i.test(cancelNote);
  const paymentUi = PAYMENT_STATUS_UI[order?.payment?.status] || null;

  return (
    <div className="orders-page">
      <Header
        cartCount={cartCount}
        darkMode={darkMode}
        onToggleDark={onToggleDark}
        onToast={onToast}
      />

      <main className="container orders-main">
        <nav className="orders-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">→</span>
          <Link to="/don-hang">Đơn hàng của tôi</Link>
          <span aria-hidden="true">→</span>
          <span aria-current="page">{orderNumber}</span>
        </nav>

        {phase === 'loading' && (
          <div aria-label="Đang tải">
            <div className="skeleton" style={{ height: 28, width: '40%', marginBottom: 16 }} />
            <div className="order-detail__grid">
              <div>
                <div className="skeleton" style={{ height: 260, marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 160 }} />
              </div>
              <div className="skeleton" style={{ height: 300 }} />
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="orders-state" role="alert">
            <h2>Có lỗi xảy ra, vui lòng thử lại.</h2>
            <Button variant="secondary" onClick={() => load()}>
              Thử lại
            </Button>
          </div>
        )}

        {phase === 'forbidden' && (
          <div className="orders-state" role="alert">
            <h2>Bạn không có quyền xem đơn hàng này.</h2>
            <Button variant="primary" onClick={() => navigate('/don-hang')}>
              Về trang đơn hàng
            </Button>
          </div>
        )}

        {phase === 'not_found' && (
          <div className="orders-state" role="alert">
            <h2>Không tìm thấy đơn hàng.</h2>
            <Button variant="primary" onClick={() => navigate('/don-hang')}>
              Về trang đơn hàng
            </Button>
          </div>
        )}

        {phase === 'ready' && order && (
          <>
            <div className="order-detail__head">
              <div>
                <button
                  type="button"
                  className="order-detail__no"
                  title="Bấm để sao chép mã đơn"
                  onClick={() => copyText(order.orderNumber, onToast)}
                >
                  {order.orderNumber}
                  <span aria-hidden="true">⧉</span>
                </button>
                <p className="order-detail__placed">
                  Đặt lúc {formatTimeDate(order.createdAt)}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            {waitingPayment && (
              <div className="order-banner order-banner--warning" role="status">
                <p>
                  Đơn hàng đang chờ thanh toán
                  {remaining !== null && (
                    <>
                      {' '}
                      — sẽ tự hủy sau <strong>{formatMMSS(remaining)}</strong>
                    </>
                  )}
                  .
                </p>
                <p className="order-banner__poll">
                  <span className="payment-poll__spinner" aria-hidden="true" />
                  Đang chờ xác nhận từ MoMo...
                </p>
              </div>
            )}

            {order.status === 'ĐÃ HỦY' && cancelByTimeout && (
              <div className="order-banner order-banner--error" role="alert">
                Đơn đã hủy do quá thời gian thanh toán.
              </div>
            )}
            {order.status === 'ĐÃ HỦY' && !cancelByTimeout && cancelEntry && (
              <div className="order-banner order-banner--error" role="alert">
                Bạn đã hủy đơn hàng lúc {hhmm(cancelEntry.at)}
                {cancelNote && cancelNote !== 'Bạn đã hủy đơn' ? ` — ${cancelNote}` : ''}.
              </div>
            )}

            <div className="order-detail__grid">
              <div className="order-detail__left">
                <section className="order-cardbox" aria-label="Tiến trình đơn hàng">
                  <OrderTimeline order={order} />
                </section>

                <section className="order-cardbox" aria-label="Sản phẩm trong đơn">
                  <h2 className="order-cardbox__title">Sản phẩm trong đơn</h2>
                  <ul className="order-items">
                    {(order.items || []).map((item, idx) => (
                      <li key={idx} className="order-item">
                        <img
                          src={item.image}
                          alt={item.productName || ''}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                        <div className="order-item__info">
                          <p className="order-item__name">{item.productName}</p>
                          <p className="order-item__meta">
                            {item.colorHex && (
                              <span
                                className="color-dot"
                                style={{ background: item.colorHex }}
                                aria-hidden="true"
                              />
                            )}
                            Màu: {item.color} · ×{item.qty} · {formatVND(item.price)}
                          </p>
                        </div>
                        <div className="order-item__right">
                          <p className="order-item__linetotal">
                            {formatVND((item.price || 0) * (item.qty || 0))}
                          </p>
                          {order.status === 'HOÀN THÀNH' &&
                            (item.reviewed ? (
                              <span className="order-item__reviewed">Đã đánh giá ✓</span>
                            ) : item.productSlug ? (
                              <Link
                                className="btn btn-text order-item__review"
                                to={`/san-pham/${item.productSlug}?review=open`}
                              >
                                Đánh giá
                              </Link>
                            ) : null)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                {receiver && (
                  <section className="order-cardbox" aria-label="Thông tin nhận hàng">
                    <h2 className="order-cardbox__title">Thông tin nhận hàng</h2>
                    <p className="order-receiver__name">
                      {receiver.name} · {receiver.phone}
                    </p>
                    <p className="order-receiver__line">{receiverLine}</p>
                    {deliveryNote && (
                      <p className="order-receiver__note">Ghi chú: {deliveryNote}</p>
                    )}
                  </section>
                )}
              </div>

              <aside className="order-detail__right">
                <section className="order-cardbox" aria-label="Tóm tắt đơn hàng">
                  <h2 className="order-cardbox__title">Tóm tắt đơn hàng</h2>
                  <dl className="order-summary">
                    <div>
                      <dt>Tạm tính</dt>
                      <dd>{formatVND(order.subtotal)}</dd>
                    </div>
                    {(order.discount || 0) > 0 && (
                      <div>
                        <dt>
                          Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ''}
                        </dt>
                        <dd className="order-summary__discount">
                          −{formatVND(order.discount)}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Phí vận chuyển</dt>
                      <dd>
                        {(order.shippingFee || 0) === 0 ? (
                          <span className="order-summary__free">Miễn phí</span>
                        ) : (
                          formatVND(order.shippingFee)
                        )}
                      </dd>
                    </div>
                    <div className="order-summary__total">
                      <dt>Tổng cộng</dt>
                      <dd>{formatVND(order.total)}</dd>
                    </div>
                  </dl>
                </section>

                <section className="order-cardbox" aria-label="Thanh toán">
                  <h2 className="order-cardbox__title">Thanh toán</h2>
                  <p className="order-payment__method">
                    {paymentMethodName(order.paymentMethod)}
                  </p>
                  {paymentUi && (
                    <p>
                      <span className={`pay-status pay-status--${paymentUi.cls}`}>
                        {paymentUi.label}
                      </span>
                    </p>
                  )}
                  {order.paymentMethod === 'MOMO' &&
                    order.payment?.status === 'ĐÃ THANH TOÁN' && (
                      <p className="order-payment__paid">
                        Đã thanh toán {formatVND(order.total)} qua Ví MoMo
                        {order.payment?.paidAt ? ` lúc ${hhmm(order.payment.paidAt)}` : ''}.
                      </p>
                    )}
                </section>

                <section className="order-cardbox order-actions" aria-label="Hành động">
                  {waitingPayment && (
                    <Link
                      to={`/thanh-toan?order=${order.orderNumber}`}
                      className="btn btn-primary order-actions__full"
                    >
                      Thanh toán ngay
                    </Link>
                  )}

                  {order.status === 'MỚI' && !confirmCancel && (
                    <button
                      type="button"
                      className="order-actions__danger"
                      onClick={() => setConfirmCancel(true)}
                    >
                      Hủy đơn
                    </button>
                  )}

                  {order.status === 'MỚI' && confirmCancel && (
                    <div className="order-cancel" role="alert">
                      <label className="order-cancel__label" htmlFor="cancel-reason">
                        Bạn có chắc muốn hủy đơn này? Tồn kho và mã ưu đãi sẽ được
                        hoàn lại.
                      </label>
                      <textarea
                        id="cancel-reason"
                        className="order-cancel__input"
                        rows={2}
                        placeholder="Lý do hủy (không bắt buộc)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                      />
                      {cancelError && (
                        <p className="order-cancel__error">{cancelError}</p>
                      )}
                      <div className="order-cancel__buttons">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setConfirmCancel(false)}
                        >
                          Giữ lại đơn
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleCancel}
                          disabled={cancelling}
                        >
                          {cancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
                        </button>
                      </div>
                    </div>
                  )}

                  {order.status === 'ĐÃ HỦY' && (
                    <button
                      type="button"
                      className="btn btn-secondary order-actions__full"
                      onClick={handleReorder}
                      disabled={reordering}
                    >
                      {reordering ? 'Đang thêm vào giỏ...' : 'Đặt lại đơn hàng'}
                    </button>
                  )}

                  {(order.status === 'ĐÃ XÁC NHẬN' || order.status === 'ĐANG GIAO') && (
                    <a href="tel:19006868" className="btn btn-text order-actions__contact">
                      Liên hệ shop — 1900 6868
                    </a>
                  )}

                  <Link to="/don-hang" className="order-actions__back">
                    ← Về danh sách đơn hàng
                  </Link>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>

      <Footer onToast={onToast} />
    </div>
  );
}
