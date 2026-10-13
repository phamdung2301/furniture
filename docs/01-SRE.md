# 01 — Tài liệu yêu cầu hệ thống (SRE) — Web bán hàng nội thất

> Dự án: **noi-that-shop** · Ngôn ngữ: tiếng Việt · Tiền tệ: VND
> Prompt gốc: "tôi cần build một trang web bán đồ nội thất đầy đủ mọi chức năng"

## 1. Tầm nhìn sản phẩm

Website thương mại điện tử chuyên đồ nội thất (sofa, bàn, ghế, giường, tủ, kệ, đèn, decor...) cho phép khách hàng duyệt catalog, tùy chọn biến thể (màu sắc / kích thước / chất liệu), đặt hàng và thanh toán trực tuyến; đội ngũ admin quản trị toàn bộ sản phẩm, đơn hàng, tồn kho, khuyến mãi và xem báo cáo doanh thu — tất cả trên một nền tảng duy nhất, giao diện tiếng Việt.

## 2. Phạm vi

**Trong phạm vi (In scope):**
- Catalog sản phẩm nội thất với biến thể, tìm kiếm, lọc, đánh giá
- Giỏ hàng, đặt hàng, thanh toán (COD / chuyển khoản / ví điện tử)
- Theo dõi đơn hàng, tài khoản khách hàng, wishlist
- Voucher / khuyến mãi
- Trang quản trị: sản phẩm, danh mục, đơn hàng, tồn kho, voucher, khách hàng, banner, báo cáo doanh thu

**Ngoài phạm vi (Out of scope) — [Giả định]:**
- App mobile native (chỉ web responsive)
- Tích hợp đơn vị vận chuyển bên thứ ba ở phase 1 (xem câu hỏi mở Q2)
- Chat trực tuyến với nhân viên tư vấn
- Đa ngôn ngữ / đa tiền tệ (chỉ tiếng Việt + VND)

## 3. Vai trò người dùng

| Mã | Vai trò | Mô tả |
|----|---------|-------|
| GUEST | Khách vãng lai | Duyệt web, tìm kiếm, xem sản phẩm, dùng giỏ hàng (lưu local) |
| CUSTOMER | Khách hàng | Mọi quyền của GUEST + đặt hàng, theo dõi đơn, đánh giá, wishlist, voucher, quản lý địa chỉ |
| ADMIN | Quản trị viên | Toàn quyền: quản lý sản phẩm/danh mục/đơn hàng/tồn kho/voucher/khách hàng/banner + xem báo cáo |

**[Giả định]:** phase 1 chỉ có 3 vai trò trên, chưa có vai trò nhân viên kho/CSKH riêng.

## 4. Yêu cầu chức năng (FR)

### 4.1 Trang chủ & catalog
- **FR-001** — Trang chủ hiển thị banner (quản trị được), danh mục nổi bật, sản phẩm nổi bật/bán chạy/mới nhất.
- **FR-002** — Xem danh sách sản phẩm theo danh mục, có phân trang.
- **FR-003** — Lọc sản phẩm theo khoảng giá, màu sắc, chất liệu, kích thước; sắp xếp theo giá / độ phổ biến / mới nhất.
- **FR-004** — Tìm kiếm theo từ khóa trên tên, mô tả, danh mục sản phẩm.
- **FR-005** — Xem chi tiết sản phẩm: thư viện ảnh, mô tả, thông số kỹ thuật, danh sách **màu sắc** kèm giá và tồn kho từng màu, sản phẩm liên quan. *(Quyết định 2026-10-10: biến thể theo dõi đến cấp **màu sắc** — mỗi màu có SKU/giá/tồn kho riêng; kích thước & chất liệu là thông số hiển thị của sản phẩm, không tách kho.)*
- **FR-006** — Xem điểm đánh giá trung bình và danh sách đánh giá của sản phẩm.

### 4.2 Giỏ hàng & đặt hàng
- **FR-007** — Thêm / sửa số lượng / xóa sản phẩm (theo biến thể) trong giỏ; GUEST dùng được, giỏ lưu ở trình duyệt.
- **FR-008** — Khi đăng nhập, giỏ local được gộp vào giỏ tài khoản.
- **FR-009** — Đặt hàng: **bắt buộc đăng nhập và SĐT đã xác thực** (không có guest checkout — quyết định 2026-10-10); nhập/chọn thông tin người nhận, địa chỉ giao hàng, ghi chú.
- **FR-010** — Thanh toán: COD, chuyển khoản ngân hàng **[Giả định: xác nhận thủ công]**, **ví MoMo tích hợp thật** (quyết định 2026-10-10: dùng merchant account MoMo, thanh toán qua MoMo API + webhook IPN đối soát).
- **FR-011** — Khi đơn được tạo thành công, tồn kho biến thể tương ứng bị trừ; khi đơn bị hủy, tồn kho được hoàn lại. *(Quy tắc tiền/hàng — numbered requirement.)*
- **FR-012** — Đơn hàng có vòng đời: `MỚI → ĐÃ XÁC NHẬN → ĐANG GIAO → HOÀN THÀNH`, nhánh `ĐÃ HỦY` (trước khi giao), nhánh `HOÀN TRẢ` (sau khi nhận, **[Giả định]** trong 7 ngày).
- **FR-013** — Khách được hủy đơn khi đơn còn ở trạng thái MỚI.

### 4.3 Tài khoản khách hàng
- **FR-014** — Đăng ký / đăng nhập bằng email + mật khẩu; đăng nhập Google OAuth2 *(kế thừa pattern từ dự án insuren của chủ dự án)*.
- **FR-015** — Quản lý hồ sơ cá nhân và sổ địa chỉ giao hàng (nhiều địa chỉ, 1 mặc định).
- **FR-016** — Xem lịch sử đơn hàng và chi tiết từng đơn.

