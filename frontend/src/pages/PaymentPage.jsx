/**
 * Màn Thanh toán (màn 8, wave 2) — route /thanh-toan?order=NT-...
 * FR-010 · F-008 · F-009 · US-012. Ví MoMo: QR từ qrCodeUrl backend,
 * countdown giữ đơn 30 phút, poll GET /orders/{id} mỗi 4s
 * (tab ẩn 15s, quay lại tab poll ngay). Thành công dùng chung
 * OrderSuccessPage (màn 7).
 *
 * Bảo mật FE (§8 spec): không hardcode secret MoMo; QR chỉ từ qrCodeUrl
 * backend; không console.log dữ liệu MoMo; orderNumber là mã public.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCartCount } from '../hooks/useCartCount';
import { formatVND } from '../utils/format';
import { getOrder } from '../api/orderApi';
import { clearCart } from '../utils/cart';
import {
  createPayment,
  getPaymentStatus,
  cancelPayment,
  __devSimulate,
  __mockHandleExpired,
} from '../api/paymentApi';

const SUCCESS_PATH = '/dat-hang/thanh-cong';

async function copyText(text, onToast) {
  try {
    await navigator.clipboard.writeText(text);
    onToast?.('Đã sao chép mã đơn hàng.');
  } catch {
    onToast?.('Không sao chép được, bạn vui lòng ghi lại thủ công.');
  }
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function PaymentPage({ darkMode, onToggleDark, onToast }) {
  const cartCount = useCartCount();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order');
  // Dev-only (không có UI): ?simulate=success|fail|expire — chỉ tác dụng
  // khi VITE_USE_MOCK=true (guard nằm trong paymentApi).
  const simulate = searchParams.get('simulate');

  const [phase, setPhase] = useState('loading');
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [failReason, setFailReason] = useState('');
  const [checking, setChecking] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [pollError, setPollError] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /* ---------- Mount: guard + tạo payment (§6 spec) ---------- */
  const boot = useCallback(async () => {
    if (!orderNumber) {
      navigate('/gio-hang', { replace: true });
      return;
    }
    if (!localStorage.getItem('accessToken')) {
      navigate(
        `/dang-nhap?returnTo=${encodeURIComponent(`/thanh-toan?order=${orderNumber}`)}`,
        { replace: true }
      );
      return;
    }
    setPhase('loading');
    try {
      const ord = await getOrder(orderNumber);
      if (ord.status === 'ĐÃ HỦY') {
        setOrder(ord);
        setPhase('expired');
        return;
      }
      if (ord.payment?.status === 'ĐÃ THANH TOÁN' || ord.paymentMethod !== 'MOMO') {
        // Đã thanh toán rồi, hoặc user đổi ý sang COD/chuyển khoản ở màn 7:
        // đơn đã có trang thành công riêng — không thanh toán lại.
        navigate(`${SUCCESS_PATH}?order=${orderNumber}`, { replace: true });
        return;
      }
      setOrder(ord);
      const pay = await createPayment(orderNumber);
      if (simulate) {
        const adjusted = __devSimulate(orderNumber, simulate);
        if (adjusted?.expiresAt) pay.expiresAt = adjusted.expiresAt;
      }
      setPayment(pay);
      setPhase('waiting');
    } catch (e) {
      if (e?.code === 'already_paid') {
        navigate(`${SUCCESS_PATH}?order=${orderNumber}`, { replace: true });
        return;
      }
      const status = e?.response?.status;
      if (status === 403 || e?.code === 'forbidden') setPhase('forbidden');
      else if (status === 404 || e?.code === 'not_found') setPhase('not_found');
      else setPhase('create_error');
    }
  }, [orderNumber, simulate, navigate]);

  useEffect(() => {
    boot();
  }, [boot]);

  /* ---------- Countdown 30 phút (§2.4) ---------- */
  useEffect(() => {
    if (phase !== 'waiting' || !payment?.expiresAt) return;
    const target = new Date(payment.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.round((target - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && phaseRef.current === 'waiting') {
        // Hết giờ: backend tự hủy đơn (§5.2); mock giả lập việc hủy ở đây.
        try {
          __mockHandleExpired(orderNumber);
        } catch {
          /* không chặn UI */
        }
        setPhase('expired');
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, payment?.expiresAt, orderNumber]);

  /* ---------- Poll trạng thái mỗi 4s (§3 spec) ---------- */
  useEffect(() => {
    if (phase !== 'waiting') return;
    let alive = true;
    let timer = null;
    const poll = async () => {
      try {
        const ord = await getOrder(orderNumber);
        if (!alive) return;
        setPollError(false);
        if (ord.status === 'ĐÃ HỦY') {
          setPhase('expired');
          return;
        }
        const ps = ord.payment?.status;
        if (ps === 'ĐÃ THANH TOÁN') {
          // Thanh toán thành công -> giỏ chỉ được xóa ở bước này (F-008, §5.2).
          clearCart();
          navigate(`${SUCCESS_PATH}?order=${orderNumber}`, { replace: true });
          return;
        }
        if (ps === 'THẤT BẠI') {
          setFailReason(ord.payment?.failReason || '');
          setPhase('failed');
        }
      } catch {
        // Mất mạng chập chờn: chỉ hiện dòng nhỏ, poll tiếp ở nền (§6).
        if (alive) setPollError(true);
      }
    };
    const start = (ms) => {
      if (timer) clearInterval(timer);
      timer = setInterval(poll, ms);
    };
    poll();
    start(4000);
    const onVisibility = () => {
      if (document.hidden) {
        start(15000);
      } else {
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
  }, [phase, orderNumber, navigate]);

  /* ---------- Nút "Tôi đã thanh toán xong" (§2.5) ---------- */
  const handleVerify = async () => {
    if (checking) return;
    setChecking(true);
    setVerifyMessage('');
    try {
      const res = await getPaymentStatus(orderNumber);
      if (res.status === 'ĐÃ THANH TOÁN') {
        clearCart();
        navigate(`${SUCCESS_PATH}?order=${orderNumber}`, { replace: true });
        return;
      }
      if (res.status === 'THẤT BẠI') {
        setFailReason('');
        setPhase('failed');
        return;
      }
      setVerifyMessage(
        'Chưa ghi nhận thanh toán. Bạn hãy hoàn tất trên app MoMo rồi thử lại.'
      );
    } catch {
      setVerifyMessage(
        'Chưa ghi nhận thanh toán. Bạn hãy hoàn tất trên app MoMo rồi thử lại.'
      );
    } finally {
      setChecking(false);
    }
  };

  /* ---------- "Tạo lại thanh toán" (thất bại, đơn vẫn MỚI) ---------- */
  const handleRecreate = async () => {
    if (recreating) return;
    setRecreating(true);
    try {
      const pay = await createPayment(orderNumber);
      setFailReason('');
      setVerifyMessage('');
      setPayment(pay);
      setPhase('waiting');
    } catch {
      onToast?.('Không tạo được yêu cầu thanh toán. Vui lòng thử lại.');
    } finally {
      setRecreating(false);
    }
  };

  /* ---------- "Hủy thanh toán" (F-009) ---------- */
  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelPayment(orderNumber);
      navigate('/gio-hang');
      onToast?.('Đã hủy thanh toán, giỏ hàng của bạn được giữ nguyên.');
    } catch (e) {
      onToast?.(
        e?.code === 'already_paid'
          ? 'Đơn hàng đã được thanh toán, không thể hủy.'
          : 'Không hủy được thanh toán. Vui lòng thử lại.'
      );
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  };

  const urgent = remaining <= 5 * 60;
  const amount = payment?.amount ?? order?.total ?? 0;

  return (
    <div className="payment-page">
      <Header
        cartCount={cartCount}
        darkMode={darkMode}
        onToggleDark={onToggleDark}
        onToast={onToast}
      />

      <main className="container payment-main">
        <nav className="checkout-breadcrumb" aria-label="Breadcrumb">
          <Link to="/gio-hang">Giỏ hàng</Link>
          <span aria-hidden="true">/</span>
          <Link to="/dat-hang">Đặt hàng</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Thanh toán</span>
        </nav>

        {/* ---------- Loading ---------- */}
        {phase === 'loading' && (
          <div className="payment-card" aria-label="Đang tải">
            <div className="skeleton payment-skeleton-qr" />
            <div className="skeleton payment-skeleton-line" />
            <div className="skeleton payment-skeleton-line payment-skeleton-line--short" />
            <p className="payment-loading-text">
              Đang tạo yêu cầu thanh toán, vui lòng không tắt trang...
            </p>
          </div>
        )}

        {/* ---------- Đang chờ thanh toán ---------- */}
        {phase === 'waiting' && (
          <div className="payment-card">
            <h2 className="payment-title">Thanh toán đơn hàng</h2>
            <button
              type="button"
              className="payment-orderno"
              title="Bấm để sao chép mã đơn"
              onClick={() => copyText(orderNumber, onToast)}
            >
              {orderNumber}
              <span className="payment-orderno__copy" aria-hidden="true">
                ⧉
              </span>
            </button>

            <div
              className={`payment-countdown${urgent ? ' payment-countdown--urgent' : ''}`}
              role="timer"
              aria-label={`Giao dịch hết hạn sau ${formatMMSS(remaining)}`}
            >
              <span aria-hidden="true">⏱</span>
              <span>
                Giao dịch hết hạn sau <strong>{formatMMSS(remaining)}</strong>
              </span>
              <span
                className="payment-countdown__info"
                title="Đơn hàng được giữ 30 phút chờ thanh toán. Quá thời gian, đơn sẽ tự hủy và tồn kho được hoàn lại."
                aria-hidden="true"
              >
                ⓘ
              </span>
            </div>

            <div className="payment-amount">
              <p className="payment-amount__label">Số tiền cần thanh toán</p>
              <p className="payment-amount__value">{formatVND(amount)}</p>
              <p className="payment-amount__sub">Ví MoMo · Đơn hàng của Mộc An</p>
            </div>

            {payment?.qrCodeUrl && (
              <div className="payment-qr">
                <img
                  src={payment.qrCodeUrl}
                  alt="Mã QR thanh toán MoMo"
                  width="240"
                  height="240"
                />
                <p className="payment-qr__caption">
                  Quét mã QR bằng app MoMo để thanh toán
                </p>
              </div>
            )}

            {payment?.deeplink && (
              <a
                href={payment.deeplink}
                className="btn btn-primary payment-deeplink"
                target="_self"
              >
                <span aria-hidden="true">📱</span> Mở app MoMo
              </a>
            )}
            <p className="payment-deeplink__hint">
              hoặc quét mã QR ở trên bằng điện thoại
            </p>

            <ol className="payment-steps">
              <li>
                <span className="payment-steps__num" aria-hidden="true">
                  1
                </span>
                Mở app MoMo trên điện thoại (hoặc bấm nút bên trên).
              </li>
              <li>
                <span className="payment-steps__num" aria-hidden="true">
                  2
                </span>
                Quét mã QR của đơn hàng.
              </li>
              <li>
                <span className="payment-steps__num" aria-hidden="true">
                  3
                </span>
                Kiểm tra số tiền {formatVND(amount)} và xác nhận thanh toán.
              </li>
            </ol>

            <button
              type="button"
              className="btn btn-secondary payment-verify"
              onClick={handleVerify}
              disabled={checking}
            >
              {checking ? 'Đang kiểm tra...' : 'Tôi đã thanh toán xong'}
            </button>
            {verifyMessage && (
              <p className="payment-note payment-note--warning" role="status">
                {verifyMessage}
              </p>
            )}

            <p className="payment-poll" role="status">
              {pollError ? (
                'Mất kết nối, đang thử lại...'
              ) : (
                <>
                  <span className="payment-poll__spinner" aria-hidden="true" />
                  Đang chờ xác nhận từ MoMo...
                </>
              )}
            </p>

            <div className="payment-cancel">
              {!confirmCancel ? (
                <button
                  type="button"
                  className="payment-cancel__link"
                  onClick={() => setConfirmCancel(true)}
                >
                  Hủy thanh toán
                </button>
              ) : (
                <div className="payment-cancel__confirm" role="alert">
                  <p>Hủy thanh toán đơn này? Tồn kho sẽ được hoàn lại.</p>
                  <div className="payment-cancel__actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setConfirmCancel(false)}
                    >
                      Giữ lại
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCancel}
                      disabled={cancelling}
                    >
                      {cancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Link to="/gio-hang" className="payment-backlink">
              ← Quay về giỏ hàng
            </Link>
          </div>
        )}

        {/* ---------- Thanh toán thất bại (§5.1) ---------- */}
        {phase === 'failed' && (
          <div className="payment-card payment-card--alert" role="alert">
            <div className="payment-alert__icon" aria-hidden="true">
              ⚠️
            </div>
            <h2 className="payment-title">Thanh toán không thành công</h2>
            <p className="payment-alert__text">
              {failReason || 'Giao dịch không được xác nhận.'} Đơn hàng của bạn
              vẫn được giữ, bạn có thể thử lại trong thời gian còn lại.
            </p>
            <button
              type="button"
              className="btn btn-primary payment-full"
              onClick={handleRecreate}
              disabled={recreating}
            >
              {recreating ? 'Đang tạo...' : 'Tạo lại thanh toán'}
            </button>
            <Link to="/dat-hang" className="btn btn-secondary payment-full">
              Chọn phương thức khác
            </Link>
            <Link to="/gio-hang" className="payment-backlink">
              ← Quay về giỏ hàng
            </Link>
          </div>
        )}

        {/* ---------- Hết hạn / đơn tự hủy (§5.2) ---------- */}
        {phase === 'expired' && (
          <div className="payment-card payment-card--alert" role="alert">
            <div className="payment-alert__icon" aria-hidden="true">
              ⏰
            </div>
            <h2 className="payment-title">Đơn hàng đã hủy do quá thời gian thanh toán</h2>
            <p className="payment-alert__text">
              Đơn được giữ 30 phút chờ thanh toán qua MoMo. Tồn kho và mã ưu đãi
              của bạn đã được hoàn lại.
            </p>
            <Link to="/gio-hang" className="btn btn-primary payment-full">
              Đặt lại đơn hàng
            </Link>
            <Link to="/" className="payment-backlink">
              Về trang chủ
            </Link>
          </div>
        )}

        {/* ---------- Guard: đơn không tồn tại ---------- */}
        {phase === 'not_found' && (
          <div className="payment-card" role="alert">
            <h2 className="payment-title">Không tìm thấy đơn hàng</h2>
            <p className="payment-alert__text">
              Mã đơn không hợp lệ hoặc đã hết hiệu lực.
            </p>
            <Link to="/" className="btn btn-primary payment-full">
              Về trang chủ
            </Link>
          </div>
        )}

        {/* ---------- Guard: đơn không thuộc user ---------- */}
        {phase === 'forbidden' && (
          <div className="payment-card" role="alert">
            <h2 className="payment-title">Không thể xem đơn hàng này</h2>
            <p className="payment-alert__text">
              Bạn không có quyền xem đơn hàng này.
            </p>
            <Link to="/" className="btn btn-primary payment-full">
              Về trang chủ
            </Link>
          </div>
        )}

        {/* ---------- Tạo payment thất bại (§6) ---------- */}
        {phase === 'create_error' && (
          <div className="payment-card payment-card--alert" role="alert">
            <h2 className="payment-title">Không tạo được yêu cầu thanh toán</h2>
            <p className="payment-alert__text">
              Có lỗi khi kết nối với MoMo. Đơn hàng của bạn vẫn được giữ nguyên,
              không mất gì.
            </p>
            <button
              type="button"
              className="btn btn-primary payment-full"
              onClick={boot}
            >
              Thử lại
            </button>
            <Link to="/gio-hang" className="payment-backlink">
              ← Quay về giỏ hàng
            </Link>
          </div>
        )}
      </main>

      <Footer onToast={onToast} />
    </div>
  );
}
