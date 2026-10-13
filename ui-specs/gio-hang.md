# Spec giao diện — Giỏ hàng (gio-hang)

- **Dự án:** noi-that-shop · **Màn:** Giỏ hàng (màn 5)
- **Nguồn:** US-005 · FR-007 · FR-008 · F-005 · F-006
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Ghi chú:** Tái dùng nguyên design system spec Trang chủ §0 (tokens, typography, Button/Badge/Skeleton) + `QtySelector` từ màn Chi tiết sản phẩm. Giỏ hàng dùng đúng shape `utils/cart.js` (key `mocan_cart_v1`): item `{ variantId, productId, productName, color, colorHex, price, image, stock, qty }`. Không hiển thị SKU/mã nội bộ (bài học insuren).

---

## §1. Bố cục tổng thể

**Route:** `/gio-hang`

1. Breadcrumb: `Trang chủ / Giỏ hàng`
2. H1: `Giỏ hàng` + đếm `({N} sản phẩm)` — N = tổng qty.
3. Desktop: 2 cột — **trái 8/12** danh sách dòng hàng · **phải 4/12** tóm tắt đơn (sticky top).
4. Mobile: xếp chồng — danh sách trước, tóm tắt thành **sticky bottom bar** (tạm tính + nút "Đặt hàng").

**Mini-cart drawer:** bấm icon giỏ ở header → drawer trượt từ phải (rộng 380px desktop / full-width mobile), xem §4.

---

## §2. Dòng hàng (cart line item) → F-005, FR-007

Mỗi dòng = 1 biến thể (màu), đúng FR-007 "theo biến thể":

- **Ảnh:** 96×96px, bo `12px`, `object-fit: cover`; click → trang chi tiết sản phẩm.
- **Tên sản phẩm** 15px/600 (click → chi tiết) + dòng phụ 13px `--text-muted`: `Màu: {color}` kèm chấm màu `colorHex` 14px tròn.
- **Đơn giá:** 14px/600 `--brand-700`, định dạng `vi-VN` + `đ`.
- **Stepper số lượng:** tái dùng `QtySelector` (màn 4) — giới hạn `1..min(99, stock)` (F-005: input `qty` 1..99, không vượt `variant.stock`).
- **Thành tiền dòng:** 16px/700 `--brand-700` = `price × qty`, cập nhật ngay khi stepper đổi.
- **Nút xóa:** icon thùng rác, click → xóa ngay + **toast có nút "Hoàn tác"** (5s) — không confirm dialog rườm rà.
- Layout dòng: desktop 1 hàng ngang `[ảnh | tên+màu | đơn giá | stepper | thành tiền | xóa]`; mobile wrap: ảnh + tên/màu/đơn giá hàng 1, stepper + thành tiền + xóa hàng 2.

**Tăng quá stock:** bấm `+` khi `qty+1 > stock` → chặn, stepper không nhích, hiện **tooltip đỏ** trên stepper: `Chỉ còn {stock} sản phẩm` (F-005: "cảnh báo ngay ở FE"). Tooltip tự ẩn sau 2.5s.

**Giá đổi so với lúc thêm:** khi validate giỏ (tải trang) phát hiện `currentPrice != item.price` → dòng hàng hiện **dải cảnh báo vàng** dưới tên: `⚠ Giá đã thay đổi: {giá cũ} → {giá mới}` + nút text **"Cập nhật giá"** → cập nhật `price` về giá mới, toast xác nhận. Giá chốt lại lúc thanh toán theo F-005 — đây là cảnh báo sớm ở FE.

**Variant bị xóa/ngừng bán:** validate phát hiện variant không tồn tại hoặc `active=false` → **tự loại khỏi giỏ** + toast giải thích: `"{Tên SP} — {màu}" không còn kinh doanh, đã được bỏ khỏi giỏ hàng` (F-005 edge case).

---

## §3. Tóm tắt đơn (summary column) → F-005, FR-007

Card trắng, bo `16px`, viền `--border`, padding 24px, sticky:

- H2 `Tóm tắt đơn hàng` 18px/700.
- Hàng `Tạm tính` — số tiền 16px/700 `--brand-700` (Σ price×qty).
- Hàng `Phí vận chuyển` — text muted 13px: `Tính ở bước đặt hàng` + icon ⓘ (tooltip: "Phí ship được tính theo tổng diện tích đơn hàng khi bạn đặt hàng").
- Divider + hàng `Tổng cộng (tạm tính)` — 18px/800 `--brand-700`.
- **Voucher:** KHÔNG có ô nhập mã ở màn này. Chỉ 1 dòng muted kèm icon tag: `Mã giảm giá sẽ được áp dụng ở bước đặt hàng` (F-007: voucher áp ở checkout — ghi rõ để tránh nhầm).
- CTA: nút Primary full-width **`Đặt hàng`** → `/dat-hang` (khách vãng lai bấm vẫn đi tiếp; checkout tự chuyển hướng đăng nhập nếu chưa login — thuộc màn Đặt hàng, FR-009). Nút Secondary outline **`Tiếp tục mua sắm`** → `/`.
- Giỏ rỗng → ẩn toàn bộ cột tóm tắt (xem §6).

**Sticky bottom bar (mobile):** khi scroll, bar cố định dưới: `Tạm tính: {số tiền}` trái + nút Primary `Đặt hàng` phải.

---

## §4. Mini-cart drawer → FR-007, US-005

