# Spec giao diện — Quản lý Khách hàng (admin-khach-hang)

- **Dự án:** noi-that-shop · **Màn:** Quản lý Khách hàng (màn 20, wave 4 — admin)
- **Nguồn:** FR-025 · F-019, F-010, F-020 · Entity: User (chỉ `ROLE_CUSTOMER`), Order · Liên quan: FR-015/F-011 (hồ sơ + địa chỉ khách tự quản ở màn 12), FR-030/F-024 (xác thực SĐT), NFR-004 (dữ liệu cá nhân)
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** §0 của `trang-chu.md` + **layout admin §A** và **quy ước §B (DataTable / slide-over / confirm / toast)** của `admin-dashboard.md` — tuân thủ nguyên xi, spec này KHÔNG định nghĩa lại. Badge trạng thái đơn trong chi tiết dùng `OrderStatusBadge` sẵn có (§B.4).
- **Không có US riêng** cho quản lý khách hàng trong `04-user-stories.md` — spec trace về FR-025/F-019, không bịa US (đúng pattern spec `ho-so.md`).

---

## §1. Bố cục trang `/admin/khach-hang` → FR-025, F-019

Theo khung §A: sidebar mục "Khách hàng" active · topbar tiêu đề "Quản lý khách hàng", breadcrumb `Quản trị / Khách hàng`. Vùng nội dung 1 khối duy nhất:

1. **Thanh tiêu đề khối:** H1 "Khách hàng" 20px/700 + dòng đếm nhỏ `--text-muted` ("{N} khách hàng") — **không có nút "+ Thêm mới"** (khách tự đăng ký qua F-010; admin không tạo tài khoản khách, không có rule trong docs).
2. **Card DataTable** (§B.1): thanh công cụ (tìm kiếm + lọc — §2.1) → bảng (§2.2) → ghi chú chân bảng (§2.4) → phân trang (§2.5).
3. **Chi tiết khách mở dạng slide-over** (§3) ngay trên trang này — không rời trang.

### Chọn slide-over thay vì trang con `/admin/khach-hang/:id` — lý do

- Công việc chính của admin ở màn này là **quét danh sách → xem nhanh 1 khách → khóa/mở nếu cần → quay lại danh sách**: slide-over giữ nguyên ngữ cảnh tìm kiếm/lọc/trang đang dở, đúng lý do đã chốt cho chi tiết đơn ở màn 17.
- Nội dung chi tiết là khối **đọc là chính** (hồ sơ + địa chỉ + tóm tắt mua hàng + 5 đơn gần nhất), không có form dài — vừa slide-over.
- Cần trỏ thẳng tới 1 khách (VD từ hỗ trợ nội bộ) thì dùng deep-link query `?khach=<userId>` (§3.5) — mở sẵn slide-over của khách đó, không cần route con.

Slide-over rộng **640px** (rộng hơn chuẩn 560px ở §B.2 vì có khối địa chỉ + bảng đơn gần đây; mobile <768px full-screen như §B.2).

---

## §2. Danh sách khách hàng → FR-025, F-019

**Phạm vi dữ liệu:** chỉ user có `ROLE_CUSTOMER`. Tài khoản `ROLE_ADMIN` **không xuất hiện** trong danh sách này (kể cả tài khoản admin đang đăng nhập). **[Giả định]:** user mang cả 2 role thì vẫn hiện (vì có tư cách khách) — BE lọc theo `roles chứa ROLE_CUSTOMER`.

### 2.1 Thanh công cụ (theo §B.1)

- **Tìm kiếm** (debounce 300ms, icon kính lúp): placeholder `Tìm theo tên, số điện thoại, email…` — khớp một phần, không phân biệt hoa/thường; SĐT khớp theo chuỗi số (bỏ khoảng trắng khi so khớp **[Giả định — theo format SĐT ở màn 12]**).
- **Lọc trạng thái tài khoản:** select `Tất cả trạng thái` / `Hoạt động` / `Đã khóa`. Chọn `Đã khóa` gồm cả 2 nguồn khóa ở §4.3 (badge từng hàng phân biệt nguồn).
- **Lọc xác thực SĐT:** select `Tất cả số điện thoại` / `Đã xác thực` / `Chưa xác thực` (theo `phoneVerified` — phục vụ admin rà soát khách chưa đặt hàng được vì FR-030).
- Đổi bất kỳ lọc/tìm nào → về trang 1, tải lại bảng. Các lọc đồng bộ lên query string (`?q=&trang-thai=&sdt=`) để chia sẻ/tải lại trang không mất ngữ cảnh **[theo pattern §2.5 màn 17]**.

