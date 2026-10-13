import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import QuickViewModal from '../components/QuickViewModal';
import CategoryGrid from '../components/CategoryGrid';
import Button from '../components/Button';
import { useCartCount } from '../hooks/useCartCount';
import { addToCart } from '../utils/cart';
import { variantPrice, activeFlash } from '../utils/format';
import FilterSidebar from '../components/FilterSidebar';
import FilterDrawer from '../components/FilterDrawer';
import SortDropdown from '../components/SortDropdown';
import Pagination from '../components/Pagination';
import ActiveFilterChips from '../components/ActiveFilterChips';
import { searchProducts, getSearchFacets, SEARCH_PAGE_SIZE } from '../api/searchApi';
import { getBestSellers, getFeaturedProducts, getFeaturedCategories } from '../api/homeApi';
import { mockCategories, mockAllProducts } from '../mocks/homeMock';
import {
  POPULAR_SEARCHES,
  buildDictionary,
  suggestCorrection,
} from '../utils/search';
import '../catalog.css';

/**
 * Trang Tìm kiếm — FR-004, F-003, US-003.
 * Tái dùng layout + filter + sort + phân trang của CategoryPage;
 * khác: nguồn dữ liệu tìm kiếm, sort mặc định "relevance",
 * highlight từ khóa, gợi ý chính tả, trang gợi ý khi q rỗng.
 */

const SORT_VALUES = ['relevance', 'popular', 'price_asc', 'price_desc', 'newest'];
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
    q: (sp.get('q') || '').trim(),
    priceMin: getNum('priceMin'),
    priceMax: getNum('priceMax'),
    colors: getList('colors'),
    materials: getList('materials'),
    sizes: getList('sizes'),
    inStock: sp.get('inStock') === 'true',
    sort: SORT_VALUES.includes(sort) ? sort : 'relevance',
    page: Math.max(1, Number(sp.get('page')) || 1),
  };
}

