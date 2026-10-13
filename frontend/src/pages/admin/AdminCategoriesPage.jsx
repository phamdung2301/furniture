import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import AdminModal from '../../components/admin/AdminModal';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import CategoryFormModal from '../../components/admin/CategoryFormModal';
import Pagination from '../../components/Pagination';
import { normalizeVi } from '../../utils/search';
import { deleteCategory, listCategories, moveCategory } from '../../api/adminCategoryApi';

/**
 * Quản lý danh mục — màn 16 · FR-021 · F-015 (admin-danh-muc.md).
 * Bảng cây 2 cấp: gốc theo sortOrder, con thụt 28px ngay dưới cha;
 * phân trang theo CỤM CHA (cha + con không tách trang).
 * Đang tìm kiếm → bảng phẳng + cột "Danh mục cha", ẩn cụm ↑↓.
 * Xóa: kiểm danh mục con trước → sản phẩm sau (§5).
 */

const byOrderThenName = (a, b) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi');

export default function AdminCategoriesPage() {
  const { onToast } = useOutletContext();
  const navigate = useNavigate();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formState, setFormState] = useState(null); // { categoryId, presetParentId }
  const [dialog, setDialog] = useState(null); // { type: 'children'|'products'|'confirm', category }
  const [dialogBusy, setDialogBusy] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const debounceRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCategories();
      setAll(data || []);
      return data || [];
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* --------------------------- Cây + lọc --------------------------- */

  const roots = useMemo(() => all.filter((c) => !c.parentId).sort(byOrderThenName), [all]);
  const childrenByParent = useMemo(() => {
    const map = new Map();
    all
      .filter((c) => c.parentId)
      .sort(byOrderThenName)
      .forEach((c) => {
        if (!map.has(c.parentId)) map.set(c.parentId, []);
        map.get(c.parentId).push(c);
      });
    return map;
  }, [all]);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);

  const searching = q.trim() !== '';
  const filtering = searching || statusFilter !== '';

  const statusMatch = useCallback(
    (c) => statusFilter === '' || (statusFilter === 'true') === (c.active !== false),
    [statusFilter]
  );

  // Chế độ cây: 1 cụm = danh mục gốc + các con; cụm hiện khi gốc hoặc 1 con khớp
  // lọc trạng thái (gốc giữ vai trò ngữ cảnh cho con khớp).
  const clusters = useMemo(() => {
    if (searching) return [];
    return roots
      .map((root) => {
        const kids = childrenByParent.get(root.id) || [];
        const visibleKids = kids.filter(statusMatch);
        if (!statusMatch(root) && visibleKids.length === 0) return null;
        return { root, kids: visibleKids, rootVisible: statusMatch(root) };
      })
      .filter(Boolean);
  }, [searching, roots, childrenByParent, statusMatch]);

  // Chế độ tìm kiếm: bảng phẳng mọi danh mục khớp tên/slug + trạng thái.
  const flatRows = useMemo(() => {
    if (!searching) return [];
    const needle = normalizeVi(q.trim());
    const ordered = [];
    roots.forEach((r) => {
      ordered.push(r);
      (childrenByParent.get(r.id) || []).forEach((c) => ordered.push(c));
    });
    all
      .filter((c) => c.parentId && !byId.has(c.parentId))
      .forEach((c) => ordered.push(c));
    return ordered.filter(
      (c) =>
        statusMatch(c) &&
        (normalizeVi(c.name).includes(needle) || normalizeVi(c.slug).includes(needle))
    );
  }, [searching, q, roots, childrenByParent, all, byId, statusMatch]);

  const totalPages = searching
    ? Math.max(1, Math.ceil(flatRows.length / pageSize))
    : Math.max(1, Math.ceil(clusters.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageClusters = useMemo(
    () => clusters.slice((safePage - 1) * pageSize, safePage * pageSize),
    [clusters, safePage, pageSize]
  );
  const pageFlatRows = useMemo(
    () => flatRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [flatRows, safePage, pageSize]
  );

  const totalCount = searching ? flatRows.length : all.length;

  const clearFilters = () => {
    setQ('');
    setSearchDraft('');
    setStatusFilter('');
    setPage(1);
  };

  const handleSearchDraft = (value) => {
    setSearchDraft(value);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setQ(value);
      setPage(1);
    }, 300);
  };

  /* --------------------------- Thứ tự ↑↓ --------------------------- */

  const siblingInfo = (cat) => {
    const sibs = all.filter((c) => (c.parentId || null) === (cat.parentId || null)).sort(byOrderThenName);
    const idx = sibs.findIndex((c) => c.id === cat.id);
    return { isFirst: idx <= 0, isLast: idx === sibs.length - 1 };
  };

  const handleMove = async (cat, direction) => {
    setMovingId(cat.id);
    try {
      const group = await moveCategory(cat.id, direction);
      const orderMap = new Map((group || []).map((g) => [g.id, g.sortOrder]));
      setAll((prev) =>
        prev.map((c) => (orderMap.has(c.id) ? { ...c, sortOrder: orderMap.get(c.id) } : c))
      );
    } catch {
      // Lỗi: giữ nguyên bảng, chỉ báo toast (§4 — thành công thì không toast).
      onToast?.('Không đổi được thứ tự. Thử lại.');
    } finally {
      setMovingId(null);
    }
  };

  /* ------------------------------ Xóa ------------------------------ */

  const requestDelete = (cat) => {
    const kids = childrenByParent.get(cat.id) || [];
    if (cat.hasChildren || kids.length > 0) {
      setDialog({ type: 'children', category: cat });
    } else if ((cat.productCount || 0) > 0) {
      setDialog({ type: 'products', category: cat });
    } else {
      setDialog({ type: 'confirm', category: cat });
    }
  };

  const handleConfirmDelete = async () => {
    if (!dialog) return;
    const cat = dialog.category;
    setDialogBusy(true);
    try {
      await deleteCategory(cat.id);
      onToast?.('Đã xóa danh mục.');
      setDialog(null);
      const data = await load();
      // Cụm cha rỗng sau xóa → lùi 1 trang (§B.3).
      if (data && !searching && page > 1) {
        const rootCount = data.filter((c) => !c.parentId).length;
        if ((page - 1) * pageSize >= rootCount) setPage(page - 1);
      }
    } catch (e) {
      if (e?.code === 'HAS_CHILDREN') {
        setDialog({ type: 'children', category: cat });
      } else if (e?.code === 'HAS_PRODUCTS') {
        setDialog({
          type: 'products',
          category: { ...cat, productCount: e.productCount ?? cat.productCount },
        });
      } else {
        onToast?.(e?.message || 'Không xóa được danh mục. Vui lòng thử lại.');
        setDialog(null);
      }
    } finally {
      setDialogBusy(false);
    }
  };

  /* ------------------------------ Render ------------------------------ */

  const renderStatus = (cat) => {
    const kids = childrenByParent.get(cat.id) || [];
    const hasActiveChild = kids.some((k) => k.active !== false);
    return (
      <span className="cat-status">
        {cat.active !== false ? (
          <span className="admin-pill is-success">Đang hiển thị</span>
        ) : (
          <span className="admin-pill is-muted">Đã ẩn</span>
        )}
        {cat.active === false && hasActiveChild ? (
          <span className="cat-status__warn">
            <span aria-hidden="true">⚠</span> con cũng bị ẩn phía khách hàng
          </span>
        ) : null}
      </span>
    );
  };

  const renderCategoryCell = (cat, isChild) => (
    <div className={`cat-cell${isChild ? ' cat-cell--child' : ''}`}>
      {isChild ? (
        <span className="cat-cell__branch" aria-hidden="true">
          └
        </span>
      ) : null}
      {cat.imageUrl ? (
        <img className="prod-cell__img" src={cat.imageUrl} alt="" />
      ) : (
        <span className="prod-cell__img prod-cell__img--empty" aria-hidden="true">
          🗂️
        </span>
      )}
      <span className="prod-cell__meta">
        <span className={`prod-cell__name${isChild ? ' cat-cell__name--child' : ''}`}>{cat.name}</span>
        <span className="prod-cell__slug">{cat.slug}</span>
      </span>
    </div>
  );

  const renderOrderCell = (cat) => {
    if (searching) return <span>{cat.sortOrder}</span>;
    const { isFirst, isLast } = siblingInfo(cat);
    const busy = movingId !== null;
    return (
      <span className="cat-order" onClick={(e) => e.stopPropagation()}>
        <span className="cat-order__num">{cat.sortOrder}</span>
        <button
          type="button"
          className="cat-order__btn"
          disabled={isFirst || busy}
          onClick={() => handleMove(cat, 'up')}
          title="Lên"
          aria-label={`Đưa ${cat.name} lên`}
        >
          ↑
        </button>
        <button
          type="button"
          className="cat-order__btn"
          disabled={isLast || busy}
          onClick={() => handleMove(cat, 'down')}
          title="Xuống"
          aria-label={`Đưa ${cat.name} xuống`}
        >
          ↓
        </button>
      </span>
    );
  };

  const renderActions = (cat) => (
    <span className="row-actions" onClick={(e) => e.stopPropagation()}>
      {!cat.parentId ? (
        <button
          type="button"
          className="row-action-btn"
          onClick={() => setFormState({ categoryId: null, presetParentId: cat.id })}
          title="Thêm danh mục con"
        >
          Thêm danh mục con
        </button>
      ) : null}
      <a
        className="row-action-btn"
        href={`/danh-muc/${cat.slug}`}
        target="_blank"
        rel="noreferrer"
        title="Xem trên cửa hàng"
      >
        Xem
      </a>
      <button
        type="button"
        className="row-action-btn"
        onClick={() => setFormState({ categoryId: cat.id, presetParentId: null })}
        title="Sửa danh mục"
      >
        Sửa
      </button>
      <button
        type="button"
        className="row-action-btn is-danger"
        onClick={() => requestDelete(cat)}
        title="Xóa danh mục"
      >
        Xóa
      </button>
    </span>
  );

  const renderProductCount = (cat) =>
    (cat.productCount || 0) > 0 ? (
      <Link
        className="cat-count-link"
        to={`/admin/san-pham?categoryId=${cat.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        {cat.productCount}
      </Link>
    ) : (
      '0'
    );

  const colCount = searching ? 6 : 5;
  const isEmpty = !loading && !error && (searching ? flatRows.length === 0 : clusters.length === 0);

  const dialogChildren = dialog ? childrenByParent.get(dialog.category.id) || [] : [];

  return (
    <div className="admin-categories">
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-head__title">Danh mục</h2>
          <p className="admin-page-head__count">
            {all.length} danh mục · {roots.length} danh mục gốc
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setFormState({ categoryId: null, presetParentId: null })}
        >
          + Thêm danh mục
        </button>
      </div>

      <div className="data-table-card">
        <div className="data-table__toolbar">
          <div className="data-table__search">
            <span className="data-table__search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => handleSearchDraft(e.target.value)}
              placeholder="Tìm theo tên danh mục, slug…"
              aria-label="Tìm theo tên danh mục, slug…"
            />
          </div>
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo trạng thái"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hiển thị</option>
            <option value="false">Đã ẩn</option>
          </select>
        </div>

        <div className="data-table__scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Danh mục</th>
                {searching ? <th>Danh mục cha</th> : null}
                <th>Số sản phẩm</th>
                <th>Thứ tự</th>
                <th>Trạng thái</th>
                <th className="is-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="data-table__skeleton-row">
                    <td colSpan={colCount}>
                      <div className="skeleton data-table__skel" aria-hidden="true" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={colCount}>
                    <div className="data-table__state">
                      <p>Không tải được dữ liệu.</p>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                        Thử lại
                      </button>
                    </div>
                  </td>
                </tr>
              ) : isEmpty ? (
                <tr>
                  <td colSpan={colCount}>
                    <div className="data-table__state">
                      {filtering ? (
                        <>
                          <p>Không tìm thấy danh mục phù hợp.</p>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={clearFilters}
                          >
                            Xóa bộ lọc
                          </button>
                        </>
                      ) : (
                        <>
                          <p>Chưa có danh mục nào</p>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setFormState({ categoryId: null, presetParentId: null })}
                          >
                            + Thêm danh mục
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : searching ? (
                pageFlatRows.map((cat) => (
                  <tr
                    key={cat.id}
                    className="is-clickable"
                    onClick={() => setFormState({ categoryId: cat.id, presetParentId: null })}
                  >
                    <td>{renderCategoryCell(cat, false)}</td>
                    <td>{cat.parentId ? byId.get(cat.parentId)?.name || '—' : '—'}</td>
                    <td>{renderProductCount(cat)}</td>
                    <td>{renderOrderCell(cat)}</td>
                    <td>{renderStatus(cat)}</td>
                    <td className="is-right">{renderActions(cat)}</td>
                  </tr>
                ))
              ) : (
                pageClusters.map(({ root, kids, rootVisible }) => [
                  rootVisible ? (
                    <tr
                      key={root.id}
                      className="is-clickable"
                      onClick={() => setFormState({ categoryId: root.id, presetParentId: null })}
                    >
                      <td>{renderCategoryCell(root, false)}</td>
                      <td>{renderProductCount(root)}</td>
                      <td>{renderOrderCell(root)}</td>
                      <td>{renderStatus(root)}</td>
                      <td className="is-right">{renderActions(root)}</td>
                    </tr>
                  ) : null,
                  ...kids.map((cat) => (
                    <tr
                      key={cat.id}
                      className="is-clickable"
                      onClick={() => setFormState({ categoryId: cat.id, presetParentId: null })}
                    >
                      <td>{renderCategoryCell(cat, true)}</td>
                      <td>{renderProductCount(cat)}</td>
                      <td>{renderOrderCell(cat)}</td>
                      <td>{renderStatus(cat)}</td>
                      <td className="is-right">{renderActions(cat)}</td>
                    </tr>
                  )),
                ])
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && !isEmpty ? (
          <div className="data-table__footer">
            <span className="data-table__pageinfo">
              Trang {safePage} / {totalPages} · Tổng {totalCount} danh mục
            </span>
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
            <label className="data-table__pagesize">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Số mục mỗi trang"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / trang
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      <p className="admin-categories__note">
        Thứ tự hiển thị áp dụng cho danh mục nổi bật ở trang chủ và menu cửa hàng. Chỉ danh mục
        đang hiển thị mới xuất hiện phía khách hàng.
      </p>

      {formState ? (
        <CategoryFormModal
          key={formState.categoryId || `new-${formState.presetParentId || 'root'}`}
          categoryId={formState.categoryId}
          presetParentId={formState.presetParentId}
          categories={all}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            onToast?.('Đã lưu danh mục.');
            load();
          }}
          onToast={onToast}
        />
      ) : null}

      {/* §5.1 — còn danh mục con: chặn, không có nút Xóa */}
      <AdminModal
        open={dialog?.type === 'children'}
        title="Chưa thể xóa danh mục"
        onClose={() => setDialog(null)}
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>
            Đã hiểu
          </button>
        }
      >
        {dialog?.type === 'children' ? (
          <p>
            Danh mục <strong>{dialog.category.name}</strong> đang có {dialogChildren.length} danh
            mục con ({dialogChildren.map((c) => c.name).join(', ')}). Hãy xóa hoặc chuyển các danh
            mục con sang danh mục cha khác trước khi xóa danh mục này.
          </p>
        ) : null}
      </AdminModal>

      {/* §5.2 — còn sản phẩm: chặn + đường thoát sang màn Sản phẩm */}
      <AdminModal
        open={dialog?.type === 'products'}
        title="Chưa thể xóa danh mục"
        onClose={() => setDialog(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>
              Đã hiểu
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const id = dialog.category.id;
                setDialog(null);
                navigate(`/admin/san-pham?categoryId=${id}`);
              }}
            >
              Xem sản phẩm
            </button>
          </>
        }
      >
        {dialog?.type === 'products' ? (
          <p>
            Danh mục <strong>{dialog.category.name}</strong> đang có {dialog.category.productCount}{' '}
            sản phẩm nên không thể xóa. Hãy chuyển các sản phẩm sang danh mục khác ở màn Sản phẩm,
            hoặc tắt hiển thị danh mục này nếu chỉ muốn ẩn khỏi cửa hàng.
          </p>
        ) : null}
      </AdminModal>

      {/* §5.3 — rỗng cả con lẫn sản phẩm: confirm xóa cứng */}
      <ConfirmDialog
        open={dialog?.type === 'confirm'}
        title="Xóa danh mục?"
        confirmLabel="Xóa"
        loading={dialogBusy}
        onCancel={() => setDialog(null)}
        onConfirm={handleConfirmDelete}
      >
        {dialog?.type === 'confirm' ? (
          <p>
            Bạn sắp xóa danh mục <strong>{dialog.category.name}</strong> ({dialog.category.slug}).
            Thao tác này không thể hoàn tác.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
