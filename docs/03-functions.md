# 03 — Danh mục chức năng — Web bán hàng nội thất

> Mỗi chức năng: mục đích · actor · input/output · business rules · edge cases · liên kết FR (01-SRE) & entity (02-ERD).

## Nhóm A — Trang chủ & catalog

### F-001 — Hiển thị trang chủ
- **Mục đích:** đón khách bằng banner, danh mục nổi bật, sản phẩm nổi bật/bán chạy/mới nhất.
- **Actor:** GUEST, CUSTOMER.
- **Input:** (không).
- **Output:** banner đang bật (theo sortOrder), ≤8 danh mục, 3 khối sản phẩm (mỗi khối ≤10).
- **Business rules:** chỉ lấy `Product.active=true`; "bán chạy" sắp theo `soldCount` 30 ngày gần nhất **[Giả định]**.
- **Edge cases:** chưa có banner → ẩn khối banner, không vỡ layout.
- **→ FR:** FR-001 · **→ Entity:** Banner, Product, Category.

### F-002 — Duyệt catalog theo danh mục + lọc + sắp xếp
- **Mục đích:** tìm sản phẩm trong danh mục với bộ lọc.
- **Actor:** GUEST, CUSTOMER.
- **Input:** `categorySlug`, `page`, `size` (mặc định 24), filter `{priceMin, priceMax, colors[], materials[], sizes[]}`, `sort` (price_asc|price_desc|popular|newest).
- **Output:** `PageResponse<ProductCard>` (ảnh đại diện, tên, giá từ, ratingAvg, còn hàng/không).
- **Business rules:** "giá từ" = min price trong các **màu** còn hàng (biến thể theo dõi đến cấp màu — QĐ 2026-10-10); sản phẩm hết toàn bộ màu vẫn hiện nhưng gắn nhãn "Hết hàng" **[Giả định]**.
- **Edge cases:** filter không ra kết quả → trả rỗng + gợi ý nới điều kiện.
- **→ FR:** FR-002, FR-003 · **→ Entity:** Product, ProductVariant, Category.

### F-003 — Tìm kiếm sản phẩm
- **Mục đích:** tìm nhanh theo từ khóa.
- **Actor:** GUEST, CUSTOMER.
- **Input:** `q` (chuỗi), `page`, `size`.
- **Output:** danh sách product card như F-002, xếp theo độ liên quan.
- **Business rules:** tìm trên `name`, `description`, tên category; không dấu vẫn ra có dấu **[Giả định: dùng text index + normalize]**.
- **Edge cases:** `q` rỗng → trả về rỗng, không trả toàn bộ catalog.
- **→ FR:** FR-004 · **→ Entity:** Product, Category.

### F-004 — Xem chi tiết sản phẩm
- **Mục đích:** trang quyết định mua: ảnh, thông số, chọn màu sắc, giá/tồn theo màu.
- **Actor:** GUEST, CUSTOMER.
- **Input:** `productSlug`, `color?`.
- **Output:** Product đầy đủ + colors[] (sku, color, price, stock) + reviews tóm tắt + sản phẩm liên quan (cùng category, ≤8).
- **Business rules:** mặc định chọn màu còn hàng rẻ nhất; màu hết hàng disable nút mua.
- **Edge cases:** slug không tồn tại / `active=false` → 404.
- **→ FR:** FR-005, FR-006 · **→ Entity:** Product, ProductVariant, Review.

## Nhóm B — Giỏ hàng & đặt hàng

### F-005 — Quản lý giỏ hàng
- **Mục đích:** thêm/sửa/xóa mặt hàng (theo biến thể).
- **Actor:** GUEST (lưu localStorage), CUSTOMER (lưu server — Cart).
- **Input:** `variantId`, `qty` (1..99).
- **Output:** Cart hiện tại + subtotal.
- **Business rules:** `qty` không vượt `variant.stock` (cảnh báo ngay ở FE, chặn cứng ở BE khi checkout); giá lấy tại thời điểm thêm, **chốt lại giá lúc thanh toán** nếu giá đổi **[Giả định]**.
- **Edge cases:** variant bị xóa/ngừng bán → tự loại khỏi giỏ kèm thông báo.
- **→ FR:** FR-007 · **→ Entity:** Cart, ProductVariant.

