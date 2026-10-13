/**
 * Trang đặt hàng thành công — route /dat-hang/thanh-cong?order=NT-...
 * US-007 · F-008. COD/Chuyển khoản: hiện mã đơn (copy được) + tóm tắt.
 * Chuyển khoản: thêm khối thông tin chuyển khoản (số TK shop, nội dung
 * NT<orderNumber>, số tiền) với nút sao chép từng dòng.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { paymentMethodName } from '../components/PaymentMethodSelector';
import { useCartCount } from '../hooks/useCartCount';
import { formatVND } from '../utils/format';
import { getOrder } from '../api/orderApi';

// Mock: thông tin tài khoản shop — thay bằng TK thật khi lên production.
const SHOP_BANK = {
  bank: 'Vietcombank',
  account: '0123 456 789',
  holder: 'NỘI THẤT MỘC AN',
};

async function copyText(text, onToast, label) {
  try {
    await navigator.clipboard.writeText(text);
    onToast?.(`Đã sao chép ${label}.`);
  } catch {
    onToast?.('Không sao chép được, bạn vui lòng ghi lại thủ công.');
  }
}

function CopyRow({ label, value, onToast }) {
  return (
    <div className="co-bank__row">
      <div>
        <p className="co-bank__label">{label}</p>
        <p className="co-bank__value">{value}</p>
      </div>
      <button
        type="button"
        className="btn btn-secondary co-bank__copy"
        onClick={() => copyText(value, onToast, label.toLowerCase())}
      >
        Sao chép
      </button>
    </div>
  );
}

export default function OrderSuccessPage({ darkMode, onToggleDark, onToast }) {
  const cartCount = useCartCount();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order');
  const [order, setOrder] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!orderNumber) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getOrder(orderNumber);
        if (!cancelled) setOrder(data);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  const transferContent = orderNumber ? `NT${orderNumber.replace(/\D/g, '')}` : '';
  const paidAtHHMM =
    order?.payment?.paidAt &&
    new Date(order.payment.paidAt).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="checkout-page">
      <Header
        cartCount={cartCount}
        darkMode={darkMode}
        onToggleDark={onToggleDark}
        onToast={onToast}
      />

      <main className="container co-success">
        {failed || !orderNumber ? (
          <div className="co-success__card" role="alert">
            <h1>Không tìm thấy đơn hàng</h1>
            <p>Mã đơn không hợp lệ hoặc đã hết hiệu lực.</p>
            <Link to="/" className="btn btn-primary">
              Về trang chủ
            </Link>
          </div>
        ) : !order ? (
          <div className="co-success__card" aria-label="Đang tải đơn hàng">
            <div className="skeleton" style={{ height: 64, width: 64, borderRadius: '50%', margin: '0 auto' }} />
            <div className="skeleton" style={{ height: 20, width: '60%', margin: '16px auto 0' }} />
            <div className="skeleton" style={{ height: 16, width: '40%', margin: '12px auto 0' }} />
          </div>
        ) : (
          <div className="co-success__card">
            <div className="co-success__icon" aria-hidden="true">
              ✓
            </div>
            <h1>Đặt hàng thành công!</h1>
            <p className="co-success__sub">
              Cảm ơn bạn đã tin chọn Mộc An. Shop sẽ liên hệ xác nhận đơn trong
              thời gian sớm nhất.
            </p>

            <div className="co-success__orderno">
              <span className="co-success__orderno-label">Mã đơn hàng</span>
              <button
                type="button"
                className="co-success__orderno-value"
                title="Bấm để sao chép mã đơn"
                onClick={() => copyText(order.orderNumber, onToast, 'mã đơn hàng')}
              >
                {order.orderNumber}
                <span className="co-success__copyhint" aria-hidden="true">
                  ⧉
                </span>
              </button>
            </div>

            <dl className="co-success__summary">
              <div>
                <dt>Tổng cộng</dt>
                <dd className="co-success__total">{formatVND(order.total)}</dd>
              </div>
              <div>
                <dt>Phương thức</dt>
                <dd>{paymentMethodName(order.paymentMethod)}</dd>
              </div>
              {order.address && (
                <div>
                  <dt>Nhận hàng</dt>
                  <dd>
                    {order.address.receiverName} · {order.address.phone}
                    <br />
                    {order.address.line}
                  </dd>
                </div>
              )}
            </dl>

            {order.paymentMethod === 'BANK_TRANSFER' && (
              <div className="co-bank" aria-label="Thông tin chuyển khoản">
                <h2>Thông tin chuyển khoản</h2>
                <p className="co-bank__hint">
                  Bạn vui lòng chuyển khoản đúng số tiền và nội dung bên dưới để
                  shop xác nhận đơn nhanh nhất.
                </p>
                <CopyRow label="Ngân hàng" value={SHOP_BANK.bank} onToast={onToast} />
                <CopyRow label="Số tài khoản" value={SHOP_BANK.account} onToast={onToast} />
                <CopyRow label="Chủ tài khoản" value={SHOP_BANK.holder} onToast={onToast} />
                <CopyRow label="Số tiền" value={formatVND(order.total)} onToast={onToast} />
                <CopyRow label="Nội dung chuyển khoản" value={transferContent} onToast={onToast} />
              </div>
            )}

            {order.paymentMethod === 'MOMO' &&
              order.payment?.status === 'ĐÃ THANH TOÁN' && (
                <div className="co-momo" role="status">
                  <span className="co-momo__icon" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <h2>Thanh toán thành công!</h2>
                    <p>
                      Đã thanh toán {formatVND(order.total)} qua Ví MoMo
                      {paidAtHHMM ? ` lúc ${paidAtHHMM}` : ''}.
                    </p>
                  </div>
                </div>
              )}

            <div className="co-success__ctas">
              <Link
                to={`/don-hang/${order.orderNumber}`}
                className="btn btn-primary"
              >
                Theo dõi đơn hàng
              </Link>
              <Link to="/" className="btn btn-secondary">
                Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer onToast={onToast} />
    </div>
  );
}