### 2.2 Cột bảng (header theo §B.1: 13px/700 uppercase `--text-muted`)

| Cột | Nội dung | Sắp xếp |
|---|---|---|
| Khách hàng | Avatar tròn 36px (có `avatarUrl` → ảnh; chưa có → chữ cái đầu tên trên nền `--brand-700` chữ trắng, đúng pattern màn 12) + họ tên 600 (1 dòng cắt `…`) | — |
| Số điện thoại | Hiển thị **đầy đủ** (nguyên tắc §5), định dạng nhóm `0901 234 567` + dưới SĐT dòng nhỏ 12px: badge `Đã xác thực` (`--success`) hoặc `Chưa xác thực` (`--warning`) | — |
| Email | `user.email`, 1 dòng cắt `…` kèm tooltip khi hover | — |
| Ngày đăng ký | `dd/MM/yyyy` từ `createdAt` | **Mặc định: mới nhất trước** · cũ nhất trước |
| Số đơn | Tổng số đơn khách đã đặt, **mọi trạng thái** (kể cả ĐÃ HỦY/HOÀN TRẢ — đây là số đếm hoạt động mua; phần tiền mới lọc trạng thái, xem cột sau) | — |
| Tổng chi tiêu | `vi-VN` + `đ`, 700 — **chỉ cộng `total` của đơn HOÀN THÀNH** (nhất quán định nghĩa doanh thu F-020 ở Dashboard; đơn đang xử lý/hủy/hoàn trả không tính) | Tăng / giảm |
| Trạng thái | Badge theo §B.4: `Hoạt động` (`--success`) · `Đã khóa` (`--error`) · `Tạm khóa` (`--error`, cho khóa tự động §4.3 — kèm dòng nhỏ 12px `--text-muted` dưới badge: `Tự mở lúc {HH:mm dd/MM}`) | — |
| Hành động | Icon `Xem` (mở slide-over §3) + icon `Khóa` / `Mở khóa` theo trạng thái hiện tại — kèm tooltip chữ đúng §B.1 (`Xem chi tiết`, `Khóa tài khoản`, `Mở khóa tài khoản`). Không có icon Xóa ở bất kỳ đâu (§4.5) | — |

- Click cả hàng (trừ icon Khóa/Mở khóa) → mở slide-over chi tiết của khách đó.
- Hàng của khách đang bị khóa hiển thị bình thường (không làm mờ, không gạch tên) — admin vẫn cần xem/làm việc với các hàng này.

### 2.3 Dữ liệu mẫu demo (trang 1, sắp xếp ngày đăng ký giảm dần — tổng demo 48 khách)

| Khách hàng | SĐT | Email | Đăng ký | Số đơn | Tổng chi tiêu | Trạng thái |
|---|---|---|---|---|---|---|
| Đỗ Thị Lan | 0990 123 456 · Chưa xác thực | lan.do@gmail.com | 12/10/2026 | 0 | 0đ | Hoạt động |
| Vũ Thu Hằng | 0918 765 432 · Đã xác thực | hang.vu@gmail.com | 12/10/2026 | 1 | 0đ | Hoạt động |
| Trần Minh Tuấn | 0903 456 789 · Đã xác thực | tuan.tran@gmail.com | 12/10/2026 | 0 | 0đ | Hoạt động |
| Hà Văn Phúc | 0989 012 345 · Đã xác thực | phuc.ha@gmail.com | 11/10/2026 | 2 | 2.900.000đ | Hoạt động |
| Ngô Quang Huy | 0978 901 234 · Đã xác thực | huy.ngo@gmail.com | 10/10/2026 | 3 | 4.120.000đ | Hoạt động |
| Bùi Thanh Hà | 0967 890 123 · Đã xác thực | ha.bui@gmail.com | 08/10/2026 | 2 | 5.670.000đ | **Đã khóa** (do quản trị viên) |
| Đặng Ngọc Anh | 0956 789 012 · Đã xác thực | anh.dang@gmail.com | 05/10/2026 | 1 | 0đ | Hoạt động |
| Võ Minh Đức | 0945 678 901 · Đã xác thực | duc.vo@gmail.com | 03/10/2026 | 5 | 12.480.000đ | Hoạt động |
| Phạm Thu Dung | 0934 567 890 · Đã xác thực | dung.pham@gmail.com | 01/10/2026 | 3 | 6.350.000đ | **Tạm khóa** (tự mở lúc 09:02 12/10) |
| Nguyễn Văn An | 0901 234 567 · Đã xác thực | an.nguyen@gmail.com | 25/09/2026 | 6 | 24.650.000đ | Hoạt động |

