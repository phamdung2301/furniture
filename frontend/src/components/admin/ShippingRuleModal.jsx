import { useMemo, useState } from 'react';
import AdminModal from './AdminModal';
import {
  createShippingRule,
  findShippingGaps,
  shippingTierLabel,
  updateShippingRule,
} from '../../api/adminPromoApi';
import { formatAreaM2 } from '../../api/shippingApi';
import { formatVND } from '../../utils/format';

/**
 * Form thêm/sửa bậc phí vận chuyển — modal 520px, admin-flash-sale-shipping.md
 * §5.2.1 (FR-029 · F-023 · US-021).
 * Validate: max > min; chồng lấp với bậc active khác = chặn cứng, banner nêu
 * rõ bậc bị chồng (FE + BE 422); lỗ hổng phủ chỉ cảnh báo. Mọi lần lưu đều qua
 * confirm §5.5 (tóm tắt thay đổi + phạm vi áp dụng cho đơn tạo mới) TRƯỚC khi
 * gọi API — component tự chứa confirm đó và chỉ gọi onSaved sau khi lưu xong.
 */

export const SHIPPING_APPLY_NOTE =
  'Áp dụng cho đơn hàng tạo mới kể từ lúc lưu. Các đơn đã tạo giữ nguyên phí vận chuyển đã chốt trong đơn. Khách đang ở bước đặt hàng sẽ thấy phí theo cấu hình mới khi bấm đặt hàng.';

function Field({ label, required, error, hint, warn, children }) {
  return (
    <div className={`pf-field${error ? ' has-error' : ''}`} data-invalid={error ? 'true' : undefined}>
      <label className="pf-field__label">
        {label}
        {required ? <span className="pf-required"> *</span> : null}
      </label>
      {children}
      {error ? <p className="pf-field__error">{error}</p> : null}
      {!error && warn ? <p className="voucher-warn-text">{warn}</p> : null}
      {!error && !warn && hint ? <p className="pf-field__hint">{hint}</p> : null}
    </div>
  );
}

/** Chồng lấp theo biên findTier: chạm đúng 1 điểm biên KHÔNG tính chồng. */
function rangesOverlap(aMin, aMax, bMin, bMax) {
  const lo = Math.max(aMin, bMin);
  const hi = Math.min(aMax ?? Infinity, bMax ?? Infinity);
  return lo < hi;
}

