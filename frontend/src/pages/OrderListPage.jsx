/**
 * Trang danh sách đơn hàng — route /don-hang (màn 11, theo-doi-don.md §2).
 * FR-016 · US-009. Filter theo trạng thái, giữ filter ở query param
 * ?trang-thai= để F5 không mất. Yêu cầu đăng nhập (không guest checkout).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import OrderCard from '../components/OrderCard';
import Button from '../components/Button';
import { useCartCount } from '../hooks/useCartCount';
import { isLoggedIn } from '../utils/auth';
import { listOrders } from '../api/orderApi';

const FILTERS = [
  { id: 'tat-ca', label: 'Tất cả', statuses: null },
  { id: 'moi', label: 'Mới', statuses: ['MỚI', 'ĐÃ XÁC NHẬN'] },
  { id: 'dang-giao', label: 'Đang giao', statuses: ['ĐANG GIAO'] },
  { id: 'hoan-thanh', label: 'Hoàn thành', statuses: ['HOÀN THÀNH', 'HOÀN TRẢ'] },
  { id: 'da-huy', label: 'Đã hủy', statuses: ['ĐÃ HỦY'] },
];

const PAGE_SIZE = 50;

function OrderCardSkeleton() {
  return (
    <div className="order-card order-card--skeleton" aria-hidden="true">
      <div className="skeleton" style={{ height: 18, width: '45%' }} />
      <div className="order-card__row2" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ width: 56, height: 56 }} />
          <div className="skeleton" style={{ width: 56, height: 56 }} />
          <div className="skeleton" style={{ width: 56, height: 56 }} />
        </div>
        <div className="skeleton" style={{ height: 20, width: 140 }} />
      </div>
    </div>
  );
}

export default function OrderListPage({ darkMode, onToggleDark, onToast }) {
  const cartCount = useCartCount();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterId = searchParams.get('trang-thai') || 'tat-ca';
  const filter = FILTERS.find((f) => f.id === filterId) || FILTERS[0];

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [orders, setOrders] = useState([]);
  const [totalAll, setTotalAll] = useState(null); // tổng số đơn (không lọc)

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/dang-nhap?returnTo=/don-hang', { replace: true });
    }
  }, [navigate]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [page, allPage] = await Promise.all([
        listOrders({ status: filter.statuses, page: 1, size: PAGE_SIZE }),
        filter.statuses
          ? listOrders({ status: null, page: 1, size: 1 })
          : Promise.resolve(null),
      ]);
      setOrders(page.content || []);
      setTotalAll(allPage ? allPage.totalElements : page.totalElements);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [filter.statuses]);

  useEffect(() => {
    if (isLoggedIn()) load();
  }, [load]);

  const setFilter = (id) => {
    if (id === 'tat-ca') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ 'trang-thai': id }, { replace: true });
    }
  };

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
          <span aria-current="page">Đơn hàng của tôi</span>
        </nav>

        <h1 className="orders-title">
          Đơn hàng của tôi
          {totalAll !== null && (
            <span className="orders-count">({totalAll} đơn)</span>
          )}
        </h1>

        <div className="orders-filters" role="tablist" aria-label="Lọc theo trạng thái">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter.id === f.id}
              className={`orders-chip${filter.id === f.id ? ' orders-chip--active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {status === 'loading' && (
          <div className="orders-list" aria-label="Đang tải">
            <OrderCardSkeleton />
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </div>
        )}

        {status === 'error' && (
          <div className="orders-state" role="alert">
            <h2>Có lỗi xảy ra khi tải đơn hàng.</h2>
            <p>Bạn vui lòng kiểm tra kết nối và thử lại.</p>
            <Button variant="secondary" onClick={load}>
              Thử lại
            </Button>
          </div>
        )}

        {status === 'ready' && totalAll === 0 && (
          <div className="orders-state">
            <div className="orders-state__icon" aria-hidden="true">
              🧾
            </div>
            <h2>Chưa có đơn hàng nào.</h2>
            <p>Đơn hàng của bạn sẽ hiện ở đây sau khi đặt mua.</p>
            <Button variant="primary" onClick={() => navigate('/')}>
              Mua sắm ngay
            </Button>
          </div>
        )}

        {status === 'ready' && totalAll > 0 && orders.length === 0 && (
          <div className="orders-state">
            <h2>Không có đơn hàng nào ở trạng thái này.</h2>
            <p>Thử chọn trạng thái khác để xem các đơn còn lại.</p>
          </div>
        )}

        {status === 'ready' && orders.length > 0 && (
          <div className="orders-list">
            {orders.map((o) => (
              <OrderCard key={o.orderNumber} order={o} onToast={onToast} />
            ))}
          </div>
        )}
      </main>

      <Footer onToast={onToast} />
    </div>
  );
}