- Kiểm tra chéo: 3 khách đăng ký ngày 12/10 = KPI "Khách hàng mới = 3" ở Dashboard §2. Tên/SĐT 7 khách đầu tiên khớp bảng "Đơn hàng mới nhất" Dashboard §7.
- Các case biên nằm sẵn trong mẫu: khách chưa xác thực SĐT + 0 đơn (Lan), có đơn nhưng tổng chi tiêu 0đ vì chưa đơn nào HOÀN THÀNH (Hằng, Ngọc Anh), đủ 2 loại khóa (§4.3).

### 2.4 Ghi chú chân bảng (dòng nhỏ 12px `--text-muted` dưới bảng, trên phân trang)

`Tổng chi tiêu chỉ tính các đơn đã hoàn thành. Số đơn tính tất cả đơn khách đã đặt.` — ghi rõ để admin không thắc mắc khi đối chiếu với chi tiết (nơi có đủ đơn mọi trạng thái).

### 2.5 Phân trang

Theo §B.1: `Trang X / Y · Tổng N khách hàng`, chọn 10 / 20 / 50 khách/trang (mặc định 10).

---

## §3. Chi tiết khách hàng (slide-over) → FR-025, F-019

Mở từ: click hàng / icon Xem / deep-link `?khach=<userId>`. Đóng bằng ×/Esc/click overlay → về đúng trạng thái bảng trước đó. Trong lúc mở, cuộn nền bị khóa (pattern §B.2).

### 3.1 Đầu slide-over

- Avatar tròn 56px (ảnh hoặc chữ cái đầu như §2.2) + họ tên 18px/700 + dưới tên: SĐT đầy đủ 13px `--text-muted`.
- Hàng badge: trạng thái tài khoản (§2.2 — gồm cả dòng "Tự mở lúc…" nếu tạm khóa) + badge `Đã xác thực SĐT` / `Chưa xác thực SĐT`.
- Nút hành động ở góc phải đầu khối: `Khóa tài khoản` (nút Danger viền, khách đang Hoạt động/Tạm khóa — luồng §4) hoặc `Mở khóa tài khoản` (nút Secondary, khách đang bị khóa). **Không có nút Sửa hồ sơ, không có nút Xóa** — admin chỉ xem thông tin khách (docs không giao quyền sửa hồ sơ/địa chỉ của khách cho admin; khách tự sửa ở màn 12).

### 3.2 Khối "Tổng quan mua hàng" (3 ô ngang, nền `#F5EFE6`, bo 12px)

| Ô | Nội dung |
|---|---|
| Số đơn đã đặt | Số lớn 20px/800 = `orderCount` (mọi trạng thái, khớp cột Số đơn §2.2) |
| Tổng chi tiêu | `vi-VN` + `đ` = chỉ đơn HOÀN THÀNH (khớp §2.2) + dòng nhỏ `từ {n} đơn hoàn thành` |
| Đơn gần nhất | Mã đơn (mono, `--brand-700`, click → mở đơn đó theo §3.4) + ngày `dd/MM/yyyy` + `OrderStatusBadge` nhỏ; chưa có đơn → `—` |

Dưới 3 ô: hàng chip tóm tắt theo trạng thái (chỉ hiện nhóm có số > 0): `Hoàn thành {n}` · `Đang xử lý {n}` (gộp MỚI + ĐÃ XÁC NHẬN + ĐANG GIAO) · `Đã hủy {n}` · `Hoàn trả {n}` — giúp admin hiểu vì sao "số đơn" và "số đơn tính tiền" lệch nhau.

### 3.3 Khối "Thông tin hồ sơ" (đọc từ User — đúng các field khách thấy ở màn 12)

Danh sách nhãn–giá trị 2 cột (nhãn 13px `--text-muted`, giá trị 14px):

