import { useMemo, useRef, useState } from 'react';
import AdminModal from './AdminModal';
import ConfirmDialog from './ConfirmDialog';
import { adjustStock, inventoryStatus } from '../../api/adminInventoryApi';

/**
 * Modal Điều chỉnh tồn kho — 520px §B.2 (admin-ton-kho.md §5, FR-023 · F-017).
 * 3 chế độ: Nhập thêm (RECEIVE) · Xuất / giảm (REMOVE) · Đặt số mới (SET).
 * Xem trước "trước → sau" + badge trạng thái sẽ thành; lý do bắt buộc
 * (chọn "Khác" → ghi chú bắt buộc); giảm tồn có bước xác nhận phụ trong modal.
 * Chống ghi đè: gửi expectedStock = tồn lúc mở modal; 409 STOCK_CHANGED →
 * modal KHÔNG đóng, tải lại số tồn mới + banner báo rõ (§5.5).
 */

export const REASON_OPTIONS = [
  { value: 'RESTOCK', label: 'Nhập hàng mới' },
  { value: 'STOCKTAKE', label: 'Kiểm kê điều chỉnh' },
  { value: 'DAMAGED', label: 'Hàng hư hỏng' },
  { value: 'RETURN', label: 'Khách trả hàng' },
  { value: 'DISPOSAL', label: 'Xuất hủy' },
  { value: 'OTHER', label: 'Khác' },
];

const MODE_OPTIONS = [
  { value: 'RECEIVE', label: 'Nhập thêm', defaultReason: 'RESTOCK' },
  { value: 'REMOVE', label: 'Xuất / giảm', defaultReason: 'DAMAGED' },
  { value: 'SET', label: 'Đặt số mới', defaultReason: 'STOCKTAKE' },
];

const STATUS_BADGE = {
  out: { label: 'Hết hàng', cls: 'is-error' },
  low: { label: 'Sắp hết', cls: 'is-warning' },
  ok: { label: 'Còn hàng', cls: 'is-success' },
};

export function StockStatusBadge({ stock, lowStockThreshold }) {
  const b = STATUS_BADGE[inventoryStatus(stock, lowStockThreshold)];
  return <span className={`admin-pill ${b.cls}`}>{b.label}</span>;
}

const isIntegerText = (s) => /^\d+$/.test(String(s).trim());

function Field({ label, required, error, children }) {
  return (
    <div className={`pf-field${error ? ' has-error' : ''}`}>
      <label className="pf-field__label">
        {label}
        {required ? <span className="pf-required"> *</span> : null}
      </label>
      {children}
      {error ? <p className="pf-field__error">{error}</p> : null}
    </div>
  );
}

