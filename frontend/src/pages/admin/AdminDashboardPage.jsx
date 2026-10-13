import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import KpiCard from '../../components/admin/KpiCard';
import RevenueChart from '../../components/admin/RevenueChart';
import StatusDonut from '../../components/admin/StatusDonut';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import { formatVND } from '../../utils/format';
import {
  getLowStock,
  getOrdersByStatus,
  getRecentOrders,
  getRevenueByCategory,
  getRevenueSeries,
  getStatsOverview,
  getTopProducts,
} from '../../api/adminApi';

/**
 * Admin Dashboard — màn 14 · FR-026 · F-020 · F-017 · US-015 · US-016.
 * Doanh thu chỉ tính đơn HOÀN THÀNH (+ COD đã thu) — quy ước F-020.
 * Mỗi khối tải độc lập: loading/empty/error + "Thử lại" riêng (§9).
 */

const useBlock = (loader) => {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      setState({ loading: false, error: null, data });
    } catch (e) {
      setState({ loading: false, error: e, data: null });
    }
  }, [loader]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
};

function BlockError({ onRetry }) {
  return (
    <div className="admin-block__state">
      <p>Không tải được dữ liệu.</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}

function SkeletonRows({ rows = 5, height = 22 }) {
  return (
    <div className="admin-skel-rows" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

const pad2 = (n) => String(n).padStart(2, '0');
/** ISO -> "08:15 12/10" cho bảng đơn mới nhất (§7). */
function fmtTimeDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

const RANGE_OPTIONS = [
  { value: 'day', label: 'Ngày' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
];

const BAR_COLORS = ['var(--brand-700)', '#8A6D4F', 'var(--accent)', '#C9BBA9', '#D9CBBB', '#E4DACA'];

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { onToast } = useOutletContext();
  const [range, setRange] = useState('day');
  const [chartType, setChartType] = useState('bar');
  const [updatedAt, setUpdatedAt] = useState(null);

  const overview = useBlock(useCallback(() => getStatsOverview(), []));
  const revenue = useBlock(useCallback(() => getRevenueSeries(range), [range]));
  const byStatus = useBlock(useCallback(() => getOrdersByStatus(), []));
  const byCategory = useBlock(useCallback(() => getRevenueByCategory(), []));
  const topProducts = useBlock(useCallback(() => getTopProducts(5), []));
  const recentOrders = useBlock(useCallback(() => getRecentOrders(), []));
  const lowStock = useBlock(useCallback(() => getLowStock(5), []));

  useEffect(() => {
    if (!overview.loading && !overview.error) {
      setUpdatedAt(new Date());
    }
  }, [overview.loading, overview.error]);

  const refreshAll = () => {
    overview.reload();
    revenue.reload();
    byStatus.reload();
    byCategory.reload();
    topProducts.reload();
    recentOrders.reload();
    lowStock.reload();
  };

  const copyOrderNumber = async (orderNumber) => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      onToast?.('Đã sao chép mã đơn.');
    } catch {
      onToast?.(orderNumber);
    }
  };

  const ov = overview.data;
  const allFailed =
    overview.error && revenue.error && byStatus.error && recentOrders.error;

  // Doanh thu theo danh mục: tối đa 5 dòng + gộp phần còn lại (§5).
  const categoryRows = (() => {
    const list = byCategory.data || [];
    if (list.length <= 5) return list.map((c) => ({ ...c, isOther: false }));
    const head = list.slice(0, 5);
    const restRevenue = list.slice(5).reduce((s, c) => s + c.revenue, 0);
    return [
      ...head.map((c) => ({ ...c, isOther: false })),
      { categoryId: '__other', categoryName: 'Danh mục khác', revenue: restRevenue, isOther: true },
    ];
  })();
  const categoryTotal = (byCategory.data || []).reduce((s, c) => s + c.revenue, 0);
  const categoryMax = Math.max(...categoryRows.map((c) => c.revenue), 1);

  return (
    <div className="dashboard">
      <div className="dashboard__head">
        <div>
          <h2 className="dashboard__title">Tổng quan</h2>
          {updatedAt ? (
            <p className="dashboard__updated">
              Cập nhật lúc {pad2(updatedAt.getHours())}:{pad2(updatedAt.getMinutes())}
            </p>
          ) : null}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={refreshAll}>
          ↻ Làm mới
        </button>
      </div>

      {allFailed ? (
        <div className="admin-banner-error" role="alert">
          <span>Không tải được dữ liệu. Kiểm tra kết nối và thử lại.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      ) : null}

      {/* ---------- §2 Hàng KPI ---------- */}
      <section className="kpi-grid" aria-label="Chỉ số tổng quan">
        <KpiCard
          label="Doanh thu hôm nay"
          value={ov ? formatVND(ov.revenueToday) : '—'}
          changePct={ov?.revenueTodayChangePct}
          changeLabel="so với hôm qua"
          hint="Chỉ tính đơn đã hoàn thành (COD đã thu tiền)."
          loading={overview.loading}
        />
        <KpiCard
          label="Doanh thu tháng này"
          value={ov ? formatVND(ov.revenueMonth) : '—'}
          changePct={ov?.revenueMonthChangePct}
          changeLabel="so với tháng trước"
          hint="Chỉ tính đơn đã hoàn thành (COD đã thu tiền)."
          loading={overview.loading}
        />
        <KpiCard
          label="Đơn mới hôm nay"
          value={ov ? `${ov.newOrdersToday}` : '—'}
          changePct={ov?.newOrdersChangePct}
          changeLabel="so với hôm qua"
          loading={overview.loading}
          onClick={() => navigate('/admin/don-hang')}
        />
        <KpiCard
          label="Đơn chờ xử lý"
          value={ov ? `${ov.pendingOrders}` : '—'}
          subText="cần xử lý"
          loading={overview.loading}
          onClick={() => navigate('/admin/don-hang?trang-thai=cho-xu-ly')}
        />
        <KpiCard
          label="Khách hàng mới"
          value={ov ? `${ov.newCustomersToday}` : '—'}
          changePct={ov?.newCustomersChangePct}
          changeLabel="so với hôm qua"
          loading={overview.loading}
          onClick={() => navigate('/admin/khach-hang')}
        />
        <KpiCard
          label="Tồn kho sắp hết"
          value={ov ? `${ov.lowStockCount}` : '—'}
          subText="variant dưới ngưỡng tồn"
          loading={overview.loading}
          onClick={() => navigate('/admin/ton-kho?trang-thai=sap-het')}
        />
      </section>
      {overview.error ? (
        <div className="admin-block__inline-error">
          <span>Không tải được chỉ số tổng quan.</span>
          <button type="button" className="btn btn-text" onClick={overview.reload}>
            Thử lại
          </button>
        </div>
      ) : null}

      {/* ---------- §3 + §4 Biểu đồ doanh thu + Donut trạng thái ---------- */}
      <div className="dashboard__row dashboard__row--chart">
        <section className="admin-card">
          <div className="admin-card__head">
            <h3 className="admin-card__title">Doanh thu</h3>
            <div className="dashboard__chart-controls">
              <div className="segmented" role="group" aria-label="Nhóm theo kỳ">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={range === opt.value ? 'is-active' : ''}
                    onClick={() => setRange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="segmented" role="group" aria-label="Kiểu biểu đồ">
                <button
                  type="button"
                  className={chartType === 'bar' ? 'is-active' : ''}
                  onClick={() => setChartType('bar')}
                >
                  Cột
                </button>
                <button
                  type="button"
                  className={chartType === 'line' ? 'is-active' : ''}
                  onClick={() => setChartType('line')}
                >
                  Đường
                </button>
              </div>
            </div>
          </div>
          {revenue.loading ? (
            <div className="skeleton dashboard__chart-skel" aria-hidden="true" />
          ) : revenue.error ? (
            <BlockError onRetry={revenue.reload} />
          ) : (
            <RevenueChart data={revenue.data || []} type={chartType} />
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card__head">
            <h3 className="admin-card__title">Đơn theo trạng thái</h3>
            <span className="admin-card__note">Tháng này</span>
          </div>
          {byStatus.loading ? (
            <div className="skeleton dashboard__donut-skel" aria-hidden="true" />
          ) : byStatus.error ? (
            <BlockError onRetry={byStatus.reload} />
          ) : (byStatus.data || []).reduce((s, d) => s + d.count, 0) === 0 ? (
            <div className="admin-block__state">
              <p>Chưa có đơn hàng trong khoảng này.</p>
            </div>
          ) : (
            <StatusDonut
              data={byStatus.data || []}
              onSelect={(status) => navigate(`/admin/don-hang?trang-thai=${encodeURIComponent(status)}`)}
            />
          )}
        </section>
      </div>

      {/* ---------- §5 + §6 Danh mục + Top sản phẩm ---------- */}
      <div className="dashboard__row dashboard__row--split">
        <section className="admin-card">
          <div className="admin-card__head">
            <h3 className="admin-card__title">Doanh thu theo danh mục</h3>
            <span className="admin-card__note">Tháng này · đơn hoàn thành</span>
          </div>
          {byCategory.loading ? (
            <SkeletonRows rows={5} height={26} />
          ) : byCategory.error ? (
            <BlockError onRetry={byCategory.reload} />
          ) : categoryRows.length === 0 ? (
            <div className="admin-block__state">
              <p>Chưa có doanh thu trong tháng này.</p>
            </div>
          ) : (
            <ul className="cat-bars">
              {categoryRows.map((c, idx) => (
                <li key={c.categoryId}>
                  <button
                    type="button"
                    className="cat-bars__row"
                    onClick={() => !c.isOther && navigate('/admin/danh-muc')}
                  >
                    <span className="cat-bars__name">{c.categoryName}</span>
                    <span className="cat-bars__track">
                      <span
                        className="cat-bars__fill"
                        style={{
                          width: `${Math.max(2, (c.revenue / categoryMax) * 100)}%`,
                          background: BAR_COLORS[Math.min(idx, BAR_COLORS.length - 1)],
                        }}
                      />
                    </span>
                    <span className="cat-bars__value">{formatVND(c.revenue)}</span>
                    <span className="cat-bars__pct">
                      {categoryTotal
                        ? `${((c.revenue / categoryTotal) * 100).toLocaleString('vi-VN', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}%`
                        : '0,0%'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card__head">
            <h3 className="admin-card__title">Sản phẩm bán chạy</h3>
            <span className="admin-card__note">Tháng này</span>
          </div>
          {topProducts.loading ? (
            <SkeletonRows rows={5} height={48} />
          ) : topProducts.error ? (
            <BlockError onRetry={topProducts.reload} />
          ) : (topProducts.data || []).length === 0 ? (
            <div className="admin-block__state">
              <p>Chưa có sản phẩm nào được bán trong tháng này.</p>
            </div>
          ) : (
            <ul className="top-products">
              {(topProducts.data || []).map((p, idx) => (
                <li key={p.productId}>
                  <button
                    type="button"
                    className="top-products__row"
                    onClick={() => navigate('/admin/san-pham')}
                  >
                    <span className={`top-products__rank${idx < 3 ? ' is-top' : ''}`}>{idx + 1}</span>
                    {p.image ? (
                      <img src={p.image} alt="" className="top-products__img" loading="lazy" />
                    ) : (
                      <span className="top-products__img top-products__img--empty" aria-hidden="true" />
                    )}
                    <span className="top-products__meta">
                      <span className="top-products__name">{p.name}</span>
                      <span className="top-products__sold">Đã bán {p.soldQty}</span>
                    </span>
                    <span className="top-products__revenue">{formatVND(p.revenue)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- §7 + §8 Đơn mới nhất + Cảnh báo tồn kho ---------- */}
      <div className="dashboard__row dashboard__row--bottom">
        <section className="admin-card">
          <div className="admin-card__head">
            <h3 className="admin-card__title">Đơn hàng mới nhất</h3>
            <Link to="/admin/don-hang" className="admin-card__link">
              Xem tất cả →
            </Link>
          </div>
          {recentOrders.loading ? (
            <SkeletonRows rows={5} height={30} />
          ) : recentOrders.error ? (
            <BlockError onRetry={recentOrders.reload} />
          ) : (recentOrders.data || []).length === 0 ? (
            <div className="admin-block__state">
              <p>Chưa có đơn hàng nào.</p>
            </div>
          ) : (
            <div className="recent-orders__scroll">
              <table className="recent-orders">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th className="is-right">Tổng tiền</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentOrders.data || []).map((o) => (
                    <tr
                      key={o.orderNumber}
                      className="is-clickable"
                      onClick={() => navigate(`/admin/don-hang?ma-don=${o.orderNumber}`)}
                    >
                      <td>
                        <button
                          type="button"
                          className="recent-orders__code"
                          title="Sao chép mã đơn"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyOrderNumber(o.orderNumber);
                          }}
                        >
                          {o.orderNumber}
                        </button>
                      </td>
                      <td>
                        <div className="recent-orders__customer">{o.customerName}</div>
                        <div className="recent-orders__phone">{o.customerPhone}</div>
                      </td>
                      <td className="is-right recent-orders__total">{formatVND(o.total)}</td>
                      <td>
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="recent-orders__time">{fmtTimeDay(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-card admin-card--warning">
          <div className="admin-card__head">
            <h3 className="admin-card__title admin-card__title--warning">⚠ Tồn kho sắp hết</h3>
            <Link to="/admin/ton-kho?trang-thai=sap-het" className="admin-card__link">
              Xem tất cả →
            </Link>
          </div>
          {lowStock.loading ? (
            <SkeletonRows rows={4} height={44} />
          ) : lowStock.error ? (
            <BlockError onRetry={lowStock.reload} />
          ) : (lowStock.data || []).length === 0 ? (
            <div className="admin-block__state admin-block__state--ok">
              <p>✓ Tất cả sản phẩm đều đủ tồn kho.</p>
            </div>
          ) : (
            <ul className="low-stock">
              {(lowStock.data || []).map((v) => (
                <li key={v.variantId}>
                  <button
                    type="button"
                    className="low-stock__row"
                    onClick={() =>
                      navigate(`/admin/ton-kho?sku=${encodeURIComponent(v.sku)}`)
                    }
                  >
                    {v.image ? (
                      <img src={v.image} alt="" className="low-stock__img" loading="lazy" />
                    ) : (
                      <span className="low-stock__img low-stock__img--empty" aria-hidden="true" />
                    )}
                    <span className="low-stock__meta">
                      <span className="low-stock__name">
                        {v.productName} — màu {v.color}
                      </span>
                      <span className="low-stock__sku">{v.sku}</span>
                    </span>
                    {v.stock <= 0 ? (
                      <span className="low-stock__badge low-stock__badge--out">Hết hàng</span>
                    ) : (
                      <span className="low-stock__badge">Còn {v.stock}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
