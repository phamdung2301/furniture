import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import BannerFormSlideOver from '../../components/admin/BannerFormSlideOver';
import {
  deleteBanner,
  listBanners,
  patchBanner,
  reorderBanners,
} from '../../api/adminBannerApi';

/**
 * Quản lý banner — màn 21 · FR-027 · F-021 (admin-banner.md).
 * Danh sách dạng THẺ preview lớn tỉ lệ hero 21/8 (không DataTable — banner là
 * nội dung hình ảnh, §2.1). Thứ tự: kéo-thả tay kéo ⠿ hoặc nút ↑↓, cả hai đi
 * qua PUT /admin/banners/reorder với toàn bộ ids; backend chuẩn hoá 1..n.
 * Cập nhật lạc quan + khôi phục khi lỗi API (§3). Tắt ≠ Xóa (§6).
 */

const bySortOrder = (a, b) => a.sortOrder - b.sortOrder;

function BannerPreviewImage({ banner }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [banner.imageUrl]);
  if (!banner.imageUrl || broken) {
    return (
      <div className="banner-card__img is-broken" aria-label="Ảnh lỗi">
        <span aria-hidden="true">🖼️</span>
        <span>Ảnh lỗi</span>
      </div>
    );
  }
  return (
    <div className={`banner-card__img${banner.active ? '' : ' is-off'}`}>
      <img src={banner.imageUrl} alt="" loading="lazy" onError={() => setBroken(true)} />
      <div className="banner-card__overlay" />
      <div className="banner-card__hero-text">
        <span className="banner-card__hero-title">{banner.title}</span>
        {banner.subtitle ? (
          <span className="banner-card__hero-sub">{banner.subtitle}</span>
        ) : null}
        <span className="btn btn-primary btn-sm banner-card__hero-cta">
          {banner.ctaText || 'Mua ngay'}
        </span>
      </div>
    </div>
  );
}