### F-006 — Gộp giỏ khi đăng nhập
- **Mục đích:** không mất giỏ của khách vãng lai sau khi login.
- **Actor:** CUSTOMER (ngay sau login).
- **Input:** giỏ local + Cart server.
- **Output:** Cart đã gộp.
- **Business rules:** cùng variant → cộng dồn (trần = stock); khác variant → giữ cả hai.
- **→ FR:** FR-008 · **→ Entity:** Cart.

### F-007 — Đặt hàng (checkout)
- **Mục đích:** tạo đơn từ giỏ.
- **Actor:** CUSTOMER **đã xác thực SĐT** (FR-030) — **không có guest checkout** (QĐ 2026-10-10).
- **Input:** `receiver{...}`, `addressId?`, `voucherCode?`, `paymentMethod`, `note?`.
- **Output:** Order (orderNumber, totals, status=MỚI) + Payment tương ứng.
- **Business rules:**
  1. Chặn cứng nếu `user.phoneVerified != true` → trả lỗi kèm hướng dẫn xác thực (F-024).
  2. Áp voucher: kiểm tra `active`, thời gian hiệu lực, `minOrderValue`, `usedCount < totalUsageLimit` → tính discount (PERCENT có `maxDiscount`); tăng `usedCount` nguyên tử.
  3. Trừ `stock` nguyên tử theo từng màu (`stock >= qty`, cấm âm kho); màu nào hết → cả đơn bị từ chối kèm danh sách.
  4. Snapshot giá/tên/màu/receiver vào Order (02-ERD §3).
  5. **Phí ship theo tổng diện tích** (FR-029): `totalArea = Σ(variant.lengthM × variant.widthM × qty)` → tra bảng `SHIPPING_RULE` đang active → `shippingFee`; đơn đạt ngưỡng miễn phí (admin cấu hình) → `shippingFee = 0`.
- **Edge cases:** 2 người mua màu cuối cùng cùng lúc → người sau nhận lỗi "vừa hết hàng".
- **→ FR:** FR-009, FR-010, FR-011, FR-019, FR-029, FR-030 · **→ Entity:** Order, Payment, ProductVariant, Voucher, Cart, ShippingRule.

### F-008 — Thanh toán
- **Mục đích:** xử lý tiền theo phương thức đã chọn.
- **Actor:** CUSTOMER; hệ thống (webhook MoMo).
- **Input:** `orderId`, `paymentMethod`.
- **Output:** Payment.status cập nhật.
- **Business rules:**
  - COD: `payment.status=CHƯA THANH TOÁN`, thu khi giao xong.
  - BANK_TRANSFER: sinh nội dung chuyển khoản `NT<orderNumber>`; admin xác nhận thủ công **[Giả định]**.
  - **MOMO (tích hợp thật — QĐ 2026-10-10):** backend tạo payment request qua MoMo API (partnerCode/merchant account cấu hình ở server, tuyệt đối không lộ secret ra frontend) → khách quét mã / xác nhận trên app MoMo → MoMo gọi webhook IPN về backend → đối chiếu `momoOrderId` + chữ ký → `ĐÃ THANH TOÁN`; thất bại / quá 30 phút chưa thanh toán → đơn tự hủy + hoàn kho + hoàn lượt voucher **[Giả định: 30 phút]**.
- **Edge cases:** webhook trùng/lặp → idempotent theo `providerRef` (MoMo transId); webhook đến sau khi đơn đã tự hủy → ghi log, không trừ kho lần 2.
- **→ FR:** FR-010 · **→ Entity:** Payment, Order.

### F-009 — Theo dõi & hủy đơn
- **Mục đích:** khách xem tiến trình đơn; hủy khi còn được phép.
- **Actor:** CUSTOMER (đơn của mình), ADMIN (mọi đơn).
- **Input:** `orderNumber`; hủy: `reason?`.
- **Output:** timeline trạng thái (từ `statusHistory`).
- **Business rules:** chỉ hủy khi `status=MỚI`; hủy → hoàn `stock`, hoàn `usedCount` voucher; mọi chuyển trạng thái đều ghi `statusHistory`.
- **Edge cases:** hủy đơn đã ĐANG GIAO → từ chối, hướng dẫn liên hệ shop.
- **→ FR:** FR-012, FR-013, FR-016 · **→ Entity:** Order.