export default function StockAdjustModal({ row, onClose, onSaved, onToast }) {
  // Tồn "hiện tại" trong modal: khởi tạo từ dòng bảng, cập nhật khi gặp 409.
  const [currentStock, setCurrentStock] = useState(row.stock);
  const expectedRef = useRef(row.stock);
  const [mode, setMode] = useState('RECEIVE');
  const [qty, setQty] = useState('');
  const [newStockText, setNewStockText] = useState('');
  const [reason, setReason] = useState('RESTOCK');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [conflict, setConflict] = useState(null); // currentStock mới khi 409
  const [step, setStep] = useState('form'); // 'form' | 'confirm'
  const [saving, setSaving] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);

  const threshold = row.lowStockThreshold;
  const dirty =
    mode !== 'RECEIVE' ||
    qty !== '' ||
    newStockText !== '' ||
    reason !== 'RESTOCK' ||
    note !== '';

  /* ------------------------- Xem trước kết quả ------------------------- */
  const parsedQty = isIntegerText(qty) ? Number(qty) : null;
  const parsedNew = isIntegerText(newStockText) ? Number(newStockText) : null;
  const result = useMemo(() => {
    if (mode === 'RECEIVE') return parsedQty != null ? currentStock + parsedQty : null;
    if (mode === 'REMOVE') return parsedQty != null ? currentStock - parsedQty : null;
    return parsedNew;
  }, [mode, parsedQty, parsedNew, currentStock]);
  const diff = result != null ? result - currentStock : null;
  const needsConfirm =
    result != null && (mode === 'REMOVE' || (mode === 'SET' && diff < 0));
  const setNoChange = mode === 'SET' && parsedNew != null && diff === 0;

  const previewText = (() => {
    if (mode === 'RECEIVE') {
      return parsedQty != null
        ? `${currentStock} + ${parsedQty} = ${result}`
        : `${currentStock} + … = …`;
    }
    if (mode === 'REMOVE') {
      return parsedQty != null
        ? `${currentStock} − ${parsedQty} = ${result}`
        : `${currentStock} − … = …`;
    }
    if (parsedNew == null) return 'Chênh lệch: …';
    if (diff === 0) return 'Chênh lệch: 0 — không thay đổi';
    return `Chênh lệch: ${diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`}`;
  })();

  /* ------------------------------ Đóng modal ------------------------------ */
  const requestClose = () => {
    if (saving) return;
    if (dirty) setAskDiscard(true);
    else onClose?.();
  };

  const changeMode = (next) => {
    setMode(next);
    // Lý do gợi ý khớp chế độ (§5.3) — admin vẫn đổi tay được.
    setReason(MODE_OPTIONS.find((m) => m.value === next).defaultReason);
    setErrors((e) => ({ ...e, qty: undefined, newStock: undefined }));
    setStep('form');
  };

  /* ------------------------------ Validate ------------------------------ */
  const validate = () => {
    const fe = {};
    if (mode === 'RECEIVE' || mode === 'REMOVE') {
      if (!isIntegerText(qty) || Number(qty) <= 0) {
        fe.qty =
          mode === 'RECEIVE'
            ? 'Số lượng nhập phải là số nguyên lớn hơn 0.'
            : 'Số lượng giảm phải là số nguyên lớn hơn 0.';
      } else if (mode === 'REMOVE' && Number(qty) > currentStock) {
        fe.qty = `Số lượng giảm không được lớn hơn tồn hiện tại (${currentStock}).`;
      }
    } else if (!isIntegerText(newStockText)) {
      fe.newStock = 'Tồn thực tế phải là số nguyên lớn hơn hoặc bằng 0.';
    }
    if (!reason) fe.reason = 'Vui lòng chọn lý do điều chỉnh.';
    if (reason === 'OTHER' && !note.trim()) {
      fe.note = 'Vui lòng ghi rõ lý do trong ô ghi chú.';
    } else if (note.length > 200) {
      fe.note = 'Ghi chú tối đa 200 ký tự.';
    }
    return fe;
  };

  /* -------------------------------- Lưu -------------------------------- */
  const doSave = async () => {
    setSaving(true);
    try {
      const body = {
        mode,
        reason,
        note: note.trim() || undefined,
        expectedStock: expectedRef.current,
      };
      if (mode === 'SET') body.newStock = parsedNew;
      else body.qty = parsedQty;
      const res = await adjustStock(row.variantId, body);
      onSaved?.(res);
    } catch (e) {
      if (e?.code === 'STOCK_CHANGED' && typeof e.currentStock === 'number') {
        // §5.5: modal không đóng — cập nhật tồn mới + xem trước, báo rõ.
        expectedRef.current = e.currentStock;
        setCurrentStock(e.currentStock);
        setConflict(e.currentStock);
        setStep('form');
      } else if (
        e?.status === 422 &&
        ['qty', 'newStock', 'reason', 'note'].includes(e?.field)
      ) {
        setErrors((prev) => ({ ...prev, [e.field]: e.message }));
        setStep('form');
      } else {
        onToast?.(e?.message || 'Không lưu được điều chỉnh tồn kho. Vui lòng thử lại.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePrimary = () => {
    const fe = validate();
    setErrors(fe);
    if (Object.keys(fe).length) return;
    if (needsConfirm && step === 'form') {
      setStep('confirm');
      return;
    }
    doSave();
  };

  const reasonLabel = REASON_OPTIONS.find((r) => r.value === reason)?.label || reason;

  const footer =
    step === 'confirm' ? (
      <>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setStep('form')}
          disabled={saving}
        >
          Quay lại
        </button>
        <button type="button" className="btn btn-primary" onClick={doSave} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Xác nhận'}
        </button>
      </>
    ) : (
      <>
        <button type="button" className="btn btn-secondary" onClick={requestClose} disabled={saving}>
          Hủy
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handlePrimary}
          disabled={saving || setNoChange}
        >
          {saving ? 'Đang lưu…' : 'Lưu điều chỉnh'}
        </button>
      </>
    );

  return (
    <>
      <AdminModal open title="Điều chỉnh tồn kho" onClose={requestClose} footer={footer}>
        <div className="stock-adjust">
          <div className="stock-adjust__head">
            {row.image ? (
              <img className="stock-adjust__img" src={row.image} alt="" />
            ) : (
              <span className="stock-adjust__img stock-adjust__img--empty" aria-hidden="true">
                🛋️
              </span>
            )}
            <span className="stock-adjust__meta">
              <span className="stock-adjust__name">
                {row.productName} — {row.color}
              </span>
              <span className="stock-adjust__sku">{row.sku}</span>
            </span>
          </div>

          {conflict != null ? (
            <div className="stock-adjust__conflict" role="alert">
              Tồn kho vừa thay đổi (hiện còn {conflict}) do giao dịch khác. Số liệu đã được
              tải lại — kiểm tra và lưu lại.
            </div>
          ) : null}

          {step === 'confirm' ? (
            <div className="stock-adjust__confirm">
              <p>
                Tồn của{' '}
                <strong>
                  {row.productName} — {row.color}
                </strong>{' '}
                sẽ giảm từ {currentStock} xuống {result} (lý do: {reasonLabel}).
              </p>
              <p className="stock-adjust__confirm-note">
                Kiểm tra kỹ số lượng trước khi xác nhận.
              </p>
            </div>
          ) : (
            <>
              <div className="stock-adjust__current">
                <span className="stock-adjust__current-label">
                  Tồn hiện tại: <strong className="stock-adjust__current-num">{currentStock}</strong>
                </span>
                <StockStatusBadge stock={currentStock} lowStockThreshold={threshold} />
              </div>

              <div className="stock-adjust__modes" role="group" aria-label="Chế độ điều chỉnh">
                {MODE_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={`stock-adjust__mode${mode === m.value ? ' is-active' : ''}`}
                    onClick={() => changeMode(m.value)}
                    disabled={saving}
                    aria-pressed={mode === m.value}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <fieldset className="stock-adjust__form" disabled={saving}>
                {mode === 'SET' ? (
                  <Field label="Tồn thực tế" required error={errors.newStock}>
                    <input
                      className="pf-input"
                      type="number"
                      min="0"
                      step="1"
                      value={newStockText}
                      onChange={(e) => setNewStockText(e.target.value)}
                      onBlur={() => setErrors(validate())}
                      placeholder="VD: 12"
                    />
                  </Field>
                ) : (
                  <Field
                    label={mode === 'RECEIVE' ? 'Số lượng nhập' : 'Số lượng giảm'}
                    required
                    error={errors.qty}
                  >
                    <input
                      className="pf-input"
                      type="number"
                      min="1"
                      step="1"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      onBlur={() => setErrors(validate())}
                      placeholder="VD: 5"
                    />
                  </Field>
                )}

                <div className="stock-adjust__preview" aria-live="polite">
                  <span className="stock-adjust__preview-text">{previewText}</span>
                  {result != null && result >= 0 ? (
                    <>
                      <span className="stock-adjust__preview-arrow" aria-hidden="true">
                        →
                      </span>
                      <StockStatusBadge stock={result} lowStockThreshold={threshold} />
                    </>
                  ) : null}
                </div>

                <Field label="Lý do điều chỉnh" required error={errors.reason}>
                  <select
                    className="pf-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onBlur={() => setErrors(validate())}
                  >
                    <option value="">Chọn lý do…</option>
                    {REASON_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label={reason === 'OTHER' ? 'Ghi chú' : 'Ghi chú (không bắt buộc)'}
                  required={reason === 'OTHER'}
                  error={errors.note}
                >
                  <textarea
                    className="pf-input pf-textarea"
                    rows={2}
                    maxLength={200}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={() => setErrors(validate())}
                    placeholder="Ghi chú thêm về lần điều chỉnh này…"
                  />
                  <span className="pf-field__hint">{note.length}/200 ký tự</span>
                </Field>
              </fieldset>
            </>
          )}
        </div>
      </AdminModal>

      <ConfirmDialog
        open={askDiscard}
        title="Đóng mà không lưu?"
        confirmLabel="Đóng"
        onCancel={() => setAskDiscard(false)}
        onConfirm={() => {
          setAskDiscard(false);
          onClose?.();
        }}
      >
        <p>Bạn có thay đổi chưa lưu. Đóng mà không lưu sẽ làm mất các thay đổi này.</p>
      </ConfirmDialog>
    </>
  );
}
