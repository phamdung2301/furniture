# Spec giao diện — Đặt hàng / Checkout (dat-hang)

- **Dự án:** noi-that-shop · **Màn:** Đặt hàng (màn 7, wave 2: Mua hàng)
- **Nguồn:** US-007 · FR-009, FR-010, FR-011, FR-019, FR-029, FR-030 · F-007, F-008, F-023 · Entities: Order, OrderItem, Voucher, ShippingRule, Address, Payment
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** tái dùng nguyên xi §0 của `trang-chu.md` (tokens warm wood, Be Vietnam Pro, components Nút Primary/Secondary, Badge, Card). Không định nghĩa lại.

---

## §1. Bố cục tổng thể

Route `/dat-hang`. Layout 2 cột, stepper tiến trình ở đầu trang:

**Stepper 4 bước (horizontal, desktop):**
1. **Thông tin nhận hàng** — chọn địa chỉ đã lưu / thêm mới
2. **Mã ưu đãi** — nhập + áp mã, danh sách mã khả dụng
3. **Phương thức thanh toán** — MoMo / COD / Chuyển khoản ngân hàng
4. **Xác nhận đơn** — tóm tắt toàn bộ + nút "Đặt hàng"

- Stepper click được để quay lại bước trước đã hoàn thành (bước chưa xong không cho nhảy tới).
- Cột trái (8/12): nội dung từng bước. Cột phải (4/12): **Tóm tắt đơn sticky** (luôn hiện từ bước 1) — xem §5.
- Mobile: stepper thu gọn thành "Bước X/4 — tên bước", cột phải thành bottom sheet collapsible (tổng tiền + nút "Xem chi tiết" mở rộng), nút "Đặt hàng" sticky bottom ở bước 4.
- Breadcrumb: Giỏ hàng → Đặt hàng.

**Thứ tự ưu tiên hiển thị:** tóm tắt đơn (tiền) > địa chỉ nhận > thanh toán > voucher. Nút primary của mỗi bước: "Tiếp tục" → cuối là "Đặt hàng" (Primary lớn, full-width mobile).

## §2. Bước 1 — Thông tin nhận hàng → FR-009, F-007

### 2.1 Danh sách địa chỉ đã lưu
- Radio list các địa chỉ của user (entity `Address`: label "Nhà"/"Công ty", receiverName, phone, province/district/ward/detail). Địa chỉ mặc định (`isDefault`) được chọn sẵn, gắn tag "Mặc định" (Badge success).
- Mỗi dòng: tên người nhận (bold), SĐT, địa chỉ đầy đủ 1 dòng, 2 action nhỏ: "Sửa" / "Xóa" (xóa hỏi confirm nhẹ; xóa địa chỉ mặc định → chuyển mặc định sang địa chỉ còn lại đầu tiên — F-011).
- Nút secondary "+ Thêm địa chỉ mới" → mở rộng form ngay trong trang (không modal, giữ context).

### 2.2 Form địa chỉ mới
- Fields: Họ tên người nhận*, SĐT* (validate 10 số, đầu 0), Tỉnh/Thành phố* (dropdown), Quận/Huyện* (dropdown, phụ thuộc tỉnh), Phường/Xã* (dropdown, phụ thuộc quận), Địa chỉ chi tiết* (số nhà, đường), Ghi chú giao hàng (optional, VD: "gọi trước 30 phút"), checkbox "Đặt làm mặc định", label chọn nhanh "Nhà / Công ty" (chips).
- Validate inline từng field, border đỏ + message nhỏ dưới field; nút "Lưu địa chỉ" disabled cho đến khi hợp lệ.
- Tối đa 5 địa chỉ (F-011 [Giả định]) — đủ 5 thì ẩn nút thêm, hiện hint "Bạn đã lưu tối đa 5 địa chỉ".