### 4.4 Tương tác & khuyến mãi
- **FR-017** — Đánh giá sản phẩm (sao + bình luận + ảnh **[Giả định]**): chỉ khách đã mua và đơn ở trạng thái HOÀN THÀNH mới được đánh giá, mỗi sản phẩm 1 lần (được sửa).
- **FR-018** — Wishlist: lưu sản phẩm yêu thích, xem lại sau.
- **FR-019** — Áp voucher vào đơn: giảm theo % hoặc số tiền cố định, kèm điều kiện (đơn tối thiểu, danh mục áp dụng, hạn dùng, tổng lượt dùng). Mỗi đơn 1 voucher **[Giả định]**.

### 4.5 Quản trị
- **FR-020** — CRUD sản phẩm: thông tin, nhiều ảnh, thông số (kích thước/chất liệu hiển thị), **màu sắc** (mỗi màu có SKU, giá, tồn kho riêng — theo dõi đến cấp màu).
- **FR-021** — CRUD danh mục (hỗ trợ danh mục cha/con 2 cấp **[Giả định]**).
- **FR-022** — Quản lý đơn hàng: xem, xác nhận, cập nhật trạng thái theo vòng đời FR-012, ghi chú nội bộ.
- **FR-023** — Quản lý tồn kho theo **màu sắc**; cảnh báo khi tồn kho dưới ngưỡng cấu hình được.
- **FR-024** — CRUD voucher/khuyến mãi (mã, loại giảm, điều kiện, thời gian hiệu lực, giới hạn lượt).
- **FR-025** — Quản lý khách hàng: xem danh sách, xem lịch sử mua, khóa/mở tài khoản.
- **FR-026** — Báo cáo doanh thu: theo ngày/tuần/tháng, theo danh mục, top sản phẩm bán chạy, đơn theo trạng thái.
- **FR-027** — Quản lý banner trang chủ (ảnh, liên kết, thứ tự, bật/tắt).

### 4.6 Quyết định bổ sung (2026-10-10 — sau khi chủ dự án chốt 5 câu hỏi mở)
- **FR-028** — Flash sale: admin tạo chương trình giảm giá giới hạn thời gian + số lượng (đếm ngược trên trang), áp theo % hoặc giá cố định cho sản phẩm/màu sắc chỉ định; hết giờ hoặc hết suất → tự đóng.
- **FR-029** — Phí vận chuyển tính theo **tổng diện tích** đơn hàng (tổng diện tích chiếm chỗ của các sản phẩm, tính từ kích thước sản phẩm); admin cấu hình được bảng phí theo nấc diện tích và ngưỡng miễn phí.
- **FR-030** — Xác thực số điện thoại bằng OTP (SMS) là **bắt buộc** trước khi đặt hàng lần đầu; SĐT chưa xác thực → checkout bị chặn kèm hướng dẫn xác thực.

## 5. Yêu cầu phi chức năng (NFR)

- **NFR-001 (Hiệu năng):** trang chi tiết sản phẩm tải < 2s với mạng 4G; danh sách sản phẩm phân trang tối đa 24 item/trang.
- **NFR-002 (Bảo mật):** xác thực JWT; phân quyền RBAC theo 3 vai trò; mật khẩu hash bcrypt; **không lưu trữ thông tin thẻ/ví của khách**; chống đặt quá tồn kho bằng kiểm tra nguyên tử lúc tạo đơn.
- **NFR-003 (Quy mô — [Giả định]):** phase 1 phục vụ ~10.000 sản phẩm (kể cả biến thể), ~1.000 đơn/ngày, ~500 user đồng thời.
- **NFR-004 (Dữ liệu cá nhân):** thông tin khách hàng chỉ admin được xem; tuân thủ quy định bảo vệ dữ liệu cá nhân hiện hành.
- **NFR-005 (Khả dụng):** uptime mục tiêu 99,5%/tháng ở phase 1 (single-instance + backup DB hàng ngày **[Giả định]**).
- **NFR-006 (SEO cơ bản):** URL thân thiện, meta title/description cho trang sản phẩm & danh mục **[Giả định: SPA + prerender meta, chưa SSR full]**.

## 6. Tech stack đề xuất

**Backend: Spring Boot 4.x + MongoDB · Frontend: React 19 + Vite · Auth: JWT + Google OAuth2.**

*Lý do (1 đoạn):* Đây chính là stack chủ dự án đã dùng thành thạo ở dự án `insuren` (đã triển khai đầy đủ JWT/OAuth2, phân quyền, vòng đời trạng thái, MongoDB aggregation cho báo cáo) — tái sử dụng toàn bộ pattern, component dùng chung (KpiCard, PageHeader, StatusBadge, axiosClient...) và cả đội agent đã train, giúp đi nhanh gấp nhiều lần so với học stack mới. MongoDB dạng document rất hợp với catalog sản phẩm nội thất (mỗi sản phẩm có bộ thuộc tính/biến thể khác nhau, schema linh hoạt); nhược điểm duy nhất là giao dịch trừ tồn kho cần kiểm tra nguyên tử ở tầng ứng dụng — đã có quy tắc FR-011/NFR-002 bao phủ. Thanh toán ví điện tử tích hợp qua SDK/sandbox của nhà cung cấp ở backend, frontend không chạm vào tiền.

Triển khai phase 1: 1 VPS (backend + serve frontend build tĩnh), MongoDB Atlas hoặc self-host **[Giả định]**.