function toURLParams(f) {
  const p = { q: f.q };
  if (f.priceMin != null) p.priceMin = String(f.priceMin);
  if (f.priceMax != null) p.priceMax = String(f.priceMax);
  if (f.colors.length) p.colors = f.colors.join(',');
  if (f.materials.length) p.materials = f.materials.join(',');
  if (f.sizes.length) p.sizes = f.sizes.join(',');
  if (f.sort && f.sort !== 'relevance') p.sort = f.sort;
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

// Từ điển gợi ý chính tả: build 1 lần từ mock data (API thật: backend tự lo)
const DICTIONARY = buildDictionary(mockAllProducts, mockCategories, POPULAR_SEARCHES);

export default function SearchPage({ darkMode, onToggleDark, onToast }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const f = parseParams(searchParams);
  const hasQuery = f.q.length > 0;
  const [state, setState] = useState({ status: 'loading', data: null });
  const [suggestData, setSuggestData] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickView, setQuickView] = useState(null);
  const cartCount = useCartCount();
  const gridTopRef = useRef(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Trang gợi ý khi q rỗng (§1.3 spec) — không gọi API tìm kiếm
  useEffect(() => {
    if (hasQuery) return;
    let cancelled = false;
    Promise.all([getFeaturedProducts(), getFeaturedCategories()]).then(
      ([featured, categories]) => {
        if (!cancelled) setSuggestData({ featured: featured.slice(0, 4), categories });
      },
      () => {
        if (!cancelled) setSuggestData({ featured: [], categories: [] });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [hasQuery]);

  useEffect(() => {
    if (!hasQuery) {
      setState({ status: 'idle', data: null });
      return;
    }
    let cancelled = false;
    let timer = null;
    setState({ status: 'loading', data: null });
    const t0 = Date.now();
    Promise.all([
      searchProducts({ ...f, size: SEARCH_PAGE_SIZE }),
      getSearchFacets(f.q),
    ])
      .then(([page, facets]) => {
        if (cancelled) return;
        const wait = Math.max(0, 300 - (Date.now() - t0));
        timer = setTimeout(() => {
          if (!cancelled) setState({ status: 'success', data: { page, facets } });
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
  }, [searchParams.toString()]);

  const patchFilters = (patch, keepPage = false) => {
    const next = { ...f, ...patch, page: keepPage ? f.page : 1 };
    setSearchParams(toURLParams(next));
  };

  const clearAll = () =>
    patchFilters({
      priceMin: null,
      priceMax: null,
      colors: [],
      materials: [],
      sizes: [],
      inStock: false,
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

  const goProduct = (product) => navigate(`/san-pham/${product.slug}`);
  const goSearch = (term) => navigate(`/tim-kiem?q=${encodeURIComponent(term)}`);
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

  const page = state.data?.page || null;
  const totalElements = page?.totalElements ?? 0;
  const facets = state.data?.facets || { colors: [], materials: [] };

  const activeFilterCount =
    (f.priceMin != null || f.priceMax != null ? 1 : 0) +
    f.colors.length +
    f.materials.length +
    f.sizes.length +
    (f.inStock ? 1 : 0);

  const chips = [];
  if (f.priceMin != null || f.priceMax != null) {
    chips.push({
      key: 'price',
      label: `Giá: ${f.priceMin != null ? formatPriceShort(f.priceMin) : '0đ'} – ${
        f.priceMax != null ? formatPriceShort(f.priceMax) : 'không giới hạn'
      }`,
      onRemove: () => patchFilters({ priceMin: null, priceMax: null }),
    });
  }
  f.colors.forEach((c) =>
    chips.push({
      key: `c-${c}`,
      label: `Màu: ${c}`,
      onRemove: () => patchFilters({ colors: f.colors.filter((x) => x !== c) }),
    })
  );
  f.materials.forEach((m) =>
    chips.push({
      key: `m-${m}`,
      label: `Chất liệu: ${m}`,
      onRemove: () => patchFilters({ materials: f.materials.filter((x) => x !== m) }),
    })
  );
  f.sizes.forEach((s) =>
    chips.push({
      key: `s-${s}`,
      label: SIZE_LABELS[s] || s,
      onRemove: () => patchFilters({ sizes: f.sizes.filter((x) => x !== s) }),
    })
  );
  if (f.inStock) {
    chips.push({
      key: 'instock',
      label: 'Còn hàng',
      onRemove: () => patchFilters({ inStock: false }),
    });
  }

  // Gợi ý "Ý bạn là...?" — chỉ khi 0 kết quả và tìm được từ gần đúng (§2.1)
  const correction = useMemo(() => {
    if (state.status !== 'success' || totalElements > 0 || !hasQuery) return null;
    return suggestCorrection(f.q, DICTIONARY);
  }, [state.status, totalElements, hasQuery, f.q]);

  /* ---------- Trang gợi ý khi q rỗng (§1.3) ---------- */
  if (!hasQuery) {
    return (
      <div className="search-page search-page--suggest">
        <Header cartCount={cartCount} darkMode={darkMode} onToggleDark={onToggleDark} onToast={onToast} />
        <main className="container">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Trang chủ</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Tìm kiếm</span>
          </nav>
          <h1 className="search-title">Bạn đang tìm gì?</h1>

          <section className="suggest-block">
            <h2 className="suggest-block__title">Tìm kiếm phổ biến</h2>
            <div className="search-tags search-tags--lg">
              {POPULAR_SEARCHES.map((tag) => (
                <button key={tag} type="button" className="search-tag" onClick={() => goSearch(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          </section>

          <section className="suggest-block">
            <h2 className="suggest-block__title">Danh mục nổi bật</h2>
            <CategoryGrid
              categories={suggestData?.categories || []}
              onSelect={(c) => navigate(`/danh-muc/${c.slug}`)}
            />
          </section>

          <section className="suggest-block">
            <div className="section-header">
              <h2 className="section-header__title">Sản phẩm nổi bật</h2>
            </div>
            <div className="product-grid">
              {(suggestData?.featured || []).map((p) => (
                <ProductCard key={p.id} product={p} onSelect={goProduct} onQuickView={setQuickView} onToast={onToast} />
              ))}
            </div>
          </section>
        </main>
        <Footer onToast={onToast} />
      </div>
    );
  }

  /* ---------- Trang kết quả ---------- */
  return (
    <div className="search-page">
      <Header cartCount={cartCount} darkMode={darkMode} onToggleDark={onToggleDark} onToast={onToast} />

      <main className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Tìm kiếm</span>
        </nav>

        <div className="category-head">
          <h1 className="search-title">
            Kết quả cho <span className="search-title__q">“{f.q}”</span>
          </h1>
          {state.status === 'success' && (
            <p className="category-count">{totalElements} sản phẩm</p>
          )}
        </div>

        <div className="catalog-layout">
          <FilterSidebar options={facets} filters={f} onChange={(patch) => patchFilters(patch)} />

          <section className="catalog-main" ref={gridTopRef}>
            <div className="mobile-toolbar">
              <button type="button" className="filter-open-btn" onClick={() => setDrawerOpen(true)}>
                <span aria-hidden="true">⏷</span> Bộ lọc
                {activeFilterCount > 0 && <span className="count-badge">{activeFilterCount}</span>}
              </button>
              <SortDropdown value={f.sort} onChange={onSortChange} showRelevance />
            </div>

            <div className="catalog-toolbar">
              <ActiveFilterChips chips={chips} onClearAll={clearAll} />
              <div className="catalog-toolbar__sort desktop-only">
                <SortDropdown value={f.sort} onChange={onSortChange} showRelevance />
              </div>
            </div>

            {state.status === 'loading' && (
              <div className="product-grid" aria-busy="true" aria-label="Đang tìm kiếm">
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
                <p>⚠️ Không tìm kiếm được lúc này. Kiểm tra mạng rồi thử lại nhé.</p>
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
                <h2>Không tìm thấy kết quả cho “{f.q}”</h2>
                {correction && (
                  <p className="spell-suggest">
                    Ý bạn là: <button type="button" className="link-btn" onClick={() => goSearch(correction)}>{correction}</button>?
                  </p>
                )}
                <p>Thử kiểm tra chính tả hoặc dùng từ khóa khác nhé.</p>
                <div className="search-tags search-tags--center">
                  {POPULAR_SEARCHES.slice(0, 6).map((tag) => (
                    <button key={tag} type="button" className="search-tag" onClick={() => goSearch(tag)}>
                      {tag}
                    </button>
                  ))}
                </div>
                <BestSellersBlock onSelect={goProduct} onQuickView={setQuickView} />
                <div className="empty-state__actions">
                  <Button variant="secondary" onClick={() => navigate('/tim-kiem')}>
                    Xóa tìm kiếm
                  </Button>
                </div>
              </div>
            )}

            {state.status === 'success' && page.content.length > 0 && (
              <>
                <div className="product-grid catalog-grid">
                  {page.content.map((p) => (
                    <ProductCard key={p.id} product={p} onSelect={goProduct} onQuickView={setQuickView} highlightQuery={f.q} onToast={onToast} />
                  ))}
                </div>
                <Pagination page={page.page} totalPages={page.totalPages} onChange={onPageChange} />
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

/** Khối "Có thể bạn thích" trong empty state — 4 sản phẩm bán chạy. */
function BestSellersBlock({ onSelect, onQuickView }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let cancelled = false;
    getBestSellers().then(
      (list) => {
        if (!cancelled) setItems((list || []).slice(0, 4));
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, []);
  if (!items.length) return null;
  return (
    <div className="suggest-block suggest-block--inner">
      <h3 className="suggest-block__title">Có thể bạn thích</h3>
      <div className="product-grid product-grid--4">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} onSelect={onSelect} onQuickView={onQuickView} onToast={onToast} />
        ))}
      </div>
    </div>
  );
}