- **Họ tên** · **Email** · **Số điện thoại** (đầy đủ + badge xác thực như §3.1) · **Ngày đăng ký** (`HH:mm dd/MM/yyyy`) · **Cách đăng nhập**: `Email và mật khẩu` / `Google` *(suy luận từ ERD: `passwordHash = null` ⇔ tài khoản Google — chỉ để hiển thị, không lộ bất kỳ dữ kiện mật khẩu nào)*.
- Nếu đang **tạm khóa tự động**: thêm dòng **Lý do trạng thái**: `Nhập sai mật khẩu nhiều lần — tự mở lúc {HH:mm dd/MM/yyyy}` + `Số lần đăng nhập sai gần nhất: {failedLoginAttempts}` (chỉ hiện khi > 0, phục vụ admin hỗ trợ khách gọi điện hỏi).
- Nếu bị **khóa do admin**: dòng **Lý do trạng thái**: `Bị khóa bởi quản trị viên` + lý do khóa nếu có (§4.2).

### 3.4 Khối "Địa chỉ giao hàng" → FR-015, F-011 (chỉ xem)

- Danh sách card nhỏ theo `addresses[]` embedded của User: dòng 1: nhãn (`Nhà`/`Công ty`…) 600 + tag `Mặc định` (badge `--accent`) nếu `isDefault` · dòng 2: `{receiverName} · {phone}` · dòng 3: địa chỉ đầy đủ `{detail}, {ward}, {district}, {province}` 13px `--text-muted`. Đúng cấu trúc `AddressCard` màn 7/12 nhưng **thuần hiển thị — bỏ mọi nút Sửa/Xóa/Đặt mặc định**.
- Tối đa hiện 5 địa chỉ (đúng giới hạn F-011). Chưa có địa chỉ nào → dòng chữ muted `Khách hàng chưa lưu địa chỉ nào.`

### 3.5 Khối "Lịch sử đơn hàng gần đây" → FR-025, F-019

- Bảng gọn 5 đơn gần nhất của khách (mới nhất trước): cột **Mã đơn** (mono, `--brand-700`, kèm icon copy như màn 17) · **Ngày đặt** `dd/MM/yyyy` · **Số món** (`Σ items.qty`) · **Tổng tiền** (`total`, mọi trạng thái — đây là giá trị đơn, khác "tổng chi tiêu" ở §3.2) · **Trạng thái** (`OrderStatusBadge` §B.4).
- **Click 1 đơn → đóng slide-over khách, điều hướng `/admin/don-hang?ma-don=<orderNumber>`** — màn 17 tự mở slide-over chi tiết đúng đơn đó (deep-link đã chốt ở `admin-don-hang.md` §2.5). Không dựng lại chi tiết đơn ở màn này.
- Cuối khối: link Text `Xem tất cả đơn của khách hàng này →` → `/admin/don-hang?khach=<userId>` **[Đề xuất — màn 17 hiện chưa có bộ lọc theo khách; cần bổ sung param `khach` khi code màn 17/20, không chặn demo màn này]**.
- Khách chưa có đơn → empty trong khối: `Khách hàng chưa có đơn hàng nào.`

### 3.6 Dữ liệu mẫu chi tiết (khách Nguyễn Văn An — hàng 10 ở §2.3)

- Tổng quan: Số đơn **6** · Tổng chi tiêu **24.650.000đ** (từ 3 đơn hoàn thành) · Đơn gần nhất **NT-20261012-0007** (12/10/2026, Mới). Chip: Hoàn thành 3 · Đang xử lý 1 · Đã hủy 1 · Hoàn trả 1.
- Hồ sơ: Nguyễn Văn An · an.nguyen@gmail.com · 0901 234 567 (Đã xác thực) · đăng ký 09:14 25/09/2026 · đăng nhập bằng Email và mật khẩu.
- Địa chỉ (2): `Nhà` **[Mặc định]** — Nguyễn Văn An · 0901234567 — Số 45 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh · `Công ty` — Nguyễn Văn An · 0901234567 — Tầng 8, 208 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP. Hồ Chí Minh.
- 5 đơn gần nhất:
  | Mã đơn | Ngày | Số món | Tổng tiền | Trạng thái |
  |---|---|---|---|---|
  | NT-20261012-0007 | 12/10/2026 | 3 | 4.250.000đ | MỚI |
  | NT-20261005-0011 | 05/10/2026 | 2 | 12.900.000đ | HOÀN THÀNH |
  | NT-20260928-0009 | 28/09/2026 | 1 | 7.900.000đ | HOÀN THÀNH |
  | NT-20260920-0004 | 20/09/2026 | 2 | 3.850.000đ | HOÀN THÀNH |
  | NT-20260912-0002 | 12/09/2026 | 2 | 5.560.000đ | ĐÃ HỦY |
  *(Kiểm tra chéo: 12.900.000 + 7.900.000 + 3.850.000 = 24.650.000đ = tổng chi tiêu §2.3; đơn thứ 6 cũ hơn thuộc nhóm Hoàn trả nên không nằm trong 5 đơn gần nhất.)*