### 2.3 Guard xác thực SĐT (FR-030, F-007 rule 1)
- Nếu `user.phoneVerified != true`: chặn toàn bộ checkout — banner cảnh báo vàng đầu trang: "Bạn cần xác thực số điện thoại trước khi đặt hàng." + nút Primary "Xác thực ngay" (đi tới màn OTP, returnTo=/dat-hang). Các bước dưới mờ đi (disabled), không cho tương tác.
- Demo: có toggle "Mô phỏng chưa xác thực SĐT".

## §3. Bước 2 — Mã ưu đãi → FR-019, F-007 rule 2

- Ô nhập mã (uppercase tự động, placeholder "Nhập mã ưu đãi") + nút "Áp dụng" (secondary).
- **Danh sách mã khả dụng của user**: các voucher `active`, còn hiệu lực, thỏa `minOrderValue` — mỗi mã 1 card nhỏ: code (bold, copy được khi click), mô tả ("Giảm 50% tối đa 200.000đ — đơn từ 1.000.000đ"), nút "Dùng ngay". Mã không đủ điều kiện (chưa đạt đơn tối thiểu / hết lượt) hiện mờ + lý do nhỏ bên dưới ("Cần thêm 300.000đ để dùng mã này").
- Áp thành công: dòng giảm giá xuất hiện trong tóm tắt đơn (xanh lá, "-200.000đ"), badge "Đã áp dụng" trên mã, nút "Gỡ" để đổi mã khác. **Mỗi đơn chỉ 1 voucher** (FR-019 [Giả định]).
- Áp thất bại: message đỏ cụ thể từng case: "Mã đã hết hạn." / "Mã đã hết lượt sử dụng." / "Đơn hàng chưa đạt giá trị tối thiểu 1.000.000đ." — không message chung chung.
- Lưu ý nhỏ dưới khối: "Mã ưu đãi chỉ áp dụng ở bước này." (nhất quán với màn Giỏ hàng đã cố ý không có ô nhập).

## §4. Bước 3 — Phương thức thanh toán → FR-010, F-008

3 radio card (icon + tên + mô tả 1 dòng), chọn 1:

1. **Ví MoMo** (khuyến nghị — tag "Nhanh & an toàn"): "Quét mã QR hoặc xác nhận trên app MoMo." → sang màn 8 xử lý thật: backend tạo payment request → hiện QR → webhook IPN đối soát. *Lưu ý UI: tuyệt đối không hiện secret/key MoMo ở frontend (F-008).*
2. **Thanh toán khi nhận hàng (COD)**: "Kiểm tra hàng rồi mới trả tiền." → tạo đơn luôn, sang trang thành công (xem §6).
3. **Chuyển khoản ngân hàng**: "Chuyển khoản theo nội dung hiển thị sau khi đặt hàng." → tạo đơn, trang thành công hiện nội dung CK `NT<orderNumber>` + số tài khoản shop (F-008 [Giả định: admin xác nhận thủ công]).

- Card được chọn: viền `--brand-700` 2px + check icon. Không cho "Tiếp tục" khi chưa chọn phương thức (mặc định chọn sẵn COD để giảm ma sát — quyết định UI, không trái docs).

## §5. Bước 4 — Xác nhận đơn + Tóm tắt đơn sticky → F-007 rule 3/4/5

### 5.1 Khối xác nhận (cột trái)
- **Địa chỉ nhận hàng** (card tóm tắt: tên, SĐT, địa chỉ) + link "Thay đổi" (quay về bước 1).
- **Phương thức thanh toán** (tên + mô tả ngắn) + link "Thay đổi".
- **Danh sách món**: mỗi dòng — ảnh 64px, tên sản phẩm, chấm màu + tên màu, SL × đơn giá, thành tiền dòng. Không cho sửa số lượng ở đây (quay về giỏ nếu muốn đổi — link "Sửa giỏ hàng").
- **Ghi chú đơn hàng** (textarea optional, placeholder "Ghi chú cho shop (không bắt buộc)").

