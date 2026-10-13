/**
 * Form thêm/sửa địa chỉ nhận hàng — spec §2.2.
 * Tỉnh/Quận/Phường dropdown phụ thuộc (mock vnProvinces).
 * Validate inline từng field; nút "Lưu địa chỉ" disabled đến khi hợp lệ.
 */
import { useMemo, useState } from 'react';
import { vnProvinces, findDistricts, findWards } from '../mocks/vnProvinces';

const PHONE_RE = /^0\d{9}$/;

function validate(values) {
  const errors = {};
  if (!values.receiverName.trim()) errors.receiverName = 'Vui lòng nhập họ tên người nhận.';
  if (!PHONE_RE.test(values.phone.trim()))
    errors.phone = 'Số điện thoại gồm 10 số, bắt đầu bằng 0.';
  if (!values.province) errors.province = 'Vui lòng chọn tỉnh/thành phố.';
  if (!values.district) errors.district = 'Vui lòng chọn quận/huyện.';
  if (!values.ward) errors.ward = 'Vui lòng chọn phường/xã.';
  if (!values.detail.trim()) errors.detail = 'Vui lòng nhập số nhà, tên đường.';
  return errors;
}

export default function AddressForm({ initial = null, saving = false, onSave, onCancel }) {
  const [values, setValues] = useState({
    label: initial?.label || 'Nhà',
    receiverName: initial?.receiverName || '',
    phone: initial?.phone || '',
    province: initial?.province || '',
    district: initial?.district || '',
    ward: initial?.ward || '',
    detail: initial?.detail || '',
    note: initial?.note || '',
    isDefault: Boolean(initial?.isDefault),
  });
  const [touched, setTouched] = useState({});

  const errors = useMemo(() => validate(values), [values]);
  const isValid = Object.keys(errors).length === 0;

  const set = (key, value) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      // Đổi tỉnh -> reset quận/phường; đổi quận -> reset phường.
      if (key === 'province') {
        next.district = '';
        next.ward = '';
      } else if (key === 'district') {
        next.ward = '';
      }
      return next;
    });
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const districts = useMemo(() => findDistricts(values.province), [values.province]);
  const wards = useMemo(
    () => findWards(values.province, values.district),
    [values.province, values.district]
  );

  const showError = (key) => touched[key] && errors[key];

  const field = (key, label, input) => (
    <label className="co-field">
      <span className="co-field__label">
        {label} <span className="co-field__req" aria-hidden="true">*</span>
      </span>
      {input}
      {showError(key) && (
        <span className="co-field__error" role="alert">
          {errors[key]}
        </span>
      )}
    </label>
  );

  const inputCls = (key) => `co-input${showError(key) ? ' co-input--error' : ''}`;

  return (
    <form
      className="co-form"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched({
          receiverName: true, phone: true, province: true,
          district: true, ward: true, detail: true,
        });
        if (isValid) onSave?.(values);
      }}
    >
      <div className="co-form__row">
        {field(
          'receiverName',
          'Họ tên người nhận',
          <input
            className={inputCls('receiverName')}
            value={values.receiverName}
            onChange={(e) => set('receiverName', e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, receiverName: true }))}
            placeholder="VD: Nguyễn Văn An"
            autoComplete="name"
          />
        )}
        {field(
          'phone',
          'Số điện thoại',
          <input
            className={inputCls('phone')}
            value={values.phone}
            onChange={(e) => set('phone', e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
            onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
            placeholder="VD: 0901234567"
            inputMode="numeric"
            autoComplete="tel"
          />
        )}
      </div>

      <div className="co-form__row co-form__row--3">
        {field(
          'province',
          'Tỉnh/Thành phố',
          <select
            className={inputCls('province')}
            value={values.province}
            onChange={(e) => set('province', e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, province: true }))}
          >
            <option value="">Chọn tỉnh/thành phố</option>
            {vnProvinces.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {field(
          'district',
          'Quận/Huyện',
          <select
            className={inputCls('district')}
            value={values.district}
            onChange={(e) => set('district', e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, district: true }))}
            disabled={!values.province}
          >
            <option value="">Chọn quận/huyện</option>
            {districts.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        {field(
          'ward',
          'Phường/Xã',
          <select
            className={inputCls('ward')}
            value={values.ward}
            onChange={(e) => set('ward', e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, ward: true }))}
            disabled={!values.district}
          >
            <option value="">Chọn phường/xã</option>
            {wards.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        )}
      </div>

      {field(
        'detail',
        'Địa chỉ chi tiết',
        <input
          className={inputCls('detail')}
          value={values.detail}
          onChange={(e) => set('detail', e.target.value)}
          onBlur={() => setTouched((p) => ({ ...p, detail: true }))}
          placeholder="Số nhà, tên đường"
          autoComplete="street-address"
        />
      )}

      <label className="co-field">
        <span className="co-field__label">Ghi chú giao hàng (không bắt buộc)</span>
        <input
          className="co-input"
          value={values.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder="VD: gọi trước 30 phút khi giao"
        />
      </label>

      <div className="co-form__row co-form__row--meta">
        <div className="co-chips" role="radiogroup" aria-label="Loại địa chỉ">
          {['Nhà', 'Công ty'].map((label) => (
            <button
              key={label}
              type="button"
              className={`co-chip${values.label === label ? ' co-chip--active' : ''}`}
              aria-pressed={values.label === label}
              onClick={() => set('label', label)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="co-check">
          <input
            type="checkbox"
            checked={values.isDefault}
            onChange={(e) => set('isDefault', e.target.checked)}
          />
          Đặt làm địa chỉ mặc định
        </label>
      </div>

      <div className="co-form__actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!isValid || saving}
        >
          {saving ? <span className="btn-spinner" aria-hidden="true" /> : null}
          {initial ? 'Lưu thay đổi' : 'Lưu địa chỉ'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Hủy
        </button>
      </div>
    </form>
  );
}
