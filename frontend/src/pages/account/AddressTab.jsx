/**
 * Tab Sổ địa chỉ — /tai-khoan/dia-chi (spec ho-so.md §3).
 * FR-015 · F-011. Tái dùng nguyên AddressCard / AddressForm / addressApi
 * của màn 7 (cùng API nên đồng bộ hai chiều với bước 1 checkout).
 * Khác checkout: không có radio chọn; thêm nút "Đặt làm mặc định".
 * Quy tắc F-011: tối đa 5 địa chỉ, luôn đúng 1 mặc định, xóa địa chỉ mặc
 * định -> tự chuyển mặc định sang địa chỉ còn lại đầu tiên.
 */
import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AddressCard from '../../components/AddressCard';
import AddressForm from '../../components/AddressForm';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  getMaxAddresses,
} from '../../api/addressApi';

export default function AddressTab() {
  const { onToast, locked } = useOutletContext();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [addresses, setAddresses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const list = await getAddresses();
      setAddresses(list);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editingAddress) {
        await updateAddress(editingAddress.id, data);
        onToast?.('Đã lưu thay đổi địa chỉ.');
      } else {
        await createAddress(data);
        onToast?.('Đã thêm địa chỉ mới.');
      }
      setAddresses(await getAddresses());
      setShowForm(false);
      setEditingAddress(null);
    } catch (e) {
      onToast?.(e?.message || 'Không lưu được địa chỉ. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!id) return;
    try {
      await deleteAddress(id);
      setAddresses(await getAddresses());
      onToast?.('Đã xóa địa chỉ.');
    } catch {
      onToast?.('Không xóa được địa chỉ. Vui lòng thử lại.');
    }
  };

  const handleSetDefault = async (address) => {
    try {
      await updateAddress(address.id, { ...address, isDefault: true });
      setAddresses(await getAddresses());
      onToast?.('Đã đặt địa chỉ mặc định.');
    } catch {
      onToast?.('Không đặt được địa chỉ mặc định. Vui lòng thử lại.');
    }
  };

  const openAdd = () => {
    setEditingAddress(null);
    setShowForm(true);
    setConfirmDeleteId(null);
  };

  const maxed = addresses.length >= getMaxAddresses();

  return (
    <div>
      <h2 className="account-h2">Sổ địa chỉ</h2>
      <p className="account-sub">
        Địa chỉ nhận hàng đã lưu — dùng khi đặt hàng, tối đa {getMaxAddresses()} địa chỉ.
      </p>

      <fieldset disabled={locked} className="account-fieldset">
        {status === 'loading' && (
          <div aria-label="Đang tải địa chỉ">
            {[0, 1].map((i) => (
              <div className="skeleton co-addr__skeleton" key={i} aria-hidden="true" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <>
            <div className="auth-banner auth-banner--red" role="alert">
              <p>Không tải được thông tin. Vui lòng thử lại.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={load}>
              Thử lại
            </button>
          </>
        )}

        {status === 'ready' && (
          <>
            {addresses.length === 0 && !showForm ? (
              <div className="account-empty">
                <p>Bạn chưa lưu địa chỉ nào.</p>
                <button type="button" className="btn btn-primary" onClick={openAdd}>
                  + Thêm địa chỉ đầu tiên
                </button>
              </div>
            ) : (
              <>
                <div>
                  {addresses.map((a) => (
                    <AddressCard
                      key={a.id}
                      address={a}
                      selectable={false}
                      onEdit={(addr) => {
                        setEditingAddress(addr);
                        setShowForm(true);
                        setConfirmDeleteId(null);
                      }}
                      onDelete={setConfirmDeleteId}
                      confirmDelete={confirmDeleteId === a.id}
                      onConfirmDelete={handleConfirmDelete}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                      onSetDefault={handleSetDefault}
                    />
                  ))}
                </div>
                {maxed ? (
                  <p className="checkout-hint">Bạn đã lưu tối đa 5 địa chỉ.</p>
                ) : (
                  !showForm && (
                    <button type="button" className="btn btn-secondary" onClick={openAdd}>
                      + Thêm địa chỉ mới
                    </button>
                  )
                )}
              </>
            )}

            {showForm && (
              <div className="checkout-formwrap">
                <h3 className="checkout-h3">
                  {editingAddress ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}
                </h3>
                <AddressForm
                  initial={editingAddress}
                  saving={saving}
                  onSave={handleSave}
                  onCancel={() => {
                    setShowForm(false);
                    setEditingAddress(null);
                  }}
                />
              </div>
            )}
          </>
        )}
      </fieldset>
    </div>
  );
}