## Nhóm C — Tài khoản

### F-010 — Đăng ký / đăng nhập
- **Mục đích:** xác thực khách hàng.
- **Actor:** GUEST → CUSTOMER.
- **Input:** email + password (đăng ký thêm fullName, **phone bắt buộc**); hoặc Google OAuth2 (sau đó bổ sung SĐT).
- **Output:** JWT + thông tin user.
- **Business rules:** email unique (lowercase); password ≥ 8 ký tự, hash bcrypt; sai 5 lần → khóa 15 phút **[Giả định]**; SĐT phải được xác thực qua OTP (F-024) trước khi đặt hàng (FR-030).
- **→ FR:** FR-014, FR-030 · **→ Entity:** User.

### F-011 — Quản lý hồ sơ & sổ địa chỉ
- **Mục đích:** sửa thông tin cá nhân, thêm/sửa/xóa địa chỉ giao hàng.
- **Actor:** CUSTOMER.
- **Business rules:** tối đa 5 địa chỉ **[Giả định]**; luôn có đúng 1 mặc định; xóa địa chỉ đang là mặc định → tự chuyển mặc định sang địa chỉ còn lại đầu tiên.
- **→ FR:** FR-015 · **→ Entity:** User (addresses embedded).

## Nhóm D — Tương tác & khuyến mãi

### F-012 — Đánh giá sản phẩm
- **Mục đích:** review sau mua.
- **Actor:** CUSTOMER.
- **Input:** `productId`, `rating` 1–5, `comment?`, `images[]?`.
- **Output:** Review; cập nhật `ratingAvg`/`ratingCount` của Product.
- **Business rules:** chỉ khi có Order HOÀN THÀNH chứa sản phẩm; 1 user 1 review/sản phẩm (được sửa); cấm từ ngữ thô tục **[Giả định: filter từ khóa]**.
- **Edge cases:** đánh giá sản phẩm đã bị ẩn → review vẫn giữ nhưng không hiển thị ở trang public.
- **→ FR:** FR-017 · **→ Entity:** Review, Product, Order.

### F-013 — Wishlist
- **Mục đích:** lưu sản phẩm yêu thích.
- **Actor:** CUSTOMER.
- **Business rules:** 1 cặp (user, product) duy nhất; sản phẩm ngừng bán → giữ trong wishlist kèm nhãn.
- **→ FR:** FR-018 · **→ Entity:** WishlistItem.

## Nhóm E — Quản trị

### F-014 — Quản lý sản phẩm & màu sắc (CRUD)
- **Actor:** ADMIN.
- **Business rules:** mỗi **màu** bắt buộc có `sku` unique, `price > 0`, `stock ≥ 0`, `lengthM/widthM > 0` (phục vụ tính phí ship); tắt `active` thay vì xóa cứng khi đã có đơn liên quan; upload nhiều ảnh (tối đa 10/sản phẩm **[Giả định]**).
- **→ FR:** FR-020 · **→ Entity:** Product, ProductVariant.

### F-015 — Quản lý danh mục (CRUD)
- **Actor:** ADMIN.
- **Business rules:** cây 2 cấp (cha/con); không xóa danh mục còn sản phẩm; `slug` unique.
- **→ FR:** FR-021 · **→ Entity:** Category.

### F-016 — Quản lý đơn hàng
- **Actor:** ADMIN.
- **Input:** lọc theo trạng thái/khoảng ngày/từ khóa; cập nhật trạng thái.
- **Business rules:** chỉ chuyển theo vòng đời FR-012 (dùng ma trận như ClaimStatus ở insuren); ĐANG GIAO → yêu cầu nhập mã vận đơn **[Giả định]**; ghi `note` nội bộ không hiện cho khách.
- **→ FR:** FR-022 · **→ Entity:** Order.

### F-017 — Quản lý tồn kho & cảnh báo
- **Actor:** ADMIN.
- **Output:** danh sách variant sắp hết (`stock ≤ lowStockThreshold`), lịch sử biến động **[Giả định: log nhập/xuất kho]**.
- **Business rules:** `lowStockThreshold` cấu hình được từng variant, mặc định 5.
- **→ FR:** FR-023 · **→ Entity:** ProductVariant.

