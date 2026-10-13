/**
 * Bước 2 — Mã ưu đãi — spec §3.
 * Ô nhập mã (tự uppercase) + nút "Áp dụng"; danh sách mã khả dụng;
 * mã chưa đủ điều kiện hiện mờ + lý do; đã áp -> badge "Đã áp dụng" + nút "Gỡ".
 * Mỗi đơn chỉ 1 voucher (FR-019).
 */
import { useState } from 'react';
import { formatVND } from '../utils/format';

async function copyText(text, onToast) {
  try {
    await navigator.clipboard.writeText(text);
    onToast?.('Đã sao chép mã ưu đãi.');
  } catch {
    onToast?.('Không sao chép được, bạn vui lòng nhập tay mã này.');
  }
}

export default function VoucherSection({
  vouchers = [],
  loading = false,
  appliedCode = null,
  appliedDiscount = 0,
  applying = false,
  applyError = '',
  onApply,
  onRemove,
  onToast,
}) {
  const [code, setCode] = useState('');

  const handleApply = (raw) => {
    const normalized = String(raw || code).trim().toUpperCase();
    if (!normalized || applying) return;
    onApply?.(normalized);
    setCode('');
  };

  return (
    <div className="co-voucher">
      <div className="co-voucher__inputrow">
        <input
          className="co-input co-voucher__input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApply();
            }
          }}
          placeholder="Nhập mã ưu đãi"
          aria-label="Nhập mã ưu đãi"
          maxLength={20}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!code.trim() || applying}
          onClick={() => handleApply()}
        >
          {applying ? <span className="btn-spinner" aria-hidden="true" /> : null}
          Áp dụng
        </button>
      </div>
      {applyError && (
        <p className="co-voucher__error" role="alert">
          {applyError}
        </p>
      )}

      <h3 className="co-voucher__listtitle">Mã ưu đãi của bạn</h3>
      {loading ? (
        <div className="co-voucher__loading" aria-label="Đang tải mã ưu đãi">
          {[0, 1].map((i) => (
            <div className="skeleton co-voucher__skeleton" key={i} aria-hidden="true" />
          ))}
        </div>
      ) : vouchers.length === 0 ? (
        <p className="co-voucher__empty">Hiện chưa có mã ưu đãi nào.</p>
      ) : (
        <ul className="co-voucher__list">
          {vouchers.map((v) => {
            const isApplied = appliedCode === v.code;
            return (
              <li
                key={v.code}
                className={[
                  'co-voucher__card',
                  v.eligible ? '' : 'co-voucher__card--disabled',
                  isApplied ? 'co-voucher__card--applied' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="co-voucher__info">
                  <button
                    type="button"
                    className="co-voucher__code"
                    title="Bấm để sao chép mã"
                    onClick={() => copyText(v.code, onToast)}
                  >
                    {v.code}
                  </button>
                  <p className="co-voucher__desc">{v.description}</p>
                  {!v.eligible && v.reason && (
                    <p className="co-voucher__reason">{v.reason}</p>
                  )}
                  {isApplied && (
                    <span className="badge badge-new">Đã áp dụng</span>
                  )}
                </div>
                <div className="co-voucher__action">
                  {isApplied ? (
                    <button
                      type="button"
                      className="co-addr__link co-addr__link--danger"
                      onClick={() => onRemove?.()}
                    >
                      Gỡ
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary co-voucher__use"
                      disabled={!v.eligible || applying}
                      onClick={() => handleApply(v.code)}
                    >
                      Dùng ngay
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="co-voucher__note">
        {appliedCode
          ? `Đang áp dụng mã ${appliedCode} — giảm ${formatVND(appliedDiscount)}. Chi tiết ở tóm tắt đơn.`
          : 'Mã ưu đãi chỉ áp dụng ở bước này.'}
      </p>
    </div>
  );
}