---

## §4. Khóa / mở khóa tài khoản → FR-025, F-019, F-010

### 4.1 Điểm khởi động

Từ icon ở hàng bảng (§2.2) hoặc nút ở đầu slide-over (§3.1). Cả 2 điểm dùng chung 1 luồng dưới đây.

### 4.2 Khóa tài khoản — confirm dialog (theo §B.3, mở rộng cho thao tác khóa)

Modal nhỏ 400px, tiêu đề `Khóa tài khoản?`:

- Dòng đối tượng: `Khách hàng **Nguyễn Văn An** · 0901 234 567` (tên in đậm đúng §B.3).
- Khối hậu quả (danh sách gạch đầu dòng, chữ 14px):
  - `Khách sẽ không đăng nhập được và không đặt hàng mới được.`
  - `Các đơn đang xử lý của khách không bị ảnh hưởng — vẫn xác nhận, giao và hoàn thành bình thường.` **[Giả định — docs chỉ quy định khóa không xóa lịch sử đơn (F-019); đơn đang chạy không bị hủy/đóng băng là suy luận nghiệp vụ hợp lý, cần parent chốt]**
  - `Lịch sử đơn hàng và dữ liệu của khách được giữ nguyên.` (đúng F-019)
- Ô nhập **Lý do khóa** (textarea 2 dòng, **không bắt buộc**): placeholder `VD: Khách yêu cầu khóa tài khoản qua hotline…` — **[Đề xuất của spec: ERD User chưa có field lưu lý do/người khóa/thời điểm khóa; đề xuất BE bổ sung `lockReason`, `lockedBy`, `lockedAt` để hiển thị lại ở §3.3 và phục vụ tra soát. Nếu không được duyệt, bỏ ô này — luồng khóa không đổi.]**
- Nút nguy hiểm nền `--error` chữ trắng: `Khóa tài khoản`; nút `Hủy` Secondary.
- Đang gửi: nút khóa hiện spinner + khóa toàn bộ modal (§B.2). Thành công → đóng modal, toast xanh `Đã khóa tài khoản của Nguyễn Văn An.`, badge ở hàng bảng (và slide-over nếu đang mở) cập nhật **tại chỗ, không tải lại trang**. Thất bại → toast đỏ kèm lý do cụ thể từ API, trạng thái giữ nguyên (**không** cập nhật lạc quan cho thao tác khóa/mở — chỉ đổi giao diện sau khi API xác nhận).

### 4.3 Phân biệt 2 loại khóa (điểm cốt lõi của màn này)

Hệ thống có 2 nguồn khóa cùng ghi vào `User.status = LOCKED` (ERD + F-010) nhưng tính chất khác hẳn nhau — spec chốt cách phân biệt dựa trên `lockedUntil` (field đã có trong ERD §3 và code `AuthService` hiện tại):

| | **Khóa tự động (tạm khóa)** | **Khóa do quản trị viên** |
|---|---|---|
| Nguyên nhân | Sai mật khẩu 5 lần → hệ thống khóa **15 phút** (F-010) | Admin bấm Khóa ở màn này (FR-025) |
| Dấu hiệu dữ liệu | `status=LOCKED` + `lockedUntil = thời điểm mở` (khác null, ở tương lai) | `status=LOCKED` + `lockedUntil = null` |
| Hiển thị | Badge `Tạm khóa` + dòng nhỏ `Tự mở lúc {HH:mm dd/MM}` | Badge `Đã khóa` (không có giờ tự mở) |
| Tự hết hạn | **Có** — hệ thống tự mở khi qua `lockedUntil` (cơ chế sẵn có trong `AuthService`) | **Không bao giờ tự mở** — chỉ admin mở ở màn này |
| Hành động của admin | Có thể `Mở khóa ngay` (mở sớm trước hạn) hoặc để hệ thống tự mở | Bắt buộc bấm `Mở khóa tài khoản` |
| Khi hiển thị ở FE | Nếu `lockedUntil` đã qua nhưng dữ liệu chưa kịp cập nhật → BE trả trạng thái hiệu lực là Hoạt động (FE không tự tính) **[quy ước contract §7]** | — |