export default function AdminBannersPage() {
  const { onToast } = useOutletContext();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formState, setFormState] = useState(null); // { bannerId } | null
  const [deleteTarget, setDeleteTarget] = useState(null); // { banner, position }
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const reorderBusyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBanners();
      setBanners([...(data || [])].sort(bySortOrder));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = banners.filter((b) => b.active).length;

  /* --------------------------- Thứ tự (§3) --------------------------- */

  const applyReorder = async (nextList) => {
    if (reorderBusyRef.current) return;
    const prevList = banners;
    reorderBusyRef.current = true;
    setReordering(true);
    // Cập nhật lạc quan: thẻ ở ngay vị trí mới, số thứ tự chuẩn hoá 1..n.
    setBanners(nextList.map((b, i) => ({ ...b, sortOrder: i + 1 })));
    try {
      const result = await reorderBanners(nextList.map((b) => b.id));
      const orderMap = new Map((result || []).map((r) => [r.id, r.sortOrder]));
      setBanners((prev) =>
        [...prev]
          .map((b) => (orderMap.has(b.id) ? { ...b, sortOrder: orderMap.get(b.id) } : b))
          .sort(bySortOrder)
      );
    } catch {
      setBanners(prevList);
      onToast?.('Không đổi được thứ tự. Thử lại.');
    } finally {
      reorderBusyRef.current = false;
      setReordering(false);
    }
  };

  const handleMove = (banner, direction) => {
    const idx = banners.findIndex((b) => b.id === banner.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= banners.length) return;
    const next = [...banners];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    applyReorder(next);
  };

  const handleDrop = (targetId) => {
    const from = banners.findIndex((b) => b.id === dragId);
    const to = banners.findIndex((b) => b.id === targetId);
    setDragId(null);
    setDragOverId(null);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...banners];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    applyReorder(next);
  };

  /* --------------------------- Bật / tắt (§6.1) --------------------------- */

  const handleToggle = async (banner) => {
    if (togglingId) return;
    const nextActive = !banner.active;
    setTogglingId(banner.id);
    setBanners((prev) =>
      prev.map((b) => (b.id === banner.id ? { ...b, active: nextActive } : b))
    );
    try {
      await patchBanner(banner.id, { active: nextActive });
      // Thành công: không toast — badge + ảnh mờ/sáng đã thấy ngay (§6.1).
    } catch {
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, active: banner.active } : b))
      );
      onToast?.('Không đổi được trạng thái banner. Thử lại.');
    } finally {
      setTogglingId(null);
    }
  };

  /* ------------------------------ Xóa (§6.2) ------------------------------ */

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteBanner(deleteTarget.banner.id);
      onToast?.('Đã xóa banner.');
      setDeleteTarget(null);
      await load();
    } catch (e) {
      onToast?.(e?.message || 'Không xóa được banner. Vui lòng thử lại.');
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleSaved = async () => {
    setFormState(null);
    onToast?.('Đã lưu banner.');
    await load();
  };

  /* ------------------------------ Render ------------------------------ */

  return (
    <div className="admin-banners">
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-head__title">Banner trang chủ</h2>
          <p className="admin-page-head__count">
            {banners.length} banner · {activeCount} đang hiện
          </p>
        </div>
        <div className="admin-banners__head-actions">
          <a className="btn btn-text" href="/" target="_blank" rel="noreferrer">
            Xem trang chủ ↗
          </a>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormState({ bannerId: null })}
          >
            + Thêm banner
          </button>
        </div>
      </div>

      {!loading && !error && banners.length > 0 && activeCount === 0 ? (
        <div className="banner-warning" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>
            Hiện không có banner nào đang bật — trang chủ sẽ{' '}
            <strong>không hiển thị khối banner</strong> ở đầu trang.
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="banner-list" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`sk-${i}`} className="banner-card banner-card--skeleton">
              <div className="skeleton banner-card__skel-img" />
              <div className="banner-card__skel-lines">
                <div className="skeleton" style={{ height: 18, width: '60%' }} />
                <div className="skeleton" style={{ height: 14, width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="admin-card banner-state">
          <p className="banner-state__icon" aria-hidden="true">
            ⚠
          </p>
          <p>Không tải được danh sách banner.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            Thử lại
          </button>
        </div>
      ) : banners.length === 0 ? (
        <div className="admin-card banner-state">
          <p className="banner-state__icon" aria-hidden="true">
            🖼️
          </p>
          <h3 className="banner-state__title">Chưa có banner nào</h3>
          <p>
            Trang chủ hiện không hiển thị khối banner ở đầu trang (các khối sản phẩm bên dưới
            vẫn hiển thị bình thường).
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setFormState({ bannerId: null })}
          >
            + Thêm banner
          </button>
        </div>
      ) : (
        <>
          <div className="banner-list">
            {banners.map((banner, idx) => (
              <article
                key={banner.id}
                className={`banner-card${dragId === banner.id ? ' is-dragging' : ''}${
                  dragOverId === banner.id && dragId !== banner.id ? ' is-drop-target' : ''
                }`}
                onDragOver={(e) => {
                  if (dragId && dragId !== banner.id) {
                    e.preventDefault();
                    setDragOverId(banner.id);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(banner.id);
                }}
              >
                <div
                  className="banner-card__handle"
                  draggable={!reordering}
                  onDragStart={(e) => {
                    setDragId(banner.id);
                    e.dataTransfer.effectAllowed = 'move';
                    try {
                      e.dataTransfer.setData('text/plain', banner.id);
                    } catch {
                      /* một số trình duyệt không cho setData ngoài drag — bỏ qua */
                    }
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverId(null);
                  }}
                  title="Kéo để đổi thứ tự"
                  aria-label={`Kéo để đổi thứ tự banner ${banner.title || idx + 1}`}
                  role="button"
                  tabIndex={-1}
                >
                  ⠿
                </div>

                <button
                  type="button"
                  className="banner-card__preview-btn"
                  onClick={() => setFormState({ bannerId: banner.id })}
                  title="Sửa banner"
                >
                  <BannerPreviewImage banner={banner} />
                </button>

                <div className="banner-card__info">
                  <div className="banner-card__title-row">
                    <span className="banner-card__order">#{idx + 1}</span>
                    <button
                      type="button"
                      className="banner-card__title"
                      onClick={() => setFormState({ bannerId: banner.id })}
                      title={banner.title}
                    >
                      {banner.title || '—'}
                    </button>
                    {banner.active ? (
                      <span className="admin-pill is-success">Đang hiện</span>
                    ) : (
                      <span className="admin-pill is-muted">Đã tắt</span>
                    )}
                  </div>
                  <p className="banner-card__subtitle">{banner.subtitle || '—'}</p>
                  <div className="banner-card__link-row">
                    <span className="banner-card__cta-chip">{banner.ctaText || 'Mua ngay'}</span>
                    <span className="banner-card__link">{banner.linkUrl}</span>
                    <a
                      className="banner-card__open"
                      href={banner.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Mở link đích để kiểm tra"
                      aria-label={`Mở link đích của banner ${banner.title || idx + 1}`}
                    >
                      ↗
                    </a>
                  </div>
                </div>

                <div className="banner-card__side">
                  <div className="banner-card__toggle-row">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={banner.active}
                      aria-label={banner.active ? 'Đang hiện' : 'Đã tắt'}
                      className={`pf-switch${banner.active ? ' is-on' : ''}`}
                      onClick={() => handleToggle(banner)}
                      disabled={togglingId === banner.id}
                    >
                      <span className="pf-switch__dot" />
                    </button>
                  </div>
                  <div className="banner-card__actions">
                    <button
                      type="button"
                      className="cat-order__btn"
                      disabled={idx === 0 || reordering}
                      onClick={() => handleMove(banner, 'up')}
                      title="Lên"
                      aria-label={`Đưa banner ${banner.title || idx + 1} lên`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="cat-order__btn"
                      disabled={idx === banners.length - 1 || reordering}
                      onClick={() => handleMove(banner, 'down')}
                      title="Xuống"
                      aria-label={`Đưa banner ${banner.title || idx + 1} xuống`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => setFormState({ bannerId: banner.id })}
                      title="Sửa banner"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="row-action-btn is-danger"
                      onClick={() =>
                        setDeleteTarget({ banner, position: idx + 1 })
                      }
                      title="Xóa banner"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="admin-banners__note">
            Thứ tự và trạng thái bật/tắt ở đây áp dụng ngay cho khối banner đầu trang chủ.
            Kéo-thả hoặc dùng nút ↑ ↓ để đổi thứ tự.
          </p>
        </>
      )}

      {formState ? (
        <BannerFormSlideOver
          key={formState.bannerId || 'new'}
          bannerId={formState.bannerId}
          banners={banners}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
          onToast={onToast}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa banner?"
        confirmLabel="Xóa"
        loading={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      >
        {deleteTarget ? (
          <>
            <p>
              Bạn sắp xóa banner{' '}
              {deleteTarget.banner.title ? (
                <strong>{deleteTarget.banner.title}</strong>
              ) : (
                <>ở thứ tự #{deleteTarget.position}</>
              )}{' '}
              (thứ tự #{deleteTarget.position}). Thao tác này không thể hoàn tác.
            </p>
            <p>Nếu chỉ muốn ẩn tạm khỏi trang chủ, hãy Hủy và tắt banner thay vì xóa.</p>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
