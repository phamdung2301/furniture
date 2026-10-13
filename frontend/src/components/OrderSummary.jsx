/**
 * Tóm tắt đơn sticky (cột phải) — spec §5.2/§5.3.
 * Tạm tính -> Giảm giá (xanh lá, ẩn khi chưa áp mã) -> Phí vận chuyển
 * (icon ⓘ + tooltip breakdown diện tích) -> TỔNG CỘNG.
 * Mobile: bottom-sheet collapsible + nút sticky bottom ở bước 4.
 */
import { useState } from 'react';
import { formatVND } from '../utils/format';
import { formatAreaM2 } from '../api/shippingApi';

function ShippingValue({ quote }) {
  if (!quote) return <span className="co-sum__muted">Đang tính…</span>;
  if (quote.overLimit) return <span className="co-sum__muted">Liên hệ báo giá</span>;

  const tipLines = [
    `Phí ship tính theo tổng diện tích chiếm chỗ của đơn hàng: ${formatAreaM2(quote.totalAreaM2)} m² → nấc ${quote.tier.min}–${quote.tier.max} m².`,
    ...(quote.breakdown || []).map(
      (b) => `${b.name} ${formatAreaM2(b.areaM2)} m² × ${b.qty}`
    ),
    quote.freeShipping ? 'Đơn từ 10.000.000đ được miễn phí vận chuyển.' : '',
  ].filter(Boolean);
  const tip = tipLines.join('\n');

  return (
    <span className="co-sum__shiplabel">
      {quote.freeShipping ? (
        <>
          <span className="co-sum__free">Miễn phí</span>{' '}
          <s className="co-sum__muted">{formatVND(quote.fee)}</s>
        </>
      ) : (
        formatVND(quote.fee)
      )}
      <span
        className="co-info"
        tabIndex={0}
        role="img"
        aria-label={tip}
        title={tip}
      >
        ⓘ<span className="co-tooltip">{tip}</span>
      </span>
    </span>
  );
}

export default function OrderSummary({
  subtotal = 0,
  discount = 0,
  voucherCode = null,
  quote = null,
  total = 0,
  placing = false,
  showOrderButton = false,
  canPlace = true,
  placeDisabledReason = '',
  onPlaceOrder,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const lines = (
    <>
      <div className="co-sum__row">
        <span>Tạm tính</span>
        <span className="co-sum__amount">{formatVND(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="co-sum__row">
          <span>
            Giảm giá{voucherCode ? ` (${voucherCode})` : ''}
          </span>
          <span className="co-sum__discount">-{formatVND(discount)}</span>
        </div>
      )}
      <div className="co-sum__row">
        <span>Phí vận chuyển</span>
        <ShippingValue quote={quote} />
      </div>
      <div className="co-sum__divider" />
      <div className="co-sum__row co-sum__row--total">
        <span>Tổng cộng</span>
        <span className="co-sum__grand">{formatVND(total)}</span>
      </div>
    </>
  );

  return (
    <>
      <aside className="co-summary" aria-label="Tóm tắt đơn hàng">
        <h2 className="co-summary__title">Tóm tắt đơn hàng</h2>
        {lines}
        {showOrderButton && (
          <>
            {placeDisabledReason && (
              <p className="co-sum__reason" role="note">
                {placeDisabledReason}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary co-sum__cta"
              disabled={!canPlace || placing}
              onClick={onPlaceOrder}
            >
              {placing ? <span className="btn-spinner" aria-hidden="true" /> : null}
              {placing ? 'Đang tạo đơn…' : `Đặt hàng · ${formatVND(total)}`}
            </button>
          </>
        )}
      </aside>

      {/* Mobile: bottom bar + sheet collapsible */}
      <div className="co-mobilebar" aria-label="Tóm tắt đơn hàng">
        {sheetOpen && (
          <div className="co-mobilebar__sheet" role="dialog" aria-label="Chi tiết đơn hàng">
            {lines}
          </div>
        )}
        <div className="co-mobilebar__bar">
          <button
            type="button"
            className="co-mobilebar__toggle"
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
          >
            <span className="co-mobilebar__label">Tổng cộng</span>
            <span className="co-mobilebar__amount">{formatVND(total)}</span>
            <span className="co-mobilebar__caret" aria-hidden="true">
              {sheetOpen ? '▾' : '▴'} Chi tiết
            </span>
          </button>
          {showOrderButton && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canPlace || placing}
              onClick={onPlaceOrder}
            >
              {placing ? <span className="btn-spinner" aria-hidden="true" /> : null}
              {placing ? 'Đang tạo…' : `Đặt hàng · ${formatVND(total)}`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