Khi admin khóa 1 khách đang **tạm khóa tự động**: vẫn dùng confirm §4.2, thêm 1 dòng trong modal: `Tài khoản này đang tạm khóa tự động đến {HH:mm dd/MM}. Khóa bởi quản trị viên sẽ thay thế và không tự mở.` — tránh admin tưởng khóa của mình cũng hết hạn sau 15 phút.

### 4.4 ⚠️ Yêu cầu bắt buộc phía backend (phát hiện khi đối chiếu code hiện tại)

`AuthService` hiện chỉ chặn đăng nhập khi `status=LOCKED` **và** `lockedUntil != null`, đồng thời đăng nhập đúng còn tự đặt lại `status=ACTIVE`. Hệ quả: khóa admin theo quy ước `lockedUntil = null` ở §4.3 sẽ **không chặn được khách, và bị xóa ngay ở lần đăng nhập đúng tiếp theo**. Trước khi màn này hoạt động thật, BE phải bổ sung nhánh: `status=LOCKED && lockedUntil == null` → từ chối đăng nhập (kể cả đăng nhập Google) với thông điệp `Tài khoản đã bị khóa. Vui lòng liên hệ hotline 1900 6868 để được hỗ trợ.` FE chỉ hiển thị thông điệp API trả về ở màn đăng nhập (màn 6), không tự chế logic. **[Đây là điều kiện tiên quyết của tính năng khóa admin — ghi vào contract §7 để builder backend xử lý, không phải [Giả định] tùy chọn.]**

### 4.5 Mở khóa tài khoản

- Không qua confirm modal (hành động khôi phục, an toàn — khác nhóm xóa/ngừng ở §B.3): bấm `Mở khóa` → nút hiện spinner → API xong → toast xanh `Đã mở khóa tài khoản của {Tên}.` + badge chuyển `Hoạt động` tại chỗ.
- Hệ quả phía BE: `status=ACTIVE`, `lockedUntil=null`, **đặt lại `failedLoginAttempts=0`** (mở cả với khách tạm khóa tự động — mở xong khách đăng nhập lại từ đầu sạch bộ đếm). Lý do khóa (nếu có field §4.2) được xóa khỏi trạng thái hiện tại.

### 4.6 Những điều màn này KHÔNG có

- **Không xóa khách hàng:** không nút Xóa ở bảng, slide-over hay bất kỳ menu nào. F-019 chỉ định nghĩa khóa/mở; xóa khách sẽ phá vỡ lịch sử đơn/đánh giá tham chiếu `userId` (ERD §1) — muốn ngừng phục vụ thì dùng Khóa.
- **Không sửa hồ sơ/địa chỉ/SĐT của khách** (xem §3.1) · **Không đặt lại mật khẩu hộ khách** (luồng quên mật khẩu thuộc về khách — F-010/màn 6) · **Không xem giỏ hàng/wishlist của khách** (ngoài phạm vi FR-025).

---

## §5. Quyền riêng tư & nguyên tắc hiển thị dữ liệu → NFR-004, NFR-002

- **Chỉ admin được xem** màn này (guard §A.4 + mọi endpoint `/admin/**` yêu cầu role ADMIN). Thông tin khách hàng là dữ liệu cá nhân — NFR-004.
- **SĐT và email hiển thị ĐẦY ĐỦ phía admin — đây là chủ ý nghiệp vụ, không che mờ:** admin cần SĐT thật để liên hệ xác nhận đơn/giao hàng (đúng cách Dashboard §7 và màn 17 đang hiển thị SĐT khách). Không áp dụng kiểu che `0901***567` của giao diện phía khách.
- **Tuyệt đối không hiển thị — và DTO không được chứa:** mật khẩu/`passwordHash`, mã OTP, `passwordResetToken`, JWT. Các field này không xuất hiện ở bất kỳ khối nào của màn này, kể cả trong response API (§7) — admin không có nhu cầu nghiệp vụ nào với chúng.
- Không ghi SĐT/OTP ra console log phía FE (đúng quy tắc ở spec `ho-so.md`).