export default function ShippingRuleModal({
  rule, // null = thêm mới
  rules = [], // toàn bộ bậc hiện tại (để validate chồng + dự tính lỗ hổng)
  maxAreaM2 = 10,
  onClose,
  onSaved, // (savedRule, isCreate) => void — trang tải lại bảng + toast
  onError, // (message) => void — toast đỏ khi API chặn ở phút chót
}) {
  const isEdit = Boolean(rule);
  const [min, setMin] = useState(isEdit ? String(rule.minAreaM2) : '');
  const [max, setMax] = useState(isEdit && rule.maxAreaM2 != null ? String(rule.maxAreaM2) : '');
  const [unlimitedMax, setUnlimitedMax] = useState(isEdit && rule.maxAreaM2 == null);
  const [fee, setFee] = useState(isEdit ? String(rule.fee) : '');
  const [active, setActive] = useState(isEdit ? rule.active !== false : true);
  const [errors, setErrors] = useState({});
  const [bannerError, setBannerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const minNum = min === '' ? null : Number(min);
  const maxNum = unlimitedMax || max === '' ? null : Number(max);
  const feeNum = fee === '' ? null : Number(fee);

  // Tạo bậc đầu tiên của bảng mà min > 0 -> cảnh báo tại trường, không chặn (§5.2.1).
  const firstGapWarn =
    !isEdit && rules.length === 0 && minNum != null && minNum > 0
      ? `Đơn có diện tích nhỏ hơn ${formatAreaM2(minNum)} m² sẽ không có bậc phí.`
      : '';

  const buildBody = () => ({
    minAreaM2: minNum,
    maxAreaM2: unlimitedMax ? null : maxNum,
    fee: feeNum,
    active,
  });

  /** Dự tính lỗ hổng MỚI xuất hiện sau thay đổi này (cho confirm §5.5). */
  const gapNote = useMemo(() => {
    if (minNum == null || feeNum == null) return '';
    const body = buildBody();
    const next = isEdit
      ? rules.map((r) => (r.id === rule.id ? { ...r, ...body } : r))
      : [...rules, { id: '__new__', ...body }];
    const before = new Set(findShippingGaps(rules, maxAreaM2).map((g) => `${g.from}-${g.to}`));
    const fresh = findShippingGaps(next, maxAreaM2).filter(
      (g) => !before.has(`${g.from}-${g.to}`)
    );
    if (!fresh.length) return '';
    const parts = fresh.map((g) => `${formatAreaM2(g.from)} – ${formatAreaM2(g.to)} m²`);
    return `Thay đổi này tạo khoảng trống ${parts.join('; ')} chưa có bậc phí.`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minNum, maxNum, unlimitedMax, feeNum, active, rules, isEdit, maxAreaM2]);

  const summary = isEdit
    ? `Đổi bậc "${shippingTierLabel(rule.minAreaM2, rule.maxAreaM2)}" (phí ${formatVND(rule.fee)}) thành bậc "${shippingTierLabel(minNum ?? 0, unlimitedMax ? null : maxNum)}" (phí ${feeNum != null ? formatVND(feeNum) : '…'}${active ? '' : ', tắt áp dụng'}).`
    : `Thêm bậc phí "${shippingTierLabel(minNum ?? 0, unlimitedMax ? null : maxNum)}" (phí ${feeNum != null ? formatVND(feeNum) : '…'}).`;

  const validate = () => {
    const e = {};
    setBannerError('');
    if (minNum == null || Number.isNaN(minNum)) e.minAreaM2 = 'Diện tích "từ" là bắt buộc.';
    else if (minNum < 0) e.minAreaM2 = 'Diện tích "từ" không được âm.';
    else if (String(min).split('.')[1]?.length > 2)
      e.minAreaM2 = 'Diện tích chỉ nhập tối đa 2 số lẻ.';
    if (!unlimitedMax) {
      if (maxNum == null || Number.isNaN(maxNum))
        e.maxAreaM2 = 'Nhập diện tích "đến" hoặc chọn "Không giới hạn (trở lên)".';
      else if (minNum != null && maxNum <= minNum)
        e.maxAreaM2 = 'Diện tích "đến" phải lớn hơn diện tích "từ".';
      else if (String(max).split('.')[1]?.length > 2)
        e.maxAreaM2 = 'Diện tích chỉ nhập tối đa 2 số lẻ.';
    }
    if (feeNum == null || Number.isNaN(feeNum)) e.fee = 'Phí vận chuyển là bắt buộc.';
    else if (feeNum < 0) e.fee = 'Phí vận chuyển không được âm.';
    setErrors(e);
    if (Object.keys(e).length > 0) return false;
    if (active) {
      const dupOpen = rules.find(
        (r) => r.id !== rule?.id && r.active && r.maxAreaM2 == null && unlimitedMax
      );
      if (dupOpen) {
        setErrors({
          maxAreaM2: `Đã có bậc "trở lên" đang áp dụng (từ ${formatAreaM2(dupOpen.minAreaM2)} m²).`,
        });
        return false;
      }
      const hit = rules.find(
        (r) =>
          r.id !== rule?.id &&
          r.active &&
          rangesOverlap(minNum, unlimitedMax ? null : maxNum, Number(r.minAreaM2), r.maxAreaM2 == null ? null : Number(r.maxAreaM2))
      );
      if (hit) {
        setBannerError(
          `Khoảng ${formatAreaM2(minNum)} – ${unlimitedMax ? 'trở lên' : formatAreaM2(maxNum)} m² đang chồng với bậc ${formatAreaM2(hit.minAreaM2)} – ${hit.maxAreaM2 == null ? 'trở lên' : formatAreaM2(hit.maxAreaM2)} m² (phí ${formatVND(hit.fee)}). Hãy chỉnh lại khoảng.`
        );
        return false;
      }
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setConfirming(true); // confirm §5.5 trước khi gọi API
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const body = buildBody();
      const saved = isEdit
        ? await updateShippingRule(rule.id, body)
        : await createShippingRule(body);
      setConfirming(false);
      onSaved?.(saved, !isEdit);
    } catch (err) {
      setConfirming(false);
      const msg = err?.message || 'Không lưu được bậc phí. Vui lòng thử lại.';
      if (err?.field) {
        setErrors((prev) => ({ ...prev, [err.field]: msg }));
      } else if (err?.status === 422) {
        setBannerError(msg);
      } else {
        onError?.(msg);
        onClose?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
        Hủy
      </button>
      <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
        Lưu bậc phí
      </button>
    </>
  );

  return (
    <>
      <AdminModal
        open={!confirming}
        title={isEdit ? 'Sửa bậc phí' : 'Thêm bậc phí'}
        onClose={saving ? undefined : onClose}
        footer={footer}
      >
        {bannerError ? <div className="promo-banner is-error">{bannerError}</div> : null}
        <Field label="Từ (m²)" required error={errors.minAreaM2} warn={firstGapWarn}>
          <input
            type="number"
            className="pf-input"
            min="0"
            step="0.01"
            value={min}
            onChange={(ev) => setMin(ev.target.value)}
            placeholder="VD: 3"
          />
        </Field>
        <Field label="Đến (m²)" error={errors.maxAreaM2}>
          <div className="voucher-suffix">
            <input
              type="number"
              className="pf-input"
              min="0"
              step="0.01"
              value={max}
              onChange={(ev) => setMax(ev.target.value)}
              disabled={unlimitedMax}
              placeholder="VD: 6"
            />
            <label className="voucher-unlimited">
              <input
                type="checkbox"
                checked={unlimitedMax}
                onChange={(ev) => setUnlimitedMax(ev.target.checked)}
              />
              Không giới hạn (trở lên)
            </label>
          </div>
        </Field>
        <Field label="Phí" required error={errors.fee} hint="Nhập 0 = miễn phí cho bậc này.">
          <div className="voucher-suffix">
            <input
              type="number"
              className="pf-input"
              min="0"
              value={fee}
              onChange={(ev) => setFee(ev.target.value)}
              placeholder="VD: 350000"
            />
            <span className="voucher-suffix__unit">đ</span>
          </div>
        </Field>
        <div className="pf-switch-row">
          <div className="pf-switch-row__text">
            <span className="pf-switch-row__label">Áp dụng bậc này</span>
            <span className="pf-field__hint">
              Tắt = bậc không tham gia tính phí (có thể tạo khoảng trống trong bảng phí).
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label="Áp dụng bậc này"
            className={`pf-switch${active ? ' is-on' : ''}`}
            onClick={() => setActive((v) => !v)}
          >
            <span className="pf-switch__dot" />
          </button>
        </div>
      </AdminModal>

      {/* Confirm §5.5 — tóm tắt + phạm vi áp dụng, nút Primary (không phải thao tác nguy hiểm) */}
      <AdminModal
        open={confirming}
        title="Lưu bậc phí?"
        onClose={saving ? undefined : () => setConfirming(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirming(false)}
              disabled={saving}
            >
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={doSave} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        }
      >
        <div className="confirm-dialog__body">
          <p>{summary}</p>
          {gapNote ? <p className="voucher-warn-text">{gapNote}</p> : null}
          <p>{SHIPPING_APPLY_NOTE}</p>
        </div>
      </AdminModal>
    </>
  );
}
