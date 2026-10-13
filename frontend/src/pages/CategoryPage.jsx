import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import QuickViewModal from '../components/QuickViewModal';
import { SkeletonCard } from '../components/Skeleton';
import Button from '../components/Button';
import { useCartCount } from '../hooks/useCartCount';
import { addToCart } from '../utils/cart';
import { variantPrice, activeFlash } from '../utils/format';
import FilterSidebar from '../components/FilterSidebar';
import FilterDrawer from '../components/FilterDrawer';
import SortDropdown from '../components/SortDropdown';
import Pagination from '../components/Pagination';
import ActiveFilterChips from '../components/ActiveFilterChips';
import {
  getProducts,
  getCategory,
  getFacets,
  PAGE_SIZE,
} from '../api/catalogApi';
import '../catalog.css';

/**
 * Trang Danh mục + lọc/sắp xếp — FR-002, FR-003, F-002, US-002.
 * Filter/sort/page đồng bộ lên URL query (§4 spec) — share link + back/forward OK.
 */

const SORT_VALUES = ['popular', 'price_asc', 'price_desc', 'newest'];
const SIZE_LABELS = { nho: 'Nhỏ (dưới 1m)', vua: 'Vừa (1 – 2m)', lon: 'Lớn (trên 2m)' };

function parseParams(sp) {
  const getNum = (k) => {
    const v = sp.get(k);
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const getList = (k) => {
    const v = sp.get(k);
    return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
  };
  const sort = sp.get('sort');
  return {
    priceMin: getNum('priceMin'),
    priceMax: getNum('priceMax'),
    colors: getList('colors'),
    materials: getList('materials'),
    sizes: getList('sizes'),
    inStock: sp.get('inStock') === 'true',
    sort: SORT_VALUES.includes(sort) ? sort : 'popular',
    page: Math.max(1, Number(sp.get('page')) || 1),
  };
}

function toURLParams(f) {
  const p = {};
  if (f.priceMin != null) p.priceMin = String(f.priceMin);
  if (f.priceMax != null) p.priceMax = String(f.priceMax);
  if (f.colors.length) p.colors = f.colors.join(',');
  if (f.materials.length) p.materials = f.materials.join(',');
  if (f.sizes.length) p.sizes = f.sizes.join(',');
  if (f.sort && f.sort !== 'popular') p.sort = f.sort;
  if (f.page > 1) p.page = String(f.page);
  if (f.inStock) p.inStock = 'true';
  return p;
}

function formatPriceShort(vnd) {
  if (vnd >= 1000000) {
    const t = vnd / 1000000;
    return `${Number.isInteger(t) ? t : t.toFixed(1)} triệu`;
  }
  return `${Math.round(vnd / 1000)} nghìn`;
}

export default function CategoryPage({ darkMode, onToggleDark, onToast }) {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const f = parseParams(searchParams);
  const [state, setState] = useState({ status: 'loading', data: null });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const gridTopRef = useRef(null);
  const [showTop, setShowTop] = useState(false);
  const navigate = useNavigate();
  const cartCount = useCartCount();
  const [quickView, setQuickView] = useState(null);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    setState({ status: 'loading', data: null });
    const t0 = Date.now();
    Promise.all([
      getProducts({ ...f, categorySlug: slug, size: PAGE_SIZE }),
      getCategory(slug),
      getFacets(slug),
    ])
      .then(([page, category, facets]) => {
        if (cancelled) return;
        const wait = Math.max(0, 300 - (Date.now() - t0)); // skeleton ngắn §3.5
        timer = setTimeout(() => {
          if (!cancelled) setState({ status: 'success', data: { page, category, facets } });
        }, wait);
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', data: null });
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, searchParams.toString()]);

  const patchFilters = (patch, keepPage = false) => {
    const next = { ...f, ...patch, page: keepPage ? f.page : 1 };
    setSearchParams(toURLParams(next));
  };

  const clearAll = () => patchFilters({
    priceMin: null, priceMax: null, colors: [], materials: [], sizes: [], inStock: false,
  });

  const scrollToGrid = () => {
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onPageChange = (page) => {
    patchFilters({ page }, true);
    scrollToGrid();
  };

  const onSortChange = (sort) => {
    patchFilters({ sort });
    scrollToGrid();
  };

  const category = state.data?.category || null;
  const categoryName = category ? category.name : 'Tất cả sản phẩm';
  const page = state.data?.page || null;
  const totalElements = page?.totalElements ?? 0;
  const facets = state.data?.facets || { colors: [], materials: [] };

  const activeFilterCount =
    (f.priceMin != null || f.priceMax != null ? 1 : 0) +
    f.colors.length + f.materials.length + f.sizes.length +
    (f.inStock ? 1 : 0);

  const chips = [];
  if (f.priceMin != null || f.priceMax != null) {
    chips.push({
      key: 'price',
      label: `Giá: ${f.priceMin != null ? formatPriceShort(f.priceMin) : '0đ'} – ${f.priceMax != null ? formatPriceShort(f.priceMax) : 'không giới hạn'}`,
      onRemove: () => patchFilters({ priceMin: null, priceMax: null }),
    });
  }
  f.colors.forEach((c) =>
    chips.push({ key: `c-${c}`, label: `Màu: ${c}`, onRemove: () => patchFilters({ colors: f.colors.filter((x) => x !== c) }) })
  );
  f.materials.forEach((m) =>
    chips.push({ key: `m-${m}`, label: `Chất liệu: ${m}`, onRemove: () => patchFilters({ materials: f.materials.filter((x) => x !== m) }) })
  );
  f.sizes.forEach((s) =>
    chips.push({ key: `s-${s}`, label: SIZE_LABELS[s] || s, onRemove: () => patchFilters({ sizes: f.sizes.filter((x) => x !== s) }) })
  );
  if (f.inStock) {
    chips.push({ key: 'instock', label: 'Còn hàng', onRemove: () => patchFilters({ inStock: false }) });
  }

  const goProduct = (product) => navigate(`/san-pham/${product.slug}`);
  const quickAddToCart = (p, v, q) => {
    addToCart({
      variantId: v.id, productId: p.id, productName: p.name, color: v.color,
      colorHex: v.colorHex, price: variantPrice(v), // giá flash nếu đang áp (flash-sale.md §5.3)
      image: v.images?.[0]?.url || p.images?.[0]?.url, stock: v.stock, qty: q,
      flashSaleProgramId: activeFlash(v)?.programId,
    });
    onToast?.(`Đã thêm ${q} × ${p.name} (${v.color}) vào giỏ hàng.`);
    setQuickView(null);
  };

  return (
    <div className="category-page">
      <Header
        cartCount={cartCount}
        darkMode={darkMode}
        onToggleDark={onToggleDark}
        onToast={onToast}
      />

      <main className="container">
        {/* Breadcrumb §2.1 */}
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{categoryName}</span>
        </nav>

        {/* Tiêu đề + số lượng §2.2 */}
        <div className="category-head">
          <h1>{categoryName}</h1>
          {state.status === 'success' && (
            <p className="category-count">{totalElements} sản phẩm</p>
          )}
        </div>

        <div className="catalog-layout">
          <FilterSidebar
            options={facets}
            filters={f}
            onChange={(patch) => patchFilters(patch)}
          />

          <section className="catalog-main" ref={gridTopRef}>
            {/* Toolbar mobile */}
            <div className="mobile-toolbar">
              <button
                type="button"
                className="filter-open-btn"
                onClick={() => setDrawerOpen(true)}
              >
                <span aria-hidden="true">⏷</span> Bộ lọc
                {activeFilterCount > 0 && (
                  <span className="count-badge">{activeFilterCount}</span>
                )}
              </button>
              <SortDropdown value={f.sort} onChange={onSortChange} />
            </div>

            {/* Toolbar desktop: chips + sort */}
            <div className="catalog-toolbar">
              <ActiveFilterChips chips={chips} onClearAll={clearAll} />
              <div className="catalog-toolbar__sort desktop-only">
                <SortDropdown value={f.sort} onChange={onSortChange} />
              </div>
            </div>

            {/* Grid / loading / empty / error — §5 spec */}
            {state.status === 'loading' && (
              <div className="product-grid" aria-busy="true" aria-label="Đang tải sản phẩm">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton sk-card" aria-hidden="true">
                    <div className="sk-img skeleton" />
                    <div className="sk-body">
                      <div className="skeleton" style={{ height: 16, width: '80%' }} />
                      <div className="skeleton" style={{ height: 14, width: '50%' }} />
                      <div className="skeleton" style={{ height: 20, width: '60%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {state.status === 'error' && (
              <div className="inline-error" role="alert">
                <p>⚠️ Không tải được sản phẩm. Kiểm tra mạng rồi thử lại nhé.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSearchParams(toURLParams(f), { replace: true })}
                >
                  Thử lại
                </Button>
              </div>
            )}

            {state.status === 'success' && page.content.length === 0 && (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                  <circle cx="26" cy="26" r="14" stroke="var(--border)" strokeWidth="4" />
                  <line x1="36" y1="36" x2="50" y2="50" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />
                  <rect x="38" y="42" width="18" height="10" rx="2" stroke="var(--border)" strokeWidth="3" />
                </svg>
                <h2>Không tìm thấy sản phẩm phù hợp</h2>
                <p>Thử nới khoảng giá hoặc bỏ bớt điều kiện lọc nhé.</p>
                {chips.length > 0 && (
                  <ActiveFilterChips chips={chips} onClearAll={clearAll} />
                )}
                <div className="empty-state__actions">
                  <Button variant="primary" onClick={clearAll}>
                    Xóa tất cả bộ lọc
                  </Button>
                  {category && (
                    <Link className="link-btn" to={`/danh-muc/${slug}`}>
                      Xem tất cả {categoryName.toLowerCase()}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {state.status === 'success' && page.content.length > 0 && (
              <>
                <div className="product-grid catalog-grid">
                  {page.content.map((p) => (
                    <ProductCard key={p.id} product={p} onSelect={goProduct} onQuickView={setQuickView} onToast={onToast} />
                  ))}
                </div>
                <Pagination
                  page={page.page}
                  totalPages={page.totalPages}
                  onChange={onPageChange}
                />
              </>
            )}
          </section>
        </div>
      </main>

      <Footer onToast={onToast} />

      {quickView && (
        <QuickViewModal
          product={quickView}
          onClose={() => setQuickView(null)}
          onAddToCart={quickAddToCart}
          onToast={onToast}
        />
      )}

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        options={facets}
        filters={f}
        onChange={(patch) => patchFilters(patch)}
        onClearAll={clearAll}
        resultCount={totalElements}
      />

      <button
        className={`back-to-top${showTop ? ' show' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Về đầu trang"
      >
        ↑
      </button>
    </div>
  );
}