### F-018 — Quản lý voucher (CRUD)
- **Actor:** ADMIN.
- **Business rules:** `code` unique, in hoa; không cho tạo voucher `endAt < startAt`; voucher đang có đơn dùng → chỉ được tắt, không xóa.
- **→ FR:** FR-024 · **→ Entity:** Voucher.

### F-019 — Quản lý khách hàng
- **Actor:** ADMIN.
- **Output:** danh sách + chi tiết (đơn đã mua, tổng chi tiêu); khóa/mở tài khoản.
- **Business rules:** khóa tài khoản không xóa lịch sử đơn.
- **→ FR:** FR-025 · **→ Entity:** User, Order.

### F-020 — Báo cáo doanh thu
- **Actor:** ADMIN.
- **Input:** khoảng thời gian, nhóm theo ngày/tuần/tháng.
- **Output:** tổng doanh thu (chỉ tính đơn HOÀN THÀNH + COD đã thu **[Giả định]**), số đơn theo trạng thái, top 10 sản phẩm, doanh thu theo danh mục.
- **→ FR:** FR-026 · **→ Entity:** Order, Product, Category.

### F-021 — Quản lý banner trang chủ
- **Actor:** ADMIN.
- **Business rules:** kéo-thả sắp xếp `sortOrder`; chỉ banner `active` mới hiện.
- **→ FR:** FR-027 · **→ Entity:** Banner.

## Nhóm F — Chức năng bổ sung (quyết định 2026-10-10)

### F-022 — Flash sale
- **Mục đích:** bán giảm giá giới hạn thời gian + số lượng, có đếm ngược.
- **Actor:** ADMIN (tạo/cấu hình), CUSTOMER (mua).
- **Input (admin):** `type=FLASH_SALE`, danh sách sản phẩm/màu áp dụng, giá flash sale hoặc % giảm, `startAt`, `endAt`, `totalUsageLimit` (tổng suất).
- **Output (khách):** trang/block flash sale hiển thị đếm ngược, % đã bán, giá gốc gạch ngang.
- **Business rules:** chỉ áp trong khung giờ + còn suất (`usedCount < totalUsageLimit`, tăng nguyên tử); hết giờ hoặc hết suất → tự đóng, giá về bình thường; 1 khách tối đa 2 suất/flash sale **[Giả định]**; không cộng dồn với voucher thường.
- **Edge cases:** 2 khách tranh suất cuối → người sau báo hết suất.
- **→ FR:** FR-028, FR-019 · **→ Entity:** Voucher, Product, ProductVariant.

### F-023 — Cấu hình & tính phí vận chuyển theo diện tích
- **Mục đích:** admin tự cấu hình bảng phí ship; hệ thống tự tính phí theo tổng diện tích đơn.
- **Actor:** ADMIN (cấu hình), hệ thống (tính phí lúc checkout).
- **Input (admin):** CRUD `SHIPPING_RULE` (nấc diện tích → phí), ngưỡng + điều kiện miễn phí.
- **Business rules:** `totalAreaM2 = Σ(lengthM × widthM × qty)`; tra nấc phù hợp đang `active`; đơn đạt ngưỡng miễn phí → phí = 0; đơn > 10 m² → hiển thị "Liên hệ báo giá" và chặn checkout online **[Giả định]**.
- **→ FR:** FR-029 · **→ Entity:** ShippingRule, Order, ProductVariant.

### F-024 — Xác thực số điện thoại (OTP)
- **Mục đích:** xác thực SĐT là chính chủ trước khi cho đặt hàng.
- **Actor:** CUSTOMER.
- **Input:** `phone`, `otp` (6 số).
- **Output:** `user.phoneVerified = true`.
- **Business rules:** OTP có hiệu lực 5 phút, tối đa 5 lần nhập sai **[Giả định]**; gửi lại OTP cách nhau tối thiểu 60 giây; đổi SĐT → phải xác thực lại; provider SMS cấu hình ở server **[Giả định]**; lưu trữ: collection `otps` — mã 6 số lưu dạng hash bcrypt (không lưu plain, không log plain), TTL tự xóa khi hết 5 phút, unique theo phone (1 phone = 1 tài khoản đã xác thực).
- **Edge cases:** SĐT đã được tài khoản khác xác thực → từ chối, hướng dẫn liên hệ hỗ trợ.
- **→ FR:** FR-030 · **→ Entity:** User.
