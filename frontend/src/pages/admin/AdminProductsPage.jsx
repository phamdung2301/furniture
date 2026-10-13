import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/admin/DataTable';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import ProductFormSlideOver from '../../components/admin/ProductFormSlideOver';
import { formatVND } from '../../utils/format';
import {
  deleteProduct,
  listCategories,
  listProducts,
  patchProduct,
} from '../../api/adminProductApi';

/**
 * Quản lý sản phẩm — màn 15 · FR-020 · F-014 · US-013 (admin-san-pham.md).
 * DataTable §B.1: tìm theo tên/SKU, lọc danh mục + trạng thái, sort, phân trang.
 * Xóa cứng khi chưa có đơn; đã có đơn → Ngừng bán (F-014, §5).
 */

// DataTable sort {key, dir} <-> sort param của API (§6).
const SORT_TO_API = {
  name: (dir) => (dir === 'desc' ? 'name_desc' : 'name_asc'),
  minPrice: (dir) => (dir === 'desc' ? 'price_desc' : 'price_asc'),
  totalStock: (dir) => (dir === 'desc' ? 'stock_desc' : 'stock_asc'),
};
const API_TO_SORT = {
  newest: null,
  name_asc: { key: 'name', dir: 'asc' },
  name_desc: { key: 'name', dir: 'desc' },
  price_asc: { key: 'minPrice', dir: 'asc' },
  price_desc: { key: 'minPrice', dir: 'desc' },
  stock_asc: { key: 'totalStock', dir: 'asc' },
  stock_desc: { key: 'totalStock', dir: 'desc' },
};