### 5.2 Tóm tắt đơn sticky (cột phải, hiện từ bước 1)
- Từng dòng: Tạm tính (tổng giá hàng) → Giảm giá voucher (xanh lá, "-Xđ"; chưa áp mã thì dòng này ẩn) → **Phí vận chuyển** (§5.3) → divider → **TỔNG CỘNG** (20px/700, `--brand-700`).
- Phí ship hiển thị ngay từ bước 1 (tính từ giỏ hiện tại) — không đợi đến bước cuối mới "bất ngờ".

### 5.3 Phí ship minh bạch theo diện tích → FR-029, F-023
- Dòng phí ship có icon ⓘ → tooltip/popover: "Phí ship tính theo tổng diện tích chiếm chỗ của đơn hàng: **{totalArea} m²** → nấc {tier}." Kèm breakdown nhỏ (VD: "Sofa góc L 3.8 m² × 1 + Ghế ăn 0.2 m² × 2 = 4.2 m²").
- Bảng nấc áp dụng (admin cấu hình trong `SHIPPING_RULE`, giá trị demo):
  - ≤ 1 m² → 100.000đ · 1–3 m² → 200.000đ · 3–6 m² → 350.000đ · 6–10 m² → 550.000đ
- **Miễn phí** khi đơn ≥ 10.000.000đ: dòng phí ship hiện "Miễn phí" (xanh lá, gạch giá gốc) + tooltip "Đơn từ 10.000.000đ được miễn phí vận chuyển." [Giả định theo 02-ERD §4].
- **Đơn > 10 m²**: phí ship hiện "Liên hệ báo giá", nút "Đặt hàng" disabled + banner: "Đơn hàng vượt 10 m² cần báo giá riêng — vui lòng liên hệ hotline." (F-023 [Giả định]: chặn checkout online).

### 5.4 Nút "Đặt hàng"
- Primary lớn, label "Đặt hàng · {total}đ". Click → loading spinner trên nút ("Đang tạo đơn..."), disable double-click.
- Trước khi gọi API: chạy lại `validateCart()` (giá/tồn chốt lại — F-005/F-007): món nào hết hàng lúc chốt → banner đỏ liệt kê + nút "Quay về giỏ hàng", không tạo đơn.

## §6. Guard + trạng thái loading / empty / error

### Guard vào trang
- **Giỏ trống** → redirect ngay về `/gio-hang` (không render checkout rỗng).
- **Chưa login** → đã xử lý ở màn 5/6 (`/dang-nhap?returnTo=/dat-hang`); nếu lọt vào mà không có token → redirect login giữ nguyên returnTo.
- **Chưa xác thực SĐT** → banner chặn như §2.3 (FR-030).

### Loading
- Tạo đơn: spinner trên nút + overlay nhẹ ngăn thao tác ("Đang tạo đơn hàng, vui lòng không tắt trang...").

### Error (từng case, tiếng Việt cụ thể)
- Hết hàng lúc chốt (US-008): "Sản phẩm {tên} (màu {màu}) vừa hết hàng. Đơn chưa được tạo." + nút "Quay về giỏ hàng".
- Voucher lỗi lúc chốt: "Mã {code} không còn hiệu lực. Vui lòng chọn mã khác." (quay bước 2).
- MoMo thất bại / quá 30 phút chưa thanh toán (màn 8, F-008 [Giả định]): đơn tự hủy + hoàn kho + hoàn lượt voucher — trang trạng thái đơn hiển thị "Đơn đã hủy do quá thời gian thanh toán."
- Lỗi mạng: "Có lỗi xảy ra, vui lòng thử lại." + nút "Thử lại".

### Success
- **COD**: → trang thành công `/dat-hang/thanh-cong?order=NT-...`: icon check xanh lớn, "Đặt hàng thành công!", mã đơn `NT-20261011-0001` (copy được), tóm tắt (tổng tiền, địa chỉ, COD), 2 CTA: "Theo dõi đơn hàng" (→ màn 9) + "Tiếp tục mua sắm". Giỏ hàng được xóa sau khi đặt thành công.
- **Chuyển khoản**: trang thành công + khối "Thông tin chuyển khoản": số TK shop, nội dung `NT<orderNumber>`, số tiền — nút "Sao chép" từng dòng.
- **MoMo**: → màn 8 (Thanh toán) xử lý QR/webhook, không ở màn này.