---

## §6. Trạng thái loading / empty / error → §B.1

- **Bảng — loading:** 5 hàng skeleton xám nhấp nháy (§B.1). **Slide-over — loading:** skeleton riêng trong khung slide-over (khối avatar + 3 ô tổng quan + 4 dòng thông tin) — bảng phía sau giữ nguyên, không chặn cả trang.
- **Bảng — lỗi tải:** `Không tải được dữ liệu.` + nút `Thử lại` (§B.1). **Slide-over — lỗi tải chi tiết:** thông báo trong slide-over `Không tải được thông tin khách hàng.` + nút `Thử lại` (chỉ tải lại chi tiết). Lỗi khóa/mở khóa: toast đỏ lý do từ API (§4.2).
- **Empty — chưa có khách nào** (hệ thống mới): icon + `Chưa có khách hàng nào.` (không hiện nút xóa lọc).
- **Empty — do tìm/lọc không khớp:** icon + `Không tìm thấy khách hàng nào phù hợp.` + nút `Xóa bộ lọc` (đặt lại tìm kiếm + 2 select lọc, về trang 1) — đúng pattern §B.1.
- **Empty trong slide-over:** khối đơn (chưa có đơn) và khối địa chỉ (chưa lưu địa chỉ) có empty riêng như §3.4/§3.5 — không làm trống cả slide-over.

---

## §7. Contract backend (builder/code dùng mock khớp shape này)

- `GET /admin/customers?q=&status=ACTIVE|LOCKED&phoneVerified=true|false&sort=createdAt,desc|totalSpent,desc|totalSpent,asc&page=&size=` → `PageResponse<CustomerRow>`; `CustomerRow = { id, fullName, email, phone, phoneVerified, avatarUrl, status, lockSource: "ADMIN"|"AUTO"|null, lockedUntil, createdAt, orderCount, totalSpent }` — `lockSource`/`lockedUntil` do BE suy từ §4.3 và trả trạng thái hiệu lực (khóa tự động đã hết hạn → `status=ACTIVE, lockSource=null`).
- `GET /admin/customers/{id}` → `{ id, fullName, email, phone, phoneVerified, avatarUrl, status, lockSource, lockedUntil, lockReason?, failedLoginAttempts, hasPassword, createdAt, addresses: [Address], stats: { orderCount, completedOrderCount, totalSpent, countByStatus: { completed, processing, cancelled, returned }, lastOrder: { orderNumber, createdAt, status, total } | null }, recentOrders: [{ orderNumber, createdAt, itemCount, total, status }] (tối đa 5) }` — **DTO cấm chứa** `passwordHash`, `passwordResetToken` (§5).
- `PATCH /admin/customers/{id}/lock` — body `{ reason? }` → đặt `status=LOCKED`, `lockedUntil=null` (+ `lockReason/lockedBy/lockedAt` nếu duyệt đề xuất §4.2) → trả `CustomerRow` đã cập nhật.
- `PATCH /admin/customers/{id}/unlock` → đặt `status=ACTIVE`, `lockedUntil=null`, `failedLoginAttempts=0` → trả `CustomerRow` đã cập nhật.
- Lỗi: `404` khách không tồn tại (hoặc không phải CUSTOMER) · `409` khóa tài khoản đã đang bị khóa do admin / mở khóa tài khoản đang hoạt động · `401/403` theo chuẩn §A.4.
- **Điều kiện tiên quyết BE (§4.4):** `AuthService` chặn đăng nhập (email + Google) với `status=LOCKED && lockedUntil==null`, thông điệp khóa admin riêng; nhánh tự mở khóa sau 15 phút chỉ áp cho `lockedUntil != null`.
- `vite.config.js`: prefix `/admin` **đã có proxy từ màn 14** — code thật vẫn verify trong file (bài học /claims).

**Toggle demo cho live builder:** `Đang tạm khóa tự động` (hàng Phạm Thu Dung + chi tiết có dòng lý do §3.3) · `Khách chưa có đơn` (mở chi tiết Đỗ Thị Lan) · `Lỗi tải danh sách` (error + Thử lại ở bảng) · `Lỗi khóa tài khoản` (toast đỏ, badge giữ nguyên).