export default function AdminProductsPage() {
  const { onToast } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  // Lọc sẵn theo danh mục khi sang từ màn Danh mục (cột Số sản phẩm, §2.3 màn 16)
  // hoặc dialog chặn xóa "Xem sản phẩm": /admin/san-pham?categoryId={id}.
  const [categoryId, setCategoryId] = useState(() => searchParams.get('categoryId') || '');
  const [activeFilter, setActiveFilter] = useState('');
  const [sortApi, setSortApi] = useState('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [formState, setFormState] = useState(null); // { productId: string | null }
  const [confirm, setConfirm] = useState(null); // { product, mode: 'delete' | 'stop' }
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [patchingId, setPatchingId] = useState(null);

  // Tìm kiếm nhanh ở topbar điều hướng sang đây kèm ?q= (§A.3);
  // màn Danh mục sang kèm ?categoryId= (điều hướng lại khi đang ở sẵn màn này).
  useEffect(() => {
    const next = searchParams.get('q') || '';
    setQ((prev) => (prev === next ? prev : next));
    const nextCategory = searchParams.get('categoryId') || '';
    setCategoryId((prev) => (prev === nextCategory ? prev : nextCategory));
    if (searchParams.get('categoryId')) setPage(1);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    listCategories()
      .then((cats) => {
        if (!cancelled) setCategories(cats || []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProducts({
        q,
        categoryId,
        active: activeFilter === '' ? '' : activeFilter === 'true',
        sort: sortApi,
        page,
        size: pageSize,
      });
      setData(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [q, categoryId, activeFilter, sortApi, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const hasActiveFilter = Boolean(q || categoryId || activeFilter);
  const clearFilters = () => {
    setQ('');
    setCategoryId('');
    setActiveFilter('');
    setPage(1);
  };

  const categoryOptions = useMemo(() => {
    const roots = categories.filter((c) => !c.parentId);
    const out = [];
    roots.forEach((r) => {
      out.push({ id: r.id, label: r.name });
      categories
        .filter((c) => c.parentId === r.id)
        .forEach((c) => out.push({ id: c.id, label: `— ${c.name}` }));
    });
    categories
      .filter((c) => c.parentId && !roots.some((r) => r.id === c.parentId))
      .forEach((c) => out.push({ id: c.id, label: c.name }));
    return out;
  }, [categories]);

  /* ------------------------- Hành động hàng ------------------------- */

  const toggleFeatured = async (row) => {
    try {
      await patchProduct(row.id, { featured: !row.featured });
      onToast?.(row.featured ? 'Đã tắt nổi bật.' : 'Đã bật nổi bật.');
      load();
    } catch (e) {
      onToast?.(e?.message || 'Không cập nhật được sản phẩm.');
    }
  };

  const resumeSelling = async (row) => {
    setPatchingId(row.id);
    try {
      await patchProduct(row.id, { active: true });
      onToast?.('Đã mở bán lại sản phẩm.');
      load();
    } catch (e) {
      onToast?.(e?.message || 'Không cập nhật được sản phẩm.');
    } finally {
      setPatchingId(null);
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { product, mode } = confirm;
    setConfirmBusy(true);
    try {
      if (mode === 'delete') {
        try {
          await deleteProduct(product.id);
        } catch (e) {
          // Dữ liệu đổi giữa chừng: đã có đơn -> chuyển sang confirm ngừng bán (§5).
          if (e?.code === 'HAS_ORDERS') {
            setConfirm({ product: { ...product, hasOrders: true }, mode: 'stop' });
            return;
          }
          throw e;
        }
        onToast?.('Đã xóa sản phẩm.');
        setConfirm(null);
        // Trang rỗng sau xóa -> lùi 1 trang (§B.3).
        if (data.content.length === 1 && page > 1) setPage(page - 1);
        else load();
      } else {
        await patchProduct(product.id, { active: false });
        onToast?.('Đã ngừng bán sản phẩm.');
        setConfirm(null);
        load();
      }
    } catch (e) {
      onToast?.(e?.message || 'Thao tác thất bại. Vui lòng thử lại.');
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  /* ------------------------------ Cột bảng ------------------------------ */

  const columns = [
    {
      key: 'name',
      label: 'Sản phẩm',
      sortable: true,
      render: (row) => (
        <div className="prod-cell">
          {row.image ? (
            <img className="prod-cell__img" src={row.image} alt="" />
          ) : (
            <span className="prod-cell__img prod-cell__img--empty" aria-hidden="true">
              🛋️
            </span>
          )}
          <span className="prod-cell__meta">
            <span className="prod-cell__name">{row.name}</span>
            <span className="prod-cell__slug">{row.slug}</span>
          </span>
        </div>
      ),
    },
    { key: 'categoryName', label: 'Danh mục' },
    {
      key: 'variantCount',
      label: 'Số màu',
      render: (row) => (
        <span className="prod-colors">
          <span>{row.variantCount}</span>
          <span className="color-dots">
            {(row.colorHexes || []).slice(0, 5).map((hex, i) => (
              <span
                key={i}
                className="color-dot"
                style={{ background: hex }}
                aria-hidden="true"
              />
            ))}
            {row.colorHexes?.length > 5 ? (
              <span className="color-dots__more">+{row.colorHexes.length - 5}</span>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      key: 'minPrice',
      label: 'Giá từ',
      sortable: true,
      align: 'right',
      render: (row) => (row.minPrice != null ? formatVND(row.minPrice) : '—'),
    },
    {
      key: 'totalStock',
      label: 'Tổng tồn',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="prod-stock">
          <span>{row.totalStock}</span>
          {row.totalStock === 0 ? (
            <span className="admin-pill is-error">Hết hàng</span>
          ) : row.lowStockVariantCount > 0 ? (
            <span className="prod-stock__warn">
              <span aria-hidden="true">⚠</span> {row.lowStockVariantCount} màu sắp hết
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'active',
      label: 'Trạng thái',
      render: (row) =>
        row.active ? (
          <span className="admin-pill is-success">Đang bán</span>
        ) : (
          <span className="admin-pill is-muted">Ngừng bán</span>
        ),
    },
    {
      key: 'featured',
      label: 'Nổi bật',
      align: 'center',
      render: (row) => (
        <button
          type="button"
          className={`star-btn${row.featured ? ' is-on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFeatured(row);
          }}
          title={row.featured ? 'Tắt nổi bật' : 'Bật nổi bật'}
          aria-label={row.featured ? `Tắt nổi bật ${row.name}` : `Bật nổi bật ${row.name}`}
        >
          {row.featured ? '★' : '—'}
        </button>
      ),
    },
    {
      key: 'actions',
      label: 'Hành động',
      align: 'right',
      render: (row) => (
        <span className="row-actions" onClick={(e) => e.stopPropagation()}>
          <a
            className="row-action-btn"
            href={`/san-pham/${row.slug}`}
            target="_blank"
            rel="noreferrer"
            title="Xem trên cửa hàng"
          >
            Xem
          </a>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => setFormState({ productId: row.id })}
            title="Sửa sản phẩm"
          >
            Sửa
          </button>
          {row.hasOrders ? (
            row.active ? (
              <button
                type="button"
                className="row-action-btn is-danger"
                onClick={() => setConfirm({ product: row, mode: 'stop' })}
                title="Ngừng bán sản phẩm"
              >
                Ngừng bán
              </button>
            ) : (
              <button
                type="button"
                className="row-action-btn"
                onClick={() => resumeSelling(row)}
                disabled={patchingId === row.id}
                title="Mở bán lại sản phẩm"
              >
                Đang bán lại
              </button>
            )
          ) : (
            <button
              type="button"
              className="row-action-btn is-danger"
              onClick={() => setConfirm({ product: row, mode: 'delete' })}
              title="Xóa sản phẩm"
            >
              Xóa
            </button>
          )}
        </span>
      ),
    },
  ];

  const filtersNode = (
    <>
      <select
        className="admin-filter-select"
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value);
          setPage(1);
        }}
        aria-label="Lọc theo danh mục"
      >
        <option value="">Tất cả danh mục</option>
        {categoryOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className="admin-filter-select"
        value={activeFilter}
        onChange={(e) => {
          setActiveFilter(e.target.value);
          setPage(1);
        }}
        aria-label="Lọc theo trạng thái"
      >
        <option value="">Tất cả trạng thái</option>
        <option value="true">Đang bán</option>
        <option value="false">Ngừng bán</option>
      </select>
    </>
  );

  return (
    <div className="admin-products">
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-head__title">Sản phẩm</h2>
          <p className="admin-page-head__count">{data.totalElements} sản phẩm</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setFormState({ productId: null })}
        >
          + Thêm sản phẩm
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={data.content}
        loading={loading}
        error={error}
        onRetry={load}
        searchValue={q}
        onSearchChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Tìm theo tên sản phẩm, SKU…"
        filters={filtersNode}
        sort={API_TO_SORT[sortApi]}
        onSortChange={({ key, dir }) => {
          const toApi = SORT_TO_API[key];
          if (toApi) setSortApi(toApi(dir));
          setPage(1);
        }}
        page={page}
        totalPages={data.totalPages}
        totalItems={data.totalElements}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        emptyText={
          hasActiveFilter ? 'Không tìm thấy sản phẩm phù hợp.' : 'Chưa có sản phẩm nào'
        }
        hasActiveFilter={hasActiveFilter}
        onClearFilter={clearFilters}
        onRowClick={(row) => setFormState({ productId: row.id })}
      />

      {formState ? (
        <ProductFormSlideOver
          key={formState.productId || 'new'}
          productId={formState.productId}
          categories={categories}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            onToast?.('Đã lưu sản phẩm.');
            load();
          }}
          onToast={onToast}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.mode === 'stop' ? 'Ngừng bán sản phẩm?' : 'Xóa sản phẩm?'}
        confirmLabel={confirm?.mode === 'stop' ? 'Ngừng bán' : 'Xóa'}
        loading={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirm}
      >
        {confirm?.mode === 'stop' ? (
          <p>
            Sản phẩm <strong>{confirm.product.name}</strong> đã có trong đơn hàng nên không thể
            xóa. Ngừng bán sẽ ẩn sản phẩm khỏi cửa hàng, đơn hàng cũ không bị ảnh hưởng.
          </p>
        ) : confirm ? (
          <p>
            Bạn sắp xóa <strong>{confirm.product.name}</strong> cùng {confirm.product.variantCount}{' '}
            màu và toàn bộ ảnh. Thao tác này không thể hoàn tác.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