## §7. Contract backend + dữ liệu mẫu (builder implement)

**Endpoints (khớp F-007, đã có ở backend từ màn 5/6 — builder dùng mock):**
- `POST /orders` — body: `{ addressId | receiver{...}, voucherCode?, paymentMethod: COD|BANK_TRANSFER|MOMO, note? }` → `201 { orderNumber, total, paymentMethod, status: "MỚI" }`
- `GET /vouchers/available` → `[{ code, type, value, maxDiscount, minOrderValue, description, eligible, reason? }]`
- `POST /vouchers/validate` — body `{ code, subtotal }` → `{ valid, discount, message? }`
- `POST /shipping/quote` — body `{ items: [{ variantId, qty }] }` → `{ totalAreaM2, tier: {min,max}, fee, freeShipping, overLimit }`
- `GET /addresses` / `POST /addresses` (đã có từ màn 6 — F-011)

**Dữ liệu mẫu demo** (giỏ: Sofa góc L Nordic màu Xám ×1 = 12.900.000đ + Ghế ăn bọc vải ×2 = 2×1.450.000đ; voucher: `NOITHAT50` giảm 50% tối đa 200.000đ đơn từ 1.000.000đ; 2 voucher khả dụng + 1 voucher chưa đủ điều kiện để demo trạng thái mờ):
- Tạm tính 15.800.000đ → giảm 200.000đ → tổng diện tích 4.2 m² → nấc 3–6 m² = 350.000đ nhưng đơn ≥ 10.000.000đ → **miễn phí** → TỔNG 15.600.000đ.
- Toggle demo: "Chưa xác thực SĐT", "Đơn > 10 m²" (thử case chặn checkout), "Hết hàng lúc chốt".

## §8. Traceability

| Mục spec | Nguồn |
|---|---|
| Stepper 4 bước, chọn/sửa địa chỉ, form địa chỉ mới (tối đa 5, 1 mặc định) | FR-009 · F-007 · F-011 |
| Chặn checkout khi `phoneVerified=false` + CTA xác thực | FR-030 · F-007 rule 1 |
| Ô nhập mã + danh sách mã khả dụng, 1 voucher/đơn, message lỗi từng case | FR-019 · F-007 rule 2 · US-007 |
| 3 phương thức: MoMo / COD / Chuyển khoản; MoMo sang màn 8, không lộ secret ở FE | FR-010 · F-008 |
| Snapshot giá/tên/màu/receiver vào Order; trừ stock nguyên tử; validate lại trước tạo đơn | FR-011 · F-007 rule 3/4 |
| Phí ship = Σ(lengthM×widthM×qty) → tra SHIPPING_RULE; tooltip breakdown m²; miễn phí ≥ 10.000.000đ; >10 m² chặn + liên hệ báo giá | FR-029 · F-023 · 02-ERD §4 |
| Hết hàng lúc chốt (2 người mua) → từ chối + liệt kê món | US-008 · F-007 edge case |
| COD/Bank → trang thành công (mã đơn, nội dung CK `NT<orderNumber>`); MoMo → màn 8 | F-008 |
| Giỏ trống → /gio-hang; chưa login → returnTo=/dat-hang (kế thừa màn 5/6) | FR-007 · FR-009 |
| Text tiếng Việt, không mã nội bộ (không hiện SKU) | copy-ux-linter |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Mã ưu đãi`, `Áp dụng`, `Phí vận chuyển`, `Miễn phí vận chuyển`, `Tạm tính`, `Tổng cộng`, `Đặt hàng`, `Thanh toán khi nhận hàng (COD)`, `Chuyển khoản ngân hàng`, `Ví MoMo`.