- Mở: click icon giỏ trên header (badge số dùng `useCartCount` — đã có).
- Drawer: trượt từ phải, overlay đen 40% (click overlay/Esc/nút × để đóng), focus trap nhẹ.
- Header drawer: `Giỏ hàng ({N})` + nút ×.
- Danh sách: **3–4 món gần nhất** (item mới thêm xếp cuối theo `cart.js` → lấy 4 item cuối, đảo thứ tự để món mới nhất lên đầu); mỗi dòng gọn: ảnh 56px, tên 14px, `Màu · ×qty`, thành tiền dòng.
- Footer drawer: `Tạm tính: {số tiền}` + 2 nút: Primary **`Đặt hàng`** → `/dat-hang` · Secondary **`Xem giỏ hàng`** → `/gio-hang`.
- Giỏ rỗng: text `Giỏ hàng đang trống` + nút Primary `Khám phá sản phẩm` → `/`.
- Cập nhật realtime: lắng nghe event `mocan:cart-changed` (đã có trong `cart.js`) — đổi từ màn khác drawer tự refresh.

---

## §5. Đồng bộ giỏ (builder implement) → F-005, F-006, FR-008

- `cart.js` cần thêm `updateQty(variantId, qty)` và `removeItem(variantId)` (cùng dispatch `mocan:cart-changed`).
- `validateCart()` chạy khi vào `/gio-hang` và khi mở drawer: so `stock`/`currentPrice`/`active` của từng variant với item trong giỏ → áp các cảnh báo §2 → lưu lại giỏ.
- **Gộp giỏ khi login (F-006 → FR-008):** sau login thành công, giỏ local gộp vào giỏ server — cùng variant cộng dồn (trần = stock), khác variant giữ cả hai. UI: toast `Đã gộp {N} sản phẩm từ giỏ hàng trước khi đăng nhập của bạn`.

---

## §6. Trạng thái loading / empty / error

- **Loading:** skeleton — 3 dòng skeleton (ảnh tròn + 2 thanh chữ + stepper giả) + skeleton card tóm tắt; dùng Skeleton có sẵn.
- **Empty:** illustration SVG line-art giỏ hàng trống (inline, tông `--brand-700` nhạt) + H2 `Giỏ hàng trống` + text muted `Hãy khám phá hàng trăm mẫu nội thất cho tổ ấm của bạn.` + nút Primary `Khám phá sản phẩm` → `/`. (Không hiện cột tóm tắt.)
- **Error:** validate/load thất bại → panel lỗi: icon ⚠ + `Không tải được giỏ hàng` + nút Secondary `Thử lại`.

---

## §7. Dữ liệu mẫu (mock đúng shape `cart.js`)

| # | Sản phẩm | variantId | Màu | Đơn giá | qty | stock | Ghi chú demo |
|---|---|---|---|---|---|---|---|
| 1 | Ghế ăn bọc vải (p5) | v51 | Xám | 1.250.000đ | 2 | 40 | Kịch bản US-005: thêm 2 ghế chưa login |
| 2 | Sofa góc L Nordic (p1) | v11 | Xám | **giá đã đổi** 13.500.000đ → 12.900.000đ | 1 | 12 | Demo dải cảnh báo "Giá đã thay đổi" |
| 3 | Giường ngủ gỗ óc chó 1m8 (p2) | v21 | Nâu óc chó | 15.500.000đ | 1 | **0** | Demo tự loại + toast "không còn kinh doanh" |
| 4 | Giường ngủ gỗ óc chó 1m8 (p2) | v22 | Vàng sồi | 14.900.000đ | 1 | 4 | Demo stepper chạm trần stock |

- Drawer demo hiển thị 3–4 món gần nhất (item 4 lên đầu).
- Empty state và error demo bằng toggle trong demo (theo pattern các màn trước).

---

## §8. Traceability

| Mục spec | Nguồn |
|---|---|
| Dòng hàng theo biến thể (ảnh/tên/màu/đơn giá/stepper/thành tiền/xóa) — §2 | FR-007, F-005 |
| Stepper `1..min(99, stock)`, vượt stock chặn + tooltip "Chỉ còn X sản phẩm" | F-005 (business rules) |
| Dải cảnh báo "Giá đã thay đổi" + nút cập nhật | F-005 (giá lấy lúc thêm, chốt lại lúc thanh toán) |
| Variant bị xóa/ngừng bán → tự loại + toast giải thích | F-005 (edge cases) |
| Tạm tính, phí ship "tính ở bước đặt hàng", tổng cộng tạm tính — §3 | F-005 (output: Cart + subtotal) |
| **Không** ô nhập voucher, chỉ dòng nhắc áp ở bước đặt hàng — §3 | F-007 |
| Mini-cart drawer (3–4 món gần nhất, tạm tính, 2 CTA) — §4 | FR-007 |
| Giỏ localStorage, tải lại trang còn nguyên (US-005) | FR-007, US-005 |
| Toast "Hoàn tác" khi xóa dòng hàng | — (UX, không bịa rule nghiệp vụ) |
| Gộp giỏ khi login: cộng dồn trần = stock — §5 | F-006 → FR-008 |
| Loading skeleton / Empty / Error + thử lại — §6 | Quy tắc chung (brief ui-prompt-architect #2) |

**Ngoài phạm vi màn này (không làm):** nhập voucher, tính phí ship, chọn địa chỉ/người nhận, phương thức thanh toán → thuộc màn Đặt hàng (F-007). Đăng nhập/OTP → màn riêng.