---

## §8. Traceability

| Mục spec | Nguồn |
|---|---|
| Route `/admin/khach-hang`, layout sidebar/topbar, guard role ADMIN | admin-dashboard §A · FR-025 |
| DataTable: tìm kiếm debounce, lọc, sort ở header, phân trang 10/20/50, skeleton/empty/error | admin-dashboard §B.1 |
| Danh sách chỉ `ROLE_CUSTOMER`: tên/avatar, SĐT, email, ngày đăng ký | FR-025 · F-019 · ERD User (`fullName`, `avatarUrl`, `phone`, `email`, `createdAt`, `roles`) |
| Badge Đã/Chưa xác thực SĐT trong danh sách + chi tiết | FR-030 · F-024 · ERD User.`phoneVerified` |
| Số đơn (mọi trạng thái) + Tổng chi tiêu (chỉ đơn HOÀN THÀNH) | F-019 ("đơn đã mua, tổng chi tiêu") · nhất quán F-020 (doanh thu chỉ tính HOÀN THÀNH) · ERD Order.`total`/`status` |
| Chi tiết dạng slide-over 640px + deep-link `?khach=` | admin-dashboard §B.2 — chọn slide-over, lý do §1 (pattern màn 17) |
| Tổng quan mua hàng: số đơn, tổng chi tiêu, đơn gần nhất, đếm theo trạng thái | FR-025 ("xem lịch sử mua") · F-019 |
| Thông tin hồ sơ + địa chỉ embedded chỉ xem, tối đa 5, 1 mặc định | FR-015 · F-011 · ERD User.`addresses[]` |
| Click đơn trong lịch sử → `/admin/don-hang?ma-don=…` mở đúng đơn | admin-don-hang §2.5 (deep-link đã chốt) · FR-022 |
| Khóa/mở tài khoản qua confirm nêu hậu quả; lịch sử đơn giữ nguyên | FR-025 · F-019 ("khóa tài khoản không xóa lịch sử đơn") · admin-dashboard §B.3 |
| Phân biệt khóa admin (`lockedUntil=null`, không tự mở) vs khóa tự động (sai pass 5 lần, 15 phút, tự mở) | F-010 · ERD §3 (`failedLoginAttempts`, `lockedUntil`) · code `AuthService` hiện tại |
| Mở khóa đặt lại `failedLoginAttempts=0` | F-010 (bộ đếm đăng nhập sai) |
| Không có xóa khách hàng / sửa hồ sơ / đặt lại mật khẩu hộ | F-019 (chỉ khóa/mở) · ERD §1 (Order/Review tham chiếu `userId`) |
| SĐT/email hiển thị đầy đủ phía admin; cấm hiển thị mật khẩu/OTP/token | NFR-004 · NFR-002 · nghiệp vụ liên hệ đơn hàng (Dashboard §7, màn 17) |
| Đơn đang xử lý không bị ảnh hưởng khi khóa tài khoản | **[Giả định — suy từ F-019, cần parent chốt]** |
| Ô lý do khóa + field `lockReason/lockedBy/lockedAt`; link "Xem tất cả đơn của khách" `?khach=` ở màn 17 | **[Đề xuất của spec — không có trong docs, chờ duyệt tại demo]** |
| Text tiếng Việt, tiền `vi-VN` + `đ`, không mã nội bộ phía admin | copy-ux-linter · §0.3 trang-chu |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Quản lý khách hàng`, `Tổng chi tiêu`, `Số đơn đã đặt`, `Đơn gần nhất`, `Đã khóa`, `Tạm khóa`, `Tự mở lúc…`, `Khóa tài khoản`, `Mở khóa tài khoản`, `Lý do khóa`.

**Điểm cần parent/user chốt (không chặn dựng demo):** (1) giả định "đơn đang xử lý không bị ảnh hưởng khi khóa" (§4.2); (2) đề xuất lưu lý do/người khóa (`lockReason/lockedBy/lockedAt`) và bộ lọc `?khach=` ở màn 17; (3) điều kiện tiên quyết BE ở §4.4 phải được builder backend xử lý **trước/trong** màn code thật — nếu không, nút Khóa chỉ đổi giao diện chứ không khóa được thật.
