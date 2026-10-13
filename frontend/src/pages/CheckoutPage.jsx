/**
 * Màn Đặt hàng — route /dat-hang. US-007 · FR-009/010/011/019/029/030 ·
 * F-007 · F-008 · F-011 · F-023. Spec: ui-specs/dat-hang.md.
 *
 * Luồng: stepper 4 bước (địa chỉ -> mã ưu đãi -> thanh toán -> xác nhận),
 * tóm tắt đơn sticky từ bước 1, phí ship theo diện tích (tooltip breakdown).
 * Guard: giỏ trống -> /gio-hang; chưa login -> /dang-nhap?returnTo=/dat-hang;
 * chưa xác thực SĐT -> banner vàng chặn toàn bộ.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CheckoutSteps from '../components/CheckoutSteps';
import AddressCard, { addressLine } from '../components/AddressCard';
import AddressForm from '../components/AddressForm';
import VoucherSection from '../components/VoucherSection';
import PaymentMethodSelector, { paymentMethodName } from '../components/PaymentMethodSelector';
import OrderSummary from '../components/OrderSummary';
import { useCartCount } from '../hooks/useCartCount';
import { getCart, validateCart, clearCart } from '../utils/cart';
import { isLoggedIn, getUser } from '../utils/auth';
import { formatVND } from '../utils/format';
import { lookupVariants } from '../api/productApi';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  getMaxAddresses,
} from '../api/addressApi';
import { getAvailable, validateVoucher } from '../api/voucherApi';
import { quoteShipping } from '../api/shippingApi';
import { createOrder } from '../api/orderApi';

export default function CheckoutPage({ darkMode, onToggleDark, onToast }) {
  const navigate = useNavigate();
  const cartCount = useCartCount();
  const topRef = useRef(null);

  const loggedIn = isLoggedIn();
  const user = getUser();
  const phoneOk = user?.phoneVerified === true;

  const [items] = useState(() => getCart());
  const [step, setStep] = useState(1);
  const [maxReached, setMaxReached] = useState(1);

  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [vouchers, setVouchers] = useState([]);
  const [voucherLoading, setVoucherLoading] = useState(true);
  const [appliedCode, setAppliedCode] = useState(null);
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [voucherError, setVoucherError] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [note, setNote] = useState('');

  const [quote, setQuote] = useState(null);

  const [placing, setPlacing] = useState(false);
  const [stockError, setStockError] = useState([]);
  const [priceWarning, setPriceWarning] = useState([]);
  const [orderError, setOrderError] = useState('');

  const subtotal = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0);
  const shipFee = quote ? (quote.freeShipping || quote.overLimit ? 0 : quote.fee) : 0;
  const total = Math.max(0, subtotal - appliedDiscount + shipFee);
  const overLimit = Boolean(quote?.overLimit);

  const scrollTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /* ---------- Tải dữ liệu đầu trang ---------- */
  useEffect(() => {
    if (!loggedIn || items.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getAddresses();
        if (cancelled) return;
        setAddresses(list);
        const def = list.find((a) => a.isDefault) || list[0];
        setSelectedAddressId(def?.id || null);
        if (list.length === 0) setShowForm(true);
      } catch {
        if (!cancelled) onToast?.('Không tải được danh sách địa chỉ.');
      } finally {
        if (!cancelled) setAddressLoading(false);
      }
    })();
    (async () => {
      try {
        const q = await quoteShipping(items);
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) onToast?.('Không tính được phí vận chuyển.');
      }
    })();
    (async () => {
      try {
        const list = await getAvailable();
        if (!cancelled) setVouchers(list);
      } catch {
        if (!cancelled) onToast?.('Không tải được danh sách mã ưu đãi.');
      } finally {
        if (!cancelled) setVoucherLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Guard vào trang ---------- */
  if (!loggedIn) {
    return <Navigate to="/dang-nhap?returnTo=/dat-hang" replace />;
  }
  if (items.length === 0) {
    return <Navigate to="/gio-hang" replace />;
  }

  /* ---------- Điều hướng bước ---------- */
  const goStep = (s) => {
    if (s < 1 || s > 4 || s > maxReached) return;
    setStep(s);
    scrollTop();
  };

  const canContinue = () => {
    if (step === 1) return Boolean(selectedAddressId);
    if (step === 3) return Boolean(paymentMethod);
    return true;
  };

  const handleNext = () => {
    if (!canContinue() || step >= 4) return;
    const next = step + 1;
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
    scrollTop();
  };

  /* ---------- Địa chỉ ---------- */
  const handleSaveAddress = async (data) => {
    setSavingAddress(true);
    try {
      if (editingAddress) {
        await updateAddress(editingAddress.id, data);
        const list = await getAddresses();
        setAddresses(list);
        if (!list.some((a) => a.id === selectedAddressId)) {
          const def = list.find((a) => a.isDefault) || list[0];
          setSelectedAddressId(def?.id || null);
        }
        onToast?.('Đã lưu thay đổi địa chỉ.');
      } else {
        const created = await createAddress(data);
        const list = await getAddresses();
        setAddresses(list);
        setSelectedAddressId(created.id);
        onToast?.('Đã thêm địa chỉ mới.');
      }
      setShowForm(false);
      setEditingAddress(null);
    } catch (e) {
      onToast?.(e?.message || 'Không lưu được địa chỉ. Vui lòng thử lại.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleConfirmDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!id) return;
    try {
      await deleteAddress(id);
      const list = await getAddresses();
      setAddresses(list);
      if (!list.some((a) => a.id === selectedAddressId)) {
        const def = list.find((a) => a.isDefault) || list[0];
        setSelectedAddressId(def?.id || null);
      }
      if (list.length === 0) setShowForm(true);
      onToast?.('Đã xóa địa chỉ.');
    } catch {
      onToast?.('Không xóa được địa chỉ. Vui lòng thử lại.');
    }
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;
  const maxedAddresses = addresses.length >= getMaxAddresses();

  /* ---------- Voucher ---------- */
  const handleApplyVoucher = async (code) => {
    setApplyingVoucher(true);
    setVoucherError('');
    try {
      const res = await validateVoucher(code, subtotal);
      if (res.valid) {
        setAppliedCode(code);
        setAppliedDiscount(res.discount);
        onToast?.(`Đã áp dụng mã ${code} — giảm ${formatVND(res.discount)}.`);
      } else {
        setVoucherError(res.message || 'Mã ưu đãi không hợp lệ.');
      }
    } catch {
      setVoucherError('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setApplyingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedCode(null);
    setAppliedDiscount(0);
    setVoucherError('');
  };

  /* ---------- Đặt hàng ---------- */
  const canPlace =
    phoneOk && !placing && quote && !overLimit && Boolean(selectedAddressId);

  const handlePlaceOrder = async () => {
    if (!canPlace || placing) return;
    setPlacing(true);
    setOrderError('');
    setStockError([]);
    setPriceWarning([]);
    try {
      // F-007: chốt lại giá/tồn trước khi tạo đơn (US-008).
      const { removed, priceChanges } = await validateCart(lookupVariants);
      if (removed.length > 0) {
        setStockError(removed);
        setPlacing(false);
        scrollTop();
        return;
      }
      if (priceChanges.length > 0) setPriceWarning(priceChanges);
      const res = await createOrder({
        addressId: selectedAddressId,
        voucherCode: appliedCode || undefined,
        paymentMethod,
        note: note.trim() || undefined,
      });
      if (paymentMethod === 'MOMO') {
        // Màn 8: đơn vẫn MỚI, giỏ hàng được xóa khi thanh toán hoàn tất —
        // GIỮ NGUYÊN giỏ ở bước này.
        navigate(`/thanh-toan?order=${res.orderNumber}`);
      } else {
        clearCart();
        navigate(`/dat-hang/thanh-cong?order=${res.orderNumber}`);
      }
    } catch (e) {
      setOrderError(
        e?.code === 'voucher_invalid' || e?.code === 'over_limit'
          ? e.message
          : 'Có lỗi xảy ra, vui lòng thử lại.'
      );
      setPlacing(false);
      scrollTop();
    }
  };

  return (
    <div className="checkout-page">
      <Header
        cartCount={cartCount}
        darkMode={darkMode}
        onToggleDark={onToggleDark}
        onToast={onToast}
      />

      <main className="container checkout-main" ref={topRef}>
        <nav className="checkout-breadcrumb" aria-label="Breadcrumb">
          <Link to="/gio-hang">Giỏ hàng</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Đặt hàng</span>
        </nav>

        <h1 className="checkout-title">Đặt hàng</h1>

        {!phoneOk && (
          <div className="auth-banner auth-banner--yellow checkout-verify" role="alert">
            <p>
              <strong>Bạn cần xác thực số điện thoại trước khi đặt hàng.</strong>
            </p>
            <p className="auth-banner__sub">
              Xác thực giúp shop liên hệ giao hàng chính xác và bảo vệ đơn hàng của bạn.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/dang-nhap?returnTo=/dat-hang')}
            >
              Xác thực ngay
            </button>
          </div>
        )}

        <CheckoutSteps current={step} maxReached={maxReached} onGo={goStep} />

        {stockError.length > 0 && (
          <div className="auth-banner auth-banner--red" role="alert">
            <p>
              <strong>Đơn chưa được tạo.</strong> Các sản phẩm sau vừa hết hàng:
            </p>
            <ul className="checkout-stocklist">
              {stockError.map((i) => (
                <li key={i.variantId}>
                  {i.productName} (màu {i.color})
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/gio-hang')}
            >
              Quay về giỏ hàng
            </button>
          </div>
        )}

        {priceWarning.length > 0 && (
          <div className="auth-banner auth-banner--yellow" role="alert">
            <p>
              <strong>Lưu ý:</strong> giá một số sản phẩm vừa thay đổi so với lúc bạn
              thêm vào giỏ. Đơn hàng sẽ chốt theo giá mới nhất.
            </p>
          </div>
        )}

        {orderError && (
          <div className="auth-banner auth-banner--red" role="alert">
            <p>{orderError}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePlaceOrder}
            >
              Thử lại
            </button>
          </div>
        )}

        {overLimit && (
          <div className="auth-banner auth-banner--yellow" role="alert">
            <p>
              <strong>Đơn hàng vượt 10 m² cần báo giá riêng</strong> — vui lòng liên
              hệ hotline để được tư vấn vận chuyển.
            </p>
          </div>
        )}

        <div
          className={`checkout-grid${phoneOk ? '' : ' checkout-grid--blocked'}`}
          aria-disabled={!phoneOk}
        >
          <section className="checkout-content" aria-label="Các bước đặt hàng">
            {step === 1 && (
              <div>
                <h2 className="checkout-h2">Địa chỉ nhận hàng</h2>
                {addressLoading ? (
                  <div aria-label="Đang tải địa chỉ">
                    {[0, 1].map((i) => (
                      <div className="skeleton co-addr__skeleton" key={i} aria-hidden="true" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div role="radiogroup" aria-label="Chọn địa chỉ nhận hàng">
                      {addresses.map((a) => (
                        <AddressCard
                          key={a.id}
                          address={a}
                          checked={a.id === selectedAddressId}
                          onSelect={setSelectedAddressId}
                          onEdit={(addr) => {
                            setEditingAddress(addr);
                            setShowForm(true);
                            setConfirmDeleteId(null);
                          }}
                          onDelete={setConfirmDeleteId}
                          confirmDelete={confirmDeleteId === a.id}
                          onConfirmDelete={handleConfirmDelete}
                          onCancelDelete={() => setConfirmDeleteId(null)}
                        />
                      ))}
                    </div>
                    {maxedAddresses ? (
                      <p className="checkout-hint">Bạn đã lưu tối đa 5 địa chỉ.</p>
                    ) : (
                      !showForm && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditingAddress(null);
                            setShowForm(true);
                          }}
                        >
                          + Thêm địa chỉ mới
                        </button>
                      )
                    )}
                    {showForm && (
                      <div className="checkout-formwrap">
                        <h3 className="checkout-h3">
                          {editingAddress ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}
                        </h3>
                        <AddressForm
                          initial={editingAddress}
                          saving={savingAddress}
                          onSave={handleSaveAddress}
                          onCancel={() => {
                            setShowForm(false);
                            setEditingAddress(null);
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="checkout-h2">Mã ưu đãi</h2>
                <VoucherSection
                  vouchers={vouchers}
                  loading={voucherLoading}
                  appliedCode={appliedCode}
                  appliedDiscount={appliedDiscount}
                  applying={applyingVoucher}
                  applyError={voucherError}
                  onApply={handleApplyVoucher}
                  onRemove={handleRemoveVoucher}
                  onToast={onToast}
                />
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="checkout-h2">Phương thức thanh toán</h2>
                <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="checkout-h2">Xác nhận đơn hàng</h2>

                <div className="co-confirm">
                  <div className="co-confirm__block">
                    <div className="co-confirm__head">
                      <h3>Địa chỉ nhận hàng</h3>
                      <button
                        type="button"
                        className="co-addr__link"
                        onClick={() => goStep(1)}
                      >
                        Thay đổi
                      </button>
                    </div>
                    {selectedAddress && (
                      <>
                        <p className="co-confirm__name">
                          {selectedAddress.receiverName} · {selectedAddress.phone}
                        </p>
                        <p className="co-confirm__muted">{addressLine(selectedAddress)}</p>
                      </>
                    )}
                  </div>

                  <div className="co-confirm__block">
                    <div className="co-confirm__head">
                      <h3>Phương thức thanh toán</h3>
                      <button
                        type="button"
                        className="co-addr__link"
                        onClick={() => goStep(3)}
                      >
                        Thay đổi
                      </button>
                    </div>
                    <p className="co-confirm__name">{paymentMethodName(paymentMethod)}</p>
                  </div>

                  <div className="co-confirm__block">
                    <div className="co-confirm__head">
                      <h3>Sản phẩm ({items.length})</h3>
                      <Link to="/gio-hang" className="co-addr__link">
                        Sửa giỏ hàng
                      </Link>
                    </div>
                    <ul className="co-confirm__items">
                      {items.map((i) => (
                        <li key={i.variantId} className="co-confirm__item">
                          {i.image && (
                            <img
                              src={i.image}
                              alt=""
                              className="co-confirm__img"
                              loading="lazy"
                            />
                          )}
                          <div className="co-confirm__info">
                            <p className="co-confirm__pname">{i.productName}</p>
                            <p className="co-confirm__meta">
                              <span
                                className="co-dot"
                                style={{ backgroundColor: i.colorHex }}
                                aria-hidden="true"
                              />
                              {i.color} · {i.qty} × {formatVND(i.price)}
                            </p>
                          </div>
                          <span className="co-confirm__line">
                            {formatVND(i.price * i.qty)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="co-confirm__block">
                    <h3>Ghi chú đơn hàng</h3>
                    <textarea
                      className="co-input co-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, 500))}
                      placeholder="Ghi chú cho shop (không bắt buộc)"
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                </div>
              </div>
            )}

            {step < 4 && (
              <div className="checkout-nav">
                <button
                  type="button"
                  className="btn btn-primary checkout-nav__next"
                  disabled={!canContinue()}
                  onClick={handleNext}
                >
                  Tiếp tục
                </button>
              </div>
            )}
          </section>

          <OrderSummary
            subtotal={subtotal}
            discount={appliedDiscount}
            voucherCode={appliedCode}
            quote={quote}
            total={total}
            placing={placing}
            showOrderButton={step === 4}
            canPlace={canPlace}
            placeDisabledReason={
              overLimit
                ? 'Đơn hàng vượt 10 m² — vui lòng liên hệ hotline để báo giá riêng.'
                : ''
            }
            onPlaceOrder={handlePlaceOrder}
          />
        </div>
      </main>

      <Footer onToast={onToast} />

      {placing && (
        <div className="co-overlay" role="alert" aria-live="assertive">
          <div className="co-overlay__box">
            <span className="btn-spinner" aria-hidden="true" />
            <p>Đang tạo đơn hàng, vui lòng không tắt trang…</p>
          </div>
        </div>
      )}
    </div>
  );
}
