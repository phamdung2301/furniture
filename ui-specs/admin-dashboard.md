# Spec giao diện — Admin Dashboard (admin-dashboard)

- **Dự án:** noi-that-shop · **Màn:** Admin Dashboard (màn 14 — màn admin đầu tiên, đặt nền layout + quy ước cho màn 15–22)
- **Nguồn:** FR-026, FR-023 · F-020, F-017 · US-016, US-015 · Entities: Order, Product, ProductVariant, Category, User
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** tái dùng nguyên xi §0 của `trang-chu.md` (tokens warm wood, Be Vietnam Pro, nút/Badge/Card). Màn này bổ sung **§A layout admin** và **§B quy ước admin dùng chung** — định nghĩa 1 lần tại đây, mọi spec admin sau (15–22) tham chiếu, không định nghĩa lại.
- **Quy ước doanh thu (F-020):** mọi số liệu doanh thu trên Dashboard chỉ tính đơn **HOÀN THÀNH** (+ COD đã thu) **[Giả định của F-020 — ghi rõ trong spec để builder không tự suy diễn]**.

---

## §A. Layout admin dùng chung (màn 14–22)

### A.1 Khung tổng thể

- Route prefix: `/admin`. Mọi màn admin dùng chung khung: **sidebar trái cố định + topbar + vùng nội dung cuộn**.
- Nền vùng nội dung: `--bg` (#FAF7F2). Card/khối dữ liệu: `--surface` trắng, bo `16px`, viền `1px --border` (đúng §0.4).
- Vùng nội dung: padding `24px` desktop / `16px` mobile; max-width không giới hạn (admin ưu tiên bề ngang bảng), tối thiểu co được tới 360px.

### A.2 Sidebar (desktop ≥1024px, cố định 240px)

- Nền `--brand-900` (#3E2A1E), chữ trắng; cuộn độc lập nếu menu dài.
- Đầu sidebar: logo "Mộc An" 20px/800 trắng + dòng nhỏ "QUẢN TRỊ" 11px tracking rộng màu `#C9BBA9`. Click logo → `/admin` (Dashboard).
- Menu (thứ tự cố định, icon + chữ 14px/500, padding `10px 16px`, bo `10px`):

| # | Mục | Route | FR |
|---|---|---|---|
| 1 | Dashboard | `/admin` | FR-026 |
| 2 | Sản phẩm | `/admin/san-pham` | FR-020 |
| 3 | Danh mục | `/admin/danh-muc` | FR-021 |
| 4 | Đơn hàng | `/admin/don-hang` | FR-022 |
| 5 | Tồn kho | `/admin/ton-kho` | FR-023 |
| 6 | Voucher | `/admin/voucher` | FR-024 |
| 7 | Khách hàng | `/admin/khach-hang` | FR-025 |
| 8 | Banner | `/admin/banner` | FR-027 |
| 9 | Flash sale & Phí ship | `/admin/khuyen-mai` | FR-028, FR-029 |

- Mục "Đơn hàng" có **badge số đơn MỚI** (nền `--error`, chữ trắng, 11px) — cập nhật theo dữ liệu; ẩn khi = 0. Mục "Tồn kho" có badge số variant sắp hết (nền `--warning`) tương tự.
- Mục đang active: nền `--brand-700`, chữ trắng 600, thanh accent `--accent` 3px ở mép trái.
- Cuối sidebar (divider trên): `Xem cửa hàng` (→ `/`, mở cùng tab) · `Đăng xuất` (xóa phiên → `/dang-nhap`).
- Tablet (768–1023px): sidebar thu còn 72px chỉ icon (tooltip khi hover hiện tên mục).
- Mobile (<768px): sidebar ẩn → **drawer** trượt từ trái (overlay đen 40%), mở bằng nút hamburger ở topbar; đóng bằng ×/click overlay/Esc; chọn mục xong tự đóng.

### A.3 Topbar (sticky, cao 60px, nền `--surface`, border-bottom `--border`)

- Trái: nút hamburger (chỉ mobile) + **tiêu đề màn hiện tại** 18px/700 (VD: "Dashboard") + breadcrumb nhỏ 13px `--text-muted` dạng `Quản trị / Dashboard` (màn con: `Quản trị / Đơn hàng / NT-20261012-0007`).
- Giữa/phải: ô tìm kiếm nhanh **[Đề xuất của spec — không có trong docs, chờ duyệt tại demo]**: placeholder `Tìm đơn theo mã, sản phẩm, khách hàng…`; Enter → điều hướng sang màn quản lý tương ứng kèm query (mã đơn `NT-…` → QL Đơn hàng; còn lại → QL Sản phẩm). Nếu không được duyệt, bỏ khỏi layout mà không ảnh hưởng phần còn lại.
- Phải: avatar tròn chữ cái đầu của admin + tên (15px/600) + dòng nhỏ "Quản trị viên" 12px `--text-muted`; click → dropdown nhỏ: `Hồ sơ của tôi` (→ `/tai-khoan`), `Xem cửa hàng`, `Đăng xuất`.

### A.4 Guard & phân quyền

- Chưa đăng nhập → redirect `/dang-nhap?returnTo=/admin` (kế thừa pattern màn 6, returnTo giữ nguyên route admin đang xin vào).
- Đã đăng nhập nhưng `role != ADMIN` → trang 403 riêng: icon khóa, "Bạn không có quyền truy cập khu vực quản trị.", nút "Về trang chủ". Không lộ menu admin.
- Backend: mọi endpoint `/admin/**` yêu cầu role ADMIN (403 nếu thiếu) — FE guard chỉ là lớp hiển thị.
- Role lấy từ phiên đăng nhập hiện có (JWT + roles đã có từ màn 1/6); không tự chế cơ chế auth mới.

---

## §B. Quy ước dùng chung cho các màn admin (định nghĩa 1 lần)

### B.1 Bảng dữ liệu (DataTable) — màn 15–22 dùng lại

- Khung card trắng; thanh công cụ trên bảng: ô tìm kiếm (debounce 300ms, icon kính lúp, placeholder theo ngữ cảnh VD `Tìm theo tên, SKU…`) + các bộ lọc (select/chips) + nút Primary `+ Thêm mới` ở góc phải (nếu màn có tạo mới).
- Header cột: 13px/700 uppercase `--text-muted`; cột cho phép sắp xếp thì click header đổi chiều (mũi tên ↑↓), mặc định theo ngữ cảnh từng màn.
- Hàng: padding `12px 16px`, divider `--border`, hover nền `#FBF8F3`; cột hành động ở cuối phải (icon Sửa / Xóa / Xem — kèm tooltip chữ, không chỉ icon trần).
- Phân trang dưới bảng (tái dùng component `Pagination` sẵn có): hiển thị `Trang X / Y · Tổng N mục`, chọn số mục/trang 10 / 20 / 50.
- Trạng thái bảng: loading → 5 hàng skeleton xám nhấp nháy; rỗng → icon + "Chưa có dữ liệu." + (nếu đang lọc) nút "Xóa bộ lọc"; lỗi → "Không tải được dữ liệu." + nút "Thử lại".

### B.2 Form nhập liệu

- Form ngắn (≤6 trường: danh mục, voucher, banner…) → **modal** giữa màn hình, rộng 520px, mobile thành bottom-sheet.
- Form dài (sản phẩm nhiều biến thể/ảnh) → **slide-over** trượt từ phải, rộng 560px (mobile full-screen).
- Trường bắt buộc có dấu `*`; validate inline khi rời trường (border `--error` + message 12px dưới trường); nút chính `Lưu` (Primary), nút `Hủy` (Secondary); khi đang lưu: nút loading + khóa form.
- Đóng form bằng ×/Esc/click overlay; nếu đã sửa mà chưa lưu → confirm "Bạn có thay đổi chưa lưu. Đóng mà không lưu?" **[Đề xuất — chờ duyệt tại demo]**.

### B.3 Confirm xóa & toast

- Mọi thao tác xóa/ngừng bán phải qua **confirm dialog**: modal nhỏ 400px, tiêu đề hành động (VD "Xóa sản phẩm?"), nội dung nêu rõ tên đối tượng in đậm + hậu quả ("Thao tác này không thể hoàn tác."), nút nguy hiểm nền `--error` chữ trắng (nhãn đúng hành động: `Xóa`, `Ngừng bán`…), nút `Hủy` Secondary.
- Kết quả thao tác (tạo/sửa/xóa/lưu) báo bằng **toast** góc phải trên (hệ thống toast sẵn có): thành công xanh lá + câu ngắn ("Đã lưu sản phẩm."); lỗi đỏ + lý do cụ thể từ API, không message chung chung.
- Xóa xong: bảng tự tải lại đúng trang hiện tại (nếu trang rỗng sau xóa → lùi 1 trang).

### B.4 Badge trạng thái

- Trạng thái đơn hàng: tái dùng `OrderStatusBadge` sẵn có — 6 màu đã chốt ở spec Theo dõi đơn §4 (MỚI vàng · ĐÃ XÁC NHẬN nâu · ĐANG GIAO đồng · HOÀN THÀNH xanh lá · ĐÃ HỦY xám · HOÀN TRẢ đỏ). Các màn admin không định nghĩa màu trạng thái khác.
- Trạng thái khác (kích hoạt/tắt, còn hàng/hết hàng, khóa/mở tài khoản): dùng `Badge` §0.4 với `--success`/`--text-muted`/`--error` theo nghĩa.

---

## §1. Bố cục Dashboard (route `/admin`)

Thứ tự từ trên xuống (ưu tiên: con số tổng quan → xu hướng → việc cần xử lý):

1. **Hàng KPI** — 5 card ngang (desktop 5 cột · tablet 3+2 · mobile 1 cột xếp chồng, hoặc 2 cột compact).
2. **Hàng biểu đồ chính** — 2 cột tỉ lệ 8/4: trái = biểu đồ doanh thu; phải = donut đơn theo trạng thái.
3. **Hàng doanh thu theo danh mục + Top sản phẩm** — 2 cột tỉ lệ 5/7 (mobile xếp chồng).
4. **Hàng dưới** — 2 cột tỉ lệ 7/5: trái = bảng đơn hàng mới nhất; phải = khối cảnh báo tồn kho.

Mỗi khối là 1 card trắng có tiêu đề 16px/700 + (nếu có) link/nút hành động ở góc phải tiêu đề. Khoảng cách giữa các khối 20px.

---

## §2. Hàng KPI → FR-026, F-020

5 card, mỗi card: nhãn 13px `--text-muted` · số lớn 24px/800 `--text` · dòng so sánh kỳ trước 13px (tăng: `--success` + `▲`; giảm: `--error` + `▼`; kèm chữ "so với hôm qua" / "so với tháng trước").

| Card | Số liệu | Nguồn | So sánh |
|---|---|---|---|
| Doanh thu hôm nay | `total` các đơn HOÀN THÀNH tạo hôm nay | F-020 | % vs hôm qua |
| Doanh thu tháng này | `total` các đơn HOÀN THÀNH trong tháng | F-020, US-016 | % vs tháng trước |
| Đơn mới hôm nay | số đơn tạo hôm nay (mọi trạng thái trừ ĐÃ HỦY) | Order | % vs hôm qua |
| Đơn chờ xử lý | số đơn đang `MỚI` + `ĐÃ XÁC NHẬN` | FR-012 | không % — hiện chữ "cần xử lý" + click → `/admin/don-hang?trang-thai=moi` |
| Khách hàng mới | số `User` role CUSTOMER tạo hôm nay | User | % vs hôm qua |
| Tồn kho sắp hết | số variant `stock ≤ lowStockThreshold` | FR-023, F-017 | không % — click → khối §6 / `/admin/ton-kho` |

(Là 6 chỉ số trên **5 card**: card "Tồn kho sắp hết" gộp cùng hàng; nếu chật, desktop cho phép 6 cột — builder chọn 5+1 miễn đủ 6 chỉ số trên. Đơn giản nhất: hàng KPI = lưới 6 ô desktop / 3×2 tablet / 2×3 mobile.)

- Card "Doanh thu hôm nay" có icon `?` nhỏ → tooltip: "Chỉ tính đơn đã hoàn thành (COD đã thu tiền)." — đúng quy ước F-020.
- Click card (trừ 2 card doanh thu) điều hướng sang màn quản lý tương ứng kèm bộ lọc sẵn.
- Dữ liệu mẫu demo: Doanh thu hôm nay **4.250.000đ** (+12,5% so với hôm qua) · Doanh thu tháng này **128.400.000đ** (+8,3% so với tháng trước) · Đơn mới hôm nay **7** (+16,7%) · Đơn chờ xử lý **12** · Khách hàng mới **3** (−25,0%) · Tồn kho sắp hết **4**.

---

## §3. Biểu đồ doanh thu → FR-026, F-020, US-016

- Card tiêu đề "Doanh thu" + cụm điều khiển bên phải: segmented control **Ngày | Tuần | Tháng** + select khoảng: `7 ngày qua` / `30 ngày qua` / `Tháng này` / `Tháng trước`. Mặc định: nhóm theo **Ngày**, khoảng **30 ngày qua** (vào từ US-016 xem tháng → mặc định hiển thị đủ tháng hiện tại).
- Kiểu biểu đồ: cột (bar) mặc định, nút chuyển **Cột | Đường** (line). Trục tung rút gọn tiền (`4tr`, `8tr`…); trục hoành: ngày `dd/MM`, tuần `Tuần 41`, tháng `Tháng 10`.
- Hover điểm/cột → tooltip: nhãn kỳ + doanh thu đầy đủ `9.100.000đ` + số đơn hoàn thành của kỳ.
- Kỹ thuật: thư viện biểu đồ nhẹ (VD recharts) hoặc SVG tự vẽ đều được — màu cột/đường `--brand-700`, vùng dưới đường tô `--brand-700` 10% opacity; lưới ngang `--border`. Demo dựng bằng SVG/CSS tĩnh, không cần thư viện.
- Dữ liệu mẫu (7 ngày gần nhất, nhóm Ngày): 06/10: 3.200.000đ · 07/10: 4.800.000đ · 08/10: 2.900.000đ · 09/10: 5.600.000đ · 10/10: 7.400.000đ · 11/10: 9.100.000đ · 12/10 (hôm nay): 4.250.000đ.
- Trạng thái: loading → skeleton khung biểu đồ; khoảng chọn không có đơn hoàn thành → biểu đồ trống + chữ giữa "Chưa có doanh thu trong khoảng này."; lỗi → message + "Thử lại" (chỉ tải lại khối này).

---

## §4. Đơn theo trạng thái (donut) → FR-026, F-020

- Card tiêu đề "Đơn theo trạng thái" + ghi chú nhỏ "Tháng này". Donut 6 lát theo vòng đời FR-012, màu **khớp OrderStatusBadge §B.4** (không chế màu mới): MỚI `#B7791F` · ĐÃ XÁC NHẬN `#5D3A29` · ĐANG GIAO `#8A6D1A` · HOÀN THÀNH `#2E7D32` · ĐÃ HỦY `#8A7A6B` · HOÀN TRẢ `#C62828`.
- Giữa donut: tổng số đơn của kỳ (số lớn) + chữ "đơn".
- Chú thích (legend) dưới/bên: chấm màu + tên trạng thái (tiếng Việt Title Case: "Mới", "Đã xác nhận"…) + số lượng + % (1 số thập phân, phẩy thập phân kiểu vi-VN).
- Click 1 lát/legend → `/admin/don-hang?trang-thai=<status>`.
- Dữ liệu mẫu (tổng **115** đơn): MỚI 5 (4,3%) · ĐÃ XÁC NHẬN 7 (6,1%) · ĐANG GIAO 9 (7,8%) · HOÀN THÀNH 86 (74,8%) · ĐÃ HỦY 6 (5,2%) · HOÀN TRẢ 2 (1,7%). *(Kiểm tra chéo: MỚI 5 + ĐÃ XÁC NHẬN 7 = 12 = KPI "Đơn chờ xử lý" §2.)*
- Trạng thái: loading skeleton tròn; kỳ không có đơn → donut xám trống + "Chưa có đơn hàng trong khoảng này."; lỗi → "Thử lại".

---

## §5. Doanh thu theo danh mục → FR-026, F-020, US-016

- Card tiêu đề "Doanh thu theo danh mục" + ghi chú "Tháng này · đơn hoàn thành".
- Hiển thị dạng **thanh ngang xếp hạng** (không biểu đồ riêng): mỗi dòng = tên danh mục · thanh bar tỉ lệ theo doanh thu cao nhất (màu `--brand-700`, danh mục đầu đậm nhất, các dòng sau nhạt dần theo `--accent`/`#C9BBA9`) · số tiền · % (1 số thập phân).
- Tối đa 5 danh mục cao nhất; nếu có thêm: dòng cuối "Danh mục khác" gộp phần còn lại.
- Click dòng → `/admin/danh-muc` (màn 16).
- Dữ liệu mẫu (tổng khớp KPI tháng **128.400.000đ**): Sofa **52.300.000đ** (40,7%) · Bàn ăn **38.100.000đ** (29,7%) · Giường ngủ **24.900.000đ** (19,4%) · Tủ & Kệ **8.300.000đ** (6,5%) · Đèn & Decor **4.800.000đ** (3,7%).
- Trạng thái: loading skeleton 5 dòng; không có doanh thu → "Chưa có doanh thu trong tháng này."; lỗi → "Thử lại".

---

## §6. Top sản phẩm bán chạy → FR-026, F-020, US-016

- Card tiêu đề "Sản phẩm bán chạy" + ghi chú "Tháng này". Dashboard hiện **top 5** (F-020/US-016 định nghĩa top 10 cho báo cáo đầy đủ — Dashboard là bản rút gọn 5, ghi rõ để không lệch docs).
- Mỗi dòng: hạng (số trong vòng tròn `--accent` cho hạng 1–3, xám cho 4–5) · ảnh thumbnail 48px bo 8px · tên sản phẩm (600, 1 dòng cắt `…`) · dưới tên: "Đã bán {qty}" 13px `--text-muted` · phải: doanh thu 15px/700 `--brand-700`.
- Click dòng → `/admin/san-pham` (màn 15, mở đúng sản phẩm khi màn đó sẵn sàng; demo chỉ cần hiệu ứng click + toast/điều hướng mô phỏng).
- Dữ liệu mẫu (doanh thu từng dòng ≤ tổng danh mục tương ứng §5):
  1. Sofa góc L Nordic — đã bán 3 — **38.700.000đ**
  2. Giường ngủ gỗ sồi 1m8 — đã bán 3 — **23.700.000đ**
  3. Bàn ăn gỗ óc chó 6 chỗ — đã bán 3 — **20.700.000đ**
  4. Ghế ăn bọc vải — đã bán 12 — **17.400.000đ**
  5. Đèn bàn gốm — đã bán 5 — **4.450.000đ**
- Trạng thái: loading skeleton 5 dòng; chưa bán được gì → "Chưa có sản phẩm nào được bán trong tháng này."; lỗi → "Thử lại".

---

## §7. Đơn hàng mới nhất → FR-026 (hỗ trợ), FR-022, F-016

- Card tiêu đề "Đơn hàng mới nhất" + link Text "Xem tất cả →" → `/admin/don-hang`.
- Bảng gọn (theo §B.1 rút gọn, không phân trang/tìm kiếm): cột **Mã đơn** (mono, `--brand-700`, copy được) · **Khách hàng** (tên + SĐT nhỏ) · **Tổng tiền** · **Trạng thái** (OrderStatusBadge) · **Thời gian** (giờ + ngày `HH:mm dd/MM`).
- Hiển thị 8 đơn mới nhất; click hàng → `/admin/don-hang` mở chi tiết đơn đó (màn 17).
- Dữ liệu mẫu:
  | Mã đơn | Khách hàng | Tổng tiền | Trạng thái | Thời gian |
  |---|---|---|---|---|
  | NT-20261012-0007 | Nguyễn Văn An · 0901234567 | 4.250.000đ | MỚI | 08:15 12/10 |
  | NT-20261012-0006 | Trần Thị Bình · 0912345678 | 1.450.000đ | MỚI | 07:52 12/10 |
  | NT-20261012-0005 | Lê Hoàng Cường · 0923456789 | 12.900.000đ | ĐÃ XÁC NHẬN | 07:30 12/10 |
  | NT-20261011-0018 | Phạm Thu Dung · 0934567890 | 2.900.000đ | ĐANG GIAO | 21:14 11/10 |
  | NT-20261011-0017 | Võ Minh Đức · 0945678901 | 890.000đ | HOÀN THÀNH | 20:03 11/10 |
  | NT-20261011-0016 | Đặng Ngọc Anh · 0956789012 | 7.900.000đ | ĐÃ XÁC NHẬN | 18:47 11/10 |
  | NT-20261011-0015 | Bùi Thanh Hà · 0967890123 | 3.380.000đ | MỚI | 17:26 11/10 |
  | NT-20261011-0014 | Ngô Quang Huy · 0978901234 | 5.560.000đ | ĐÃ HỦY | 16:40 11/10 |
- Trạng thái: loading skeleton 5 hàng; chưa có đơn nào → "Chưa có đơn hàng nào."; lỗi → "Thử lại".

---

## §8. Cảnh báo tồn kho dưới ngưỡng → FR-023, F-017, US-015

- Card tiêu đề "⚠ Tồn kho sắp hết" (icon + chữ `--warning`) + link Text "Xem tất cả →" → `/admin/ton-kho`. Card có viền trái 3px `--warning` để nổi bật tính cảnh báo.
- Điều kiện vào danh sách: `stock ≤ lowStockThreshold` của variant (mặc định ngưỡng 5 — F-017). Sắp xếp: `stock` tăng dần (sắp hết nhất lên đầu). Hiện tối đa 5 dòng.
- Mỗi dòng: ảnh sản phẩm 40px · tên sản phẩm + màu (VD "Ghế ăn bọc vải — màu Đen") · **SKU** 12px `--text-muted` (admin được thấy SKU — đúng US-015: "tôi thấy được số lượng và SKU"; quy tắc giấu SKU chỉ áp cho giao diện khách hàng) · phải: badge số còn (`Còn 3`, nền `#FDF3E0` chữ `--warning`; `stock = 0` → badge "Hết hàng" nền `--error` chữ trắng).
- Click dòng → `/admin/ton-kho` (màn 18) lọc đúng variant đó.
- Dữ liệu mẫu (4 variant — khớp KPI "Tồn kho sắp hết = 4"):
  1. Bàn trà gỗ sồi — màu Nâu óc chó · SKU `BT-GS-NAU` · Còn **0** (ngưỡng 5)
  2. Sofa góc L Nordic — màu Be · SKU `SF-NOR-BE` · Còn **2** (ngưỡng 5)
  3. Ghế ăn bọc vải — màu Đen · SKU `GA-BV-DEN` · Còn **3** (ngưỡng 5) *(đúng ví dụ US-015)*
  4. Đèn bàn gốm — màu Trắng · SKU `DB-GOM-TRANG` · Còn **4** (ngưỡng 5)
- Trạng thái: loading skeleton; không variant nào dưới ngưỡng → trạng thái tốt: icon ✓ `--success` + "Tất cả sản phẩm đều đủ tồn kho."; lỗi → "Thử lại".

---

## §9. Trạng thái toàn trang & làm mới

- **Loading lần đầu:** skeleton theo từng khối (KPI card xám, khung biểu đồ, hàng bảng) — các khối tải độc lập, khối xong trước hiện trước, không chặn cả trang.
- **Error từng khối:** message trong đúng khối đó + nút "Thử lại" chỉ tải lại khối; lỗi toàn cục (mất mạng) → banner đỏ trên cùng vùng nội dung "Không tải được dữ liệu. Kiểm tra kết nối và thử lại." + nút "Tải lại trang".
- **Làm mới:** nút icon "↻ Làm mới" ở góc phải hàng tiêu đề Dashboard → tải lại mọi khối; hiển thị giờ cập nhật gần nhất "Cập nhật lúc 08:45".
- **Empty tổng thể** (cửa hàng mới, chưa có dữ liệu): KPI hiện 0đ/0, các khối hiện empty state riêng như đã định nghĩa ở từng mục — không hiện trang trắng.

---

## §10. Contract backend (builder/code dùng mock khớp shape này)

- `GET /admin/stats/overview` → `{ revenueToday, revenueTodayChangePct, revenueMonth, revenueMonthChangePct, newOrdersToday, newOrdersChangePct, pendingOrders, newCustomersToday, newCustomersChangePct, lowStockCount }`
- `GET /admin/stats/revenue?granularity=day|week|month&from&to` → `[{ label, revenue, completedOrders }]`
- `GET /admin/stats/orders-by-status?from&to` → `[{ status, count }]` (status đúng enum FR-012)
- `GET /admin/stats/revenue-by-category?from&to` → `[{ categoryId, categoryName, revenue }]` (sắp giảm dần)
- `GET /admin/stats/top-products?limit=5&from&to` → `[{ productId, name, image, soldQty, revenue }]`
- `GET /admin/orders?size=8&sort=createdAt,desc` → danh sách đơn rút gọn (tái dùng endpoint QL Đơn hàng màn 17)
- `GET /admin/inventory/low-stock?limit=5` → `[{ variantId, productName, color, sku, image, stock, lowStockThreshold }]`
- Mọi endpoint `/admin/**`: 401 chưa đăng nhập, 403 khi role != ADMIN. Thêm entry `/admin` vào vite proxy (bài học /claims — màn code thật kiểm tra trong file).

---

## §11. Traceability

| Mục spec | Nguồn |
|---|---|
| Route `/admin`, sidebar 9 mục quản lý, guard role ADMIN + trang 403 | FR-020→FR-029 (nhóm quản trị) · §A |
| KPI doanh thu hôm nay/tháng này + % kỳ trước | FR-026 · F-020 · US-016 |
| Doanh thu chỉ tính đơn HOÀN THÀNH (+ COD đã thu) | F-020 [Giả định trong docs] |
| Biểu đồ doanh thu nhóm ngày/tuần/tháng + chọn khoảng | FR-026 · F-020 |
| Donut đơn theo trạng thái (6 trạng thái, màu khớp badge màn 11) | FR-026 · F-020 · FR-012 |
| Doanh thu theo danh mục (thanh ngang xếp hạng) | FR-026 · F-020 · US-016 |
| Top 5 sản phẩm bán chạy (rút gọn từ top 10 của F-020) | FR-026 · F-020 · US-016 |
| Bảng đơn hàng mới nhất + click sang QL Đơn hàng | FR-022 · F-016 (hỗ trợ điều hướng) |
| Cảnh báo tồn kho `stock ≤ lowStockThreshold`, hiện SKU + số còn | FR-023 · F-017 · US-015 |
| Badge số đơn MỚI / sắp hết trên menu sidebar | FR-022 · FR-023 (hỗ trợ) |
| DataTable / form modal & slide-over / confirm xóa / toast (quy ước §B) | Pattern dùng chung (seed insuren: PageHeader, KpiCard, StatusBadge) — áp cho F-014→F-021 |
| Ô tìm kiếm nhanh trên topbar; confirm khi đóng form chưa lưu | **[Đề xuất của spec — không có trong docs, chờ user duyệt tại demo]** |
| Text tiếng Việt, giá `vi-VN` + `đ`, không mã nội bộ phía khách hàng | copy-ux-linter · §0.3 trang-chu |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Tổng quan` (tên thay thế Dashboard khi hiển thị tiếng Việt — tiêu đề trang dùng "Tổng quan", menu giữ "Dashboard" **[chọn 1 khi dựng demo, mặc định: menu "Dashboard", tiêu đề trang "Tổng quan"]**), `Doanh thu hôm nay`, `Đơn chờ xử lý`, `Khách hàng mới`, `Tồn kho sắp hết`, `Đơn theo trạng thái`, `Doanh thu theo danh mục`, `Sản phẩm bán chạy`, `Đơn hàng mới nhất`, `Xem cửa hàng`, `Khu vực quản trị`.
