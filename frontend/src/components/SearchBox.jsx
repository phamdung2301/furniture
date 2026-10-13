import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSuggestions } from '../api/searchApi';
import { POPULAR_SEARCHES, normalizeVi } from '../utils/search';
import { getCardInfo, formatVND } from '../utils/format';

const RECENT_KEY = 'nts_recent_searches';
const RECENT_MAX = 8;

function loadRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(q) {
  const query = q.trim();
  if (!query) return;
  const norm = normalizeVi(query);
  const next = [query, ...loadRecent().filter((s) => normalizeVi(s) !== norm)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* bỏ qua khi storage đầy */
  }
}

/**
 * Ô tìm kiếm header — §1.1 spec tim-kiem.
 * Focus khi trống: lịch sử gần đây + tìm kiếm phổ biến.
 * Gõ ≥2 ký tự (debounce 300ms): gợi ý trực tiếp 6 SP + 3 danh mục.
 * Phím ↑/↓/Enter/Esc. Submit -> /tim-kiem?q= (giữ filter nếu đang ở trang tìm kiếm).
 */
export default function SearchBox({ onToast, autoFocus = false, id = 'site-search' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestState, setSuggestState] = useState({ status: 'idle', products: [], categories: [] });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState(loadRecent);
  const boxRef = useRef(null);
  const blurTimer = useRef(null);

  const searching = query.trim().length >= 2;

  // Debounce 300ms cho gợi ý trực tiếp
  useEffect(() => {
    if (!searching) {
      setSuggestState({ status: 'idle', products: [], categories: [] });
      setActiveIndex(-1);
      return;
    }
    setSuggestState((s) => ({ ...s, status: 'loading' }));
    const t = setTimeout(() => {
      getSuggestions(query.trim()).then(
        ({ products, categories }) => {
          setSuggestState({ status: 'success', products, categories });
          setActiveIndex(-1);
        },
        () => setSuggestState({ status: 'idle', products: [], categories: [] })
      );
    }, 300);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đóng khi click ngoài
  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const submitSearch = (q) => {
    const trimmed = (q ?? query).trim();
    if (!trimmed) return;
    saveRecent(trimmed);
    setRecent(loadRecent());
    setOpen(false);
    // Đổi từ khóa mới: giữ filter hiện tại nếu đang ở trang tìm kiếm (§4 spec)
    if (location.pathname === '/tim-kiem') {
      const sp = new URLSearchParams(location.search);
      sp.set('q', trimmed);
      sp.delete('page');
      navigate(`/tim-kiem?${sp.toString()}`);
    } else {
      navigate(`/tim-kiem?q=${encodeURIComponent(trimmed)}`);
    }
  };

  // Danh sách phẳng để điều hướng phím ↑/↓
  const navItems = useMemo(() => {
    if (!searching || suggestState.status !== 'success') return [];
    const items = [
      ...suggestState.products.map((p) => ({ kind: 'product', product: p })),
      ...suggestState.categories.map((c) => ({ kind: 'category', category: c })),
    ];
    items.push({ kind: 'all' });
    return items;
  }, [searching, suggestState]);

  const activate = (item) => {
    if (!item) return;
    if (item.kind === 'product') {
      setOpen(false);
      onToast?.('Chi tiết sản phẩm sẽ có ở màn tiếp theo');
    } else if (item.kind === 'category') {
      setOpen(false);
      navigate(`/danh-muc/${item.category.slug}`);
    } else {
      submitSearch();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!navItems.length) return;
      e.preventDefault();
      setActiveIndex((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        return (next + navItems.length) % navItems.length;
      });
      return;
    }
    if (e.key === 'Enter' && activeIndex >= 0 && navItems[activeIndex]) {
      e.preventDefault();
      activate(navItems[activeIndex]);
    }
  };

  const removeRecent = (term) => {
    const next = recent.filter((s) => s !== term);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* bỏ qua */
    }
  };

  const clearRecent = () => {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* bỏ qua */
    }
  };

  const showIdlePanel = open && !searching;
  const showSuggestPanel = open && searching;

  return (
    <div className="searchbox" ref={boxRef}>
      <form
        className="searchbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (activeIndex >= 0 && navItems[activeIndex]) activate(navItems[activeIndex]);
          else submitSearch();
        }}
      >
        <span className="searchbar__icon" aria-hidden="true">🔍</span>
        <input
          id={id}
          type="search"
          placeholder="Tìm kiếm sofa, bàn ăn, giường ngủ…"
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label="Tìm kiếm sản phẩm"
          aria-expanded={open}
          aria-controls={`${id}-dropdown`}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setRecent(loadRecent());
            setOpen(true);
          }}
          onBlur={() => {
            // Delay 150ms để kịp click vào dropdown (§1.1 spec)
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={onKeyDown}
        />
      </form>

      {showIdlePanel && (
        <div className="search-dropdown" id={`${id}-dropdown`} role="listbox" aria-label="Gợi ý tìm kiếm">
          {recent.length > 0 && (
            <div className="search-dropdown__section">
              <div className="search-dropdown__head">
                <span className="search-dropdown__title">Tìm kiếm gần đây</span>
                <button type="button" className="link-btn link-btn--sm" onClick={clearRecent}>
                  Xóa tất cả
                </button>
              </div>
              {recent.map((term) => (
                <div key={term} className="search-dropdown__row" role="option" aria-selected="false">
                  <button
                    type="button"
                    className="search-dropdown__item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => submitSearch(term)}
                  >
                    <span aria-hidden="true">🕘</span> {term}
                  </button>
                  <button
                    type="button"
                    className="search-dropdown__remove"
                    aria-label={`Xóa "${term}" khỏi lịch sử`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => removeRecent(term)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="search-dropdown__section">
            <div className="search-dropdown__title">Tìm kiếm phổ biến</div>
            <div className="search-tags">
              {POPULAR_SEARCHES.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="search-tag"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => submitSearch(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSuggestPanel && (
        <div className="search-dropdown" id={`${id}-dropdown`} role="listbox" aria-label="Gợi ý trực tiếp">
          {suggestState.status === 'loading' && (
            <div className="search-dropdown__section" aria-busy="true" aria-label="Đang tải gợi ý">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} aria-hidden="true" />
              ))}
            </div>
          )}
          {suggestState.status === 'success' && (
            <>
              {suggestState.products.length > 0 && (
                <div className="search-dropdown__section">
                  <div className="search-dropdown__title">Sản phẩm gợi ý</div>
                  {suggestState.products.map((p, i) => {
                    const info = getCardInfo(p);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={navItems[i] && activeIndex === i}
                        className={`search-suggest${activeIndex === i ? ' active' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => activate(navItems[i])}
                        onMouseEnter={() => setActiveIndex(i)}
                      >
                        {info.image ? (
                          <img src={info.image} alt="" aria-hidden="true" loading="lazy" />
                        ) : (
                          <span className="search-suggest__noimg" aria-hidden="true" />
                        )}
                        <span className="search-suggest__name">{p.name}</span>
                        <span className="search-suggest__price">{formatVND(info.price)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {suggestState.categories.length > 0 && (
                <div className="search-dropdown__section">
                  <div className="search-dropdown__title">Danh mục</div>
                  {suggestState.categories.map((c, j) => {
                    const idx = suggestState.products.length + j;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === idx}
                        className={`search-suggest search-suggest--cat${activeIndex === idx ? ' active' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => activate(navItems[idx])}
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <span>
                          {c.name} <span className="muted">({c.count} sản phẩm)</span>
                        </span>
                        <span aria-hidden="true">→</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                className={`search-suggest search-suggest--all${activeIndex === navItems.length - 1 ? ' active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => activate(navItems[navItems.length - 1])}
                onMouseEnter={() => setActiveIndex(navItems.length - 1)}
              >
                Xem tất cả kết quả cho “{query.trim()}” →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
