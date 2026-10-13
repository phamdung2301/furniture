# Spec giao diện — Quản lý Đơn hàng (admin-don-hang)

- **Dự án:** noi-that-shop · **Màn:** Quản lý Đơn hàng (màn 17, wave 4 — admin)
- **Nguồn:** FR-022, FR-012, FR-010, FR-011, FR-013, FR-029 · F-016, F-007, F-008, F-009 · US-014 (hỗ trợ US-009, US-010 phía khách) · Entities: Order, Payment, ProductVariant, Voucher
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** §0 của `trang-chu.md` + **layout admin §A** và **quy ước §B (DataTable / slide-over / confirm / toast)** của `admin-dashboard.md` — tuân thủ nguyên xi, spec này KHÔNG định nghĩa lại. Badge trạng thái dùng **`OrderStatusBadge` sẵn có, đúng 6 màu ở §B.4 / theo-doi-don §4** (MỚI vàng · ĐÃ XÁC NHẬN nâu · ĐANG GIAO đồng · HOÀN THÀNH xanh lá · ĐÃ HỦY xám · HOÀN TRẢ đỏ) — không chế màu mới.
- **Nguồn sự thật trạng thái:** đúng 6 trạng thái trong `Order.status`: `MỚI | ĐÃ XÁC NHẬN | ĐANG GIAO | HOÀN THÀNH | ĐÃ HỦY | HOÀN TRẢ`. Timeline khách ở màn 11 (`theo-doi-don.md`) đọc cùng `statusHistory` này — đổi tên/thêm trạng thái ở đây mà không sửa màn 11 là vỡ.
- **Thuật ngữ trạng thái khi hiển thị:** Title Case tiếng Việt đúng màn 11: "Mới", "Đã xác nhận", "Đang giao", "Hoàn thành", "Đã hủy", "Hoàn trả". Không hiện enum/mã nội bộ.

---

## §1. Bố cục trang `/admin/don-hang` → FR-022, F-016

Theo khung §A: sidebar mục "Đơn hàng" active · topbar tiêu đề "Quản lý đơn hàng", breadcrumb `Quản trị / Đơn hàng`. Vùng nội dung 1 khối duy nhất:

1. **Thanh tiêu đề khối:** H1 "Đơn hàng" 20px/700 + dòng đếm nhỏ `--text-muted` ("{N} đơn") — trang này **không có nút "+ Thêm mới"** (đơn chỉ sinh từ checkout phía khách — F-007).
2. **Card DataTable** (§B.1): hàng **tab trạng thái** (§2.1) → thanh công cụ (tìm kiếm + lọc ngày + lọc phương thức — §2.2) → bảng (§2.3) → phân trang (§2.4).
3. **Chi tiết đơn mở dạng slide-over** (§3) ngay trên trang này — không rời trang.

### Chọn slide-over thay vì trang con `/admin/don-hang/:orderNumber` — lý do

- Công việc chính của admin là **xử lý hàng loạt đơn liên tiếp** (xác nhận → giao → hoàn thành): xem xong 1 đơn, đóng slide-over là quay lại đúng bảng/lọc/trang đang dở; trang con bắt điều hướng qua lại và mất ngữ cảnh lọc.
- Chi tiết đơn là khối **đọc + vài hành động**, không phải form dài nhiều mục như Sản phẩm (§B.2) — vừa trong slide-over khi cho rộng hơn chuẩn.
- Deep-link vẫn có qua query `?ma-don=NT-...` (§2.5): Dashboard §7 (đơn mới nhất) và thông báo đều trỏ về `/admin/don-hang?ma-don=NT-...` để mở sẵn slide-over của đơn đó.

Slide-over ở màn này rộng **720px** (ngoại lệ so với 560px ở §B.2 — ghi rõ: chi tiết đơn có bảng món + tóm tắt tiền + timeline cần bề ngang; mobile <768px vẫn full-screen như §B.2).

---

## §2. Danh sách đơn → FR-022, F-016, US-014

### 2.1 Tab trạng thái (lọc chính)

Hàng tab dạng chips segmented ngay trên thanh công cụ trong card, mỗi tab kèm số đếm trong ngoặc:

`Tất cả (128)` · `Mới (5)` · `Đã xác nhận (7)` · `Đang giao (9)` · `Hoàn thành (99)` · `Đã hủy (6)` · `Hoàn trả (2)`

- Tab active: nền `--brand-700` chữ trắng (đúng pattern chip filter màn 11). Số đếm = số đơn khớp **các bộ lọc còn lại** (ngày/phương thức/tìm kiếm) nhưng không tính chính tab trạng thái — để admin thấy còn bao nhiêu đơn ở trạng thái khác.
- Chọn tab → về trang 1, tải lại bảng, đồng bộ query `?trang-thai=` (§2.5).
- Tab "Mới" có thêm chấm đỏ nhỏ khi count > 0 (nhắc việc cần xử lý — khớp badge số đơn MỚI trên sidebar §A.2).

### 2.2 Thanh công cụ (theo §B.1, bổ sung 2 bộ lọc của F-016)

- **Tìm kiếm** (debounce 300ms, icon kính lúp): placeholder `Tìm theo mã đơn, tên, SĐT người nhận…` — khớp: mã đơn (khớp tiền tố `NT-…`, không phân biệt hoa/thường), tên người nhận, SĐT người nhận (khớp một phần).
- **Khoảng ngày:** 2 ô date `Từ ngày` – `Đến ngày` lọc theo `createdAt` + hàng preset nhanh: `Hôm nay` · `7 ngày qua` · `30 ngày qua` · `Tháng này` · `Tất cả` (mặc định **Tất cả**). Chọn preset thì 2 ô date tự điền theo; sửa tay 1 ô → preset về "Tùy chọn".
- **Phương thức thanh toán:** select `Tất cả phương thức` / `Ví MoMo` / `COD` / `Chuyển khoản`.
- Đổi bất kỳ lọc/tìm nào → về trang 1, tải lại bảng + số đếm tab.

### 2.3 Cột bảng (header theo §B.1: 13px/700 uppercase `--text-muted`)

| Cột | Nội dung | Sắp xếp |
|---|---|---|
| Mã đơn | Mono, `--brand-700`, **kèm icon copy** (click copy → toast "Đã sao chép mã đơn." — đúng copy màn 11) | — |
| Khách hàng | Tên người nhận 600 + SĐT 12px `--text-muted` dưới tên (snapshot `receiver`, không lấy hồ sơ hiện tại) | — |
| Số món | Tổng số lượng `Σ items.qty`; nếu đơn có nhiều dòng thêm chữ nhỏ "{k} loại" | — |
| Tổng tiền | `total`, `vi-VN` + `đ`, 700 | Tăng / giảm |
| Thanh toán | Dòng 1: phương thức (`Ví MoMo` / `COD` / `Chuyển khoản`) · Dòng 2: badge nhỏ trạng thái thu tiền từ entity **Payment**: `Đã thanh toán` (`--success`) · `Chưa thanh toán` (`--text-muted`) · `Thất bại` (`--error`) · `Hoàn tiền` (nền `#FCE4EC`, chữ `--error`) | — |
| Trạng thái | `OrderStatusBadge` 6 màu (§B.4) | — |
| Thời gian tạo | `HH:mm dd/MM/yyyy` (2 dòng: giờ đậm, ngày muted cũng được) | **Mặc định: mới nhất trước** (`createdAt` giảm dần) · cũ nhất trước |
| Hành động | Icon `Xem` kèm tooltip (§B.1) → mở slide-over chi tiết (§3). Không có nút chuyển trạng thái nhanh ở hàng — admin phải mở chi tiết để thấy món/tiền/thanh toán trước khi xác nhận (đúng luồng US-014, tránh bấm nhầm hàng loạt) | — |

- Click cả hàng (trừ icon copy) → mở slide-over chi tiết của đơn đó.
- Dữ liệu mẫu demo — 8 dòng đầu **khớp nguyên xi bảng "Đơn hàng mới nhất" ở admin-dashboard §7**, cộng 2 dòng bổ sung để đủ case HOÀN TRẢ + Chuyển khoản:

| Mã đơn | Khách hàng | Số món | Tổng tiền | Thanh toán | Trạng thái | Tạo lúc |
|---|---|---|---|---|---|---|
| NT-20261012-0007 | Nguyễn Văn An · 0901234567 | 3 (2 loại) | 4.250.000đ | COD · Chưa thanh toán | MỚI | 08:15 12/10/2026 |
| NT-20261012-0006 | Trần Thị Bình · 0912345678 | 1 | 1.450.000đ | Ví MoMo · Chưa thanh toán | MỚI | 07:52 12/10/2026 |
| NT-20261012-0005 | Lê Hoàng Cường · 0923456789 | 2 | 12.900.000đ | COD · Chưa thanh toán | ĐÃ XÁC NHẬN | 07:30 12/10/2026 |
| NT-20261011-0018 | Phạm Thu Dung · 0934567890 | 4 (3 loại) | 2.900.000đ | Ví MoMo · Đã thanh toán | ĐANG GIAO | 21:14 11/10/2026 |
| NT-20261011-0017 | Võ Minh Đức · 0945678901 | 1 | 890.000đ | COD · Đã thanh toán | HOÀN THÀNH | 20:03 11/10/2026 |
| NT-20261011-0016 | Đặng Ngọc Anh · 0956789012 | 2 | 7.900.000đ | Chuyển khoản · Chưa thanh toán | ĐÃ XÁC NHẬN | 18:47 11/10/2026 |
| NT-20261011-0015 | Bùi Thanh Hà · 0967890123 | 3 (2 loại) | 3.380.000đ | Ví MoMo · Chưa thanh toán | MỚI | 17:26 11/10/2026 |
| NT-20261011-0014 | Ngô Quang Huy · 0978901234 | 2 | 5.560.000đ | Ví MoMo · Chưa thanh toán | ĐÃ HỦY | 16:40 11/10/2026 |
| NT-20261011-0013 | Hà Văn Phúc · 0989012345 | 1 | 2.900.000đ | COD · Hoàn tiền | HOÀN TRẢ | 15:05 11/10/2026 |
| NT-20261011-0012 | Đỗ Thị Lan · 0990123456 | 2 | 6.750.000đ | Chuyển khoản · Đã thanh toán | ĐANG GIAO | 14:20 11/10/2026 |

### 2.4 Phân trang

Theo §B.1: `Trang X / Y · Tổng N đơn`, chọn 10 / 20 / 50 đơn/trang.

### 2.5 Đọc query param khi vào trang (từ Dashboard)

| Query | Hành vi |
|---|---|
| `?trang-thai=moi` | Mở sẵn tab tương ứng. Giá trị hợp lệ (slug không dấu): `moi` · `da-xac-nhan` · `dang-giao` · `hoan-thanh` · `da-huy` · `hoan-tra` · `cho-xu-ly` (= MỚI + ĐÃ XÁC NHẬN — dùng cho card "Đơn chờ xử lý" ở Dashboard §2: khi đó không tab nào active riêng, hiện chip phụ "Đang lọc: Đơn chờ xử lý ×" để admin xóa lọc; chọn 1 tab bất kỳ sẽ thay lọc này). Giá trị lạ → bỏ qua, về "Tất cả" |
| `?ma-don=NT-20261012-0007` | Sau khi bảng tải xong, tự mở slide-over chi tiết đơn đó (Dashboard §7 click 1 đơn). Mã không tồn tại → toast đỏ "Không tìm thấy đơn hàng NT-…" và ở lại danh sách |

- Khi admin đổi tab trạng thái trong trang, URL được cập nhật bằng `history.replace` (giữ `ma-don` nếu slide-over đang mở) để F5/chia sẻ link không mất lọc chính.

---

## §3. Chi tiết đơn — slide-over → FR-022, F-016, ERD Order/Payment

Thứ tự khối từ trên xuống (ưu tiên: hành động xử lý > tiền > món > lịch sử):

### 3.1 Header slide-over

- Dòng 1: mã đơn mono 18px/700 + icon copy (toast "Đã sao chép mã đơn.") · bên phải: `OrderStatusBadge` lớn.
- Dòng 2 (13px `--text-muted`): "Đặt lúc {HH:mm, dd/MM/yyyy}" · "Mã khách: đơn của {tên tài khoản}" — địa chỉ liên hệ lấy từ snapshot `receiver` ở §3.3.
- Nút đóng × ở góc phải (§B.2); đóng bằng Esc/click overlay. Slide-over chi tiết **không** có confirm "chưa lưu" (chỉ đọc + hành động rời rạc), trừ ô ghi chú nội bộ đang gõ dở (§3.8 — áp confirm §B.2).

### 3.2 Khối hành động trạng thái

Đặt ngay dưới header, nền `#FBF8F3` tách khối. Nội dung theo trạng thái hiện tại — chi tiết ma trận và hành vi ở §4. Chỉ hiện các nút chuyển **hợp lệ** từ trạng thái hiện tại; trạng thái cuối (ĐÃ HỦY) → khối hiện dòng chữ muted "Đơn đã kết thúc — không còn thao tác trạng thái." (HOÀN TRẢ vẫn còn thao tác trong 7 ngày — xem §4).

### 3.3 Khách hàng & địa chỉ giao (snapshot `receiver`)

Card 2 cột (mobile xếp chồng):
- **Người nhận:** tên (600) · SĐT (kèm link `tel:` để gọi nhanh) · ghi chú giao hàng của khách (`Order.note`, nếu có — hiện italic muted trong khung trích dẫn nhỏ, nhãn "Ghi chú của khách").
- **Địa chỉ giao:** 1–2 dòng đầy đủ `{detail}, {ward}, {district}, {province}`.
- Đây là **snapshot lúc đặt** (ERD §3) — hiển thị đúng như khách đã nhập khi đặt, không đổi theo sổ địa chỉ hiện tại (nhất quán màn 11 §3.4).

### 3.4 Danh sách món (snapshot `items[]`)

Bảng mini trong slide-over, mỗi dòng:

| Thành phần | Nội dung |
|---|---|
| Ảnh | Thumbnail 56px bo 8px — ảnh **snapshot** `items[].image` (code hiện tại đã chụp ảnh vào đơn, cùng triết lý snapshot giá/tên) |
| Tên + biến thể | Tên sản phẩm 600 (1 dòng cắt `…`) · dưới: chấm màu (`colorHex`) + tên màu · nhãn nhỏ `Flash sale` (nền `#FCE4EC` chữ `--error`) nếu dòng có `flashSaleProgramId` |
| SKU | Mono 12px `--text-muted` — **admin được thấy SKU** (quy tắc giấu SKU chỉ áp phía khách — US-015) |
| Đơn giá | `price` snapshot, `vi-VN` + `đ` |
| Số lượng | `×{qty}` |
| Thành tiền | `price × qty`, 700, căn phải |

Dưới bảng: dòng nhỏ `--text-muted`: "Tổng diện tích chiếm chỗ: {Σ areaM2 × qty} m²" — số này là căn cứ phí ship ở §3.5 (FR-029) và admin đối chiếu khi khách thắc mắc phí ship.

### 3.5 Tóm tắt tiền (snapshot — không tính lại, nhất quán màn 11 §3.6)

| Dòng | Hiển thị |
|---|---|
| Tạm tính | `subtotal` |
| Giảm giá voucher | Chỉ hiện khi `discount > 0`: `-{discount}` màu `--success` + chip mã `voucherCode` (VD `NOITHAT50`) |
| Phí vận chuyển | `shippingFee` + dòng nhỏ "theo tổng diện tích {X} m² (FR-029)"; `shippingFee = 0` → chữ `Miễn phí` màu `--success` |
| **Tổng cộng** | `total` — 20px/700 `--brand-700`, có divider trên |

Kiểm tra mẫu (đơn NT-20261012-0007 ở §3.9): Tạm tính 3.790.000đ · không dùng voucher (không hiện dòng giảm) · Phí vận chuyển 460.000đ (tổng diện tích 0,99 m²) · **Tổng cộng 4.250.000đ** ✓ khớp bảng §2.3 và KPI Dashboard.

### 3.6 Thông tin thanh toán (entity Payment liên kết — không phải field của Order)

Card riêng, các dòng nhãn–giá trị:
- **Phương thức:** `Ví MoMo` / `Thanh toán khi nhận hàng (COD)` / `Chuyển khoản ngân hàng` (map từ `paymentMethod`: MOMO / COD / BANK_TRANSFER).
- **Trạng thái thanh toán:** badge như cột bảng §2.3 (`Đã thanh toán` / `Chưa thanh toán` / `Thất bại` / `Hoàn tiền`).
- **Số tiền:** `Payment.amount` (= `total` của đơn).
- **Mã giao dịch:** mono — MoMo: `providerRef` (transId MoMo); Chuyển khoản: nội dung chuyển khoản kỳ vọng `NT{orderNumber}` (đúng F-008) kèm `providerRef` nếu đã đối soát; COD: hiện "—".
- **Thời gian thanh toán:** `paidAt` dạng `HH:mm dd/MM/yyyy` — chỉ hiện khi đã thanh toán.
- **Hành động riêng cho Chuyển khoản** **[Giả định từ F-008 — admin xác nhận thủ công]**: khi `paymentMethod = BANK_TRANSFER` và Payment đang `Chưa thanh toán` → nút Secondary `Xác nhận đã nhận chuyển khoản` trong card này → confirm nhỏ (§B.3, nội dung nêu mã đơn + số tiền) → Payment chuyển `Đã thanh toán`, ghi `paidAt`, toast "Đã xác nhận thanh toán cho đơn {mã}." Nút này **không** đổi trạng thái đơn — 2 việc tách bạch như phía khách (màn 11 §4).
- **COD:** khi đơn chuyển HOÀN THÀNH (§4), backend đồng thời đánh dấu Payment `Đã thanh toán` (thu tiền khi giao — căn cứ F-008 "thu khi giao xong" + quy ước doanh thu F-020 "COD đã thu"). **[Kỳ vọng backend — ghi rõ để code không bỏ sót]**

### 3.7 Timeline trạng thái (từ `statusHistory[]`)

- Tái dùng component `OrderTimeline` + nhãn mốc **đúng nguyên văn màn 11 §3.2** (Đặt hàng → Thanh toán → Đóng gói → Đang giao → Hoàn thành; mốc hủy đỏ / hoàn trả khi có) — admin và khách nhìn cùng 1 vòng đời, cùng thuật ngữ.
- Khác biệt phía admin: mỗi mốc hiện **đầy đủ `note`** của mốc đó (lý do hủy, mã vận đơn ở mốc ĐANG GIAO, ghi chú khi chuyển trạng thái) và mốc do hệ thống tạo (tự hủy quá hạn MoMo, IPN thanh toán) có nhãn nhỏ "Hệ thống" cạnh thời gian — để admin phân biệt thao tác người/hệ thống. `note` ở đây là nội dung **khách cũng thấy** trên timeline của họ (màn 11) — admin không gõ nội dung nội bộ vào đây (xem §3.8).

### 3.8 Ghi chú nội bộ admin → FR-022, F-016

- Khối cuối slide-over: nhãn "Ghi chú nội bộ" + dòng chú thích 12px muted "Chỉ quản trị viên thấy — khách hàng không thấy ghi chú này." + textarea (3 dòng, placeholder `VD: Khách hẹn giao sau 18h, gọi trước 30 phút…`) + nút Secondary `Lưu ghi chú`.
- Lưu thành công → toast "Đã lưu ghi chú nội bộ." (§B.3). Đang gõ dở mà đóng slide-over → confirm §B.2.
- **[Giả định — lệch ERD, builder/backend phải biết]:** ERD `Order` hiện chỉ có `note` — đó là **ghi chú của khách** từ checkout (F-007). Ghi chú nội bộ theo FR-022/F-016 ("ghi `note` nội bộ không hiện cho khách") cần **field riêng `adminNote`** trên Order — backend phải thêm field này (doc-writer cập nhật 02-ERD). TUYỆT ĐỐI không ghi ghi chú nội bộ vào `Order.note` hay `statusHistory[].note` — cả hai đều lộ ra phía khách.

### 3.9 Dữ liệu mẫu chi tiết (builder dùng đúng — đơn NT-20261012-0007)

- Khách/nhận: **Nguyễn Văn An** · 0901234567 · "123 Nguyễn Trãi, Phường 5, Quận 5, TP. Hồ Chí Minh" · Ghi chú khách: "Giao giờ hành chính."
- Món: (1) Ghế ăn bọc vải — chấm đen + màu Đen · SKU `GA-BV-DEN` · 1.450.000đ × 2 = **2.900.000đ** · diện tích 0,45 m²/cái. (2) Đèn bàn gốm — chấm trắng + màu Trắng · SKU `DB-GOM-TRANG` · 890.000đ × 1 = **890.000đ** · diện tích 0,09 m². → Tổng diện tích 0,99 m².
- Tiền: như §3.5 (3.790.000đ / ship 460.000đ / tổng 4.250.000đ, không voucher).
- Thanh toán: COD · Chưa thanh toán · số tiền 4.250.000đ · mã giao dịch "—".
- Timeline: 1 mốc — Đặt hàng (MỚI) lúc 08:15 12/10/2026, note "Đã đặt lúc 08:15, 12/10".
- Ghi chú nội bộ: rỗng (placeholder như §3.8).

---

## §4. Cập nhật trạng thái → FR-012, FR-022, F-016, US-014

### 4.1 Ma trận chuyển hợp lệ (state machine FR-012 — FE chỉ hiện đích hợp lệ, backend validate lại)

| Từ | Được chuyển tới | Không được |
|---|---|---|
| MỚI | ĐÃ XÁC NHẬN · ĐÃ HỦY | nhảy thẳng ĐANG GIAO / HOÀN THÀNH |
| ĐÃ XÁC NHẬN | ĐANG GIAO · ĐÃ HỦY | quay lại MỚI |
| ĐANG GIAO | HOÀN THÀNH · HOÀN TRẢ *(chỉ khi khách từ chối nhận — [Giả định], xem ghi chú lệch §7)* | ĐÃ HỦY (đơn đã đi giao — F-009) |
| HOÀN THÀNH | HOÀN TRẢ *(trong 7 ngày kể từ mốc hoàn thành — FR-012 [Giả định 7 ngày]; quá hạn → không hiện nút)* | mọi trạng thái khác |
| ĐÃ HỦY · HOÀN TRẢ | — (trạng thái cuối) | — |

### 4.2 Nút hành động theo trạng thái hiện tại (khối §3.2)

| Trạng thái | Nút chính (Primary) | Nút phụ |
|---|---|---|
| MỚI | `Xác nhận đơn` → ĐÃ XÁC NHẬN | Text-danger `Hủy đơn` (§4.3) |
| ĐÃ XÁC NHẬN | `Chuyển đang giao` → mở form mã vận đơn (§4.4) | Text-danger `Hủy đơn` (§4.3) |
| ĐANG GIAO | `Đánh dấu hoàn thành` → HOÀN THÀNH (§4.5) | Text-danger `Hoàn trả (khách từ chối nhận)` (§4.6) |
| HOÀN THÀNH | — | Text-danger `Hoàn trả` (§4.6) — chỉ hiện trong 7 ngày sau mốc hoàn thành |
| ĐÃ HỦY / HOÀN TRẢ | — | — (dòng chữ "Đơn đã kết thúc…" §3.2) |

- Bấm nút chính (trừ §4.4/§4.3/§4.6 có form riêng): gọi API ngay, nút chuyển loading + khóa khối hành động; thành công → toast (theo từng hành động, §4.7) + badge/timeline trong slide-over cập nhật + dòng tương ứng ở bảng tải lại + badge số đơn MỚI trên sidebar (§A.2) cập nhật.
- Lỗi 422 (trạng thái đã bị người khác/khách đổi trong lúc admin đang xem — VD khách vừa hủy, scheduler vừa tự hủy): toast đỏ với message cụ thể từ API (§B.3) + tự tải lại chi tiết để admin thấy trạng thái mới nhất. Không giữ nút bấm trên dữ liệu cũ.

### 4.3 Hủy đơn (từ MỚI / ĐÃ XÁC NHẬN) → FR-012, FR-013, F-009

- Mở **confirm dialog** theo §B.3 (modal 400px), tùy biến cho hủy đơn:
  - Tiêu đề: "Hủy đơn {mã đơn}?"
  - Nội dung hậu quả (liệt kê rõ, không viết chung chung): "Đơn sẽ chuyển sang Đã hủy. Tồn kho của {k} loại sản phẩm được hoàn lại, lượt dùng voucher (nếu có) và suất flash sale (nếu có) được hoàn. Thao tác này không thể hoàn tác."
  - Nếu Payment đang **Đã thanh toán** (MoMo/Chuyển khoản): thêm đoạn cảnh báo đỏ: "Đơn đã thanh toán {total} qua {phương thức} — hủy đơn sẽ cần hoàn tiền cho khách." và sau khi hủy, Payment chuyển trạng thái `Hoàn tiền` **[Giả định — F-008 chưa mô tả quy trình hoàn tiền MoMo; hệ thống chỉ ghi trạng thái, việc hoàn tiền thực tế xử lý ở cổng MoMo/ngân hàng]**.
  - **Lý do hủy: textarea bắt buộc** (placeholder `Lý do hủy đơn (khách hàng sẽ thấy lý do này)`) — trống → lỗi inline "Vui lòng nhập lý do hủy." và chặn nút. Lý do được ghi vào `statusHistory[].note` của mốc ĐÃ HỦY nên khách thấy trên timeline (màn 11 §3.2) — admin viết lý do lịch sự, đúng thực tế.
  - Nút nguy hiểm nền `--error`: `Xác nhận hủy đơn` · nút `Quay lại` Secondary.
- **Hệ quả phía backend (kỳ vọng — dùng lại đúng logic hủy đã có, không viết logic hoàn thứ hai):** chuyển status → ĐÃ HỦY + append `statusHistory` · **hoàn `stock` từng variant** trong đơn (FR-011/F-009) · **hoàn lượt voucher** (`usedCount` −1 nếu đơn có `voucherCode` — F-009) · **hoàn suất flash sale** cho các dòng có `flashSaleProgramId` (giảm `usedCount` chương trình + `itemSoldCount` của món — logic hoàn của màn 13/F-022 flash sale) · Payment xử lý như trên. Cùng một đường hủy dùng chung cho: khách tự hủy (màn 11), admin hủy (màn này), scheduler tự hủy quá hạn MoMo (màn 8).
- Thành công: toast "Đã hủy đơn {mã đơn}." + slide-over và bảng cập nhật như §4.2.

### 4.4 Chuyển ĐANG GIAO — nhập mã vận đơn → F-016, US-014

- Bấm `Chuyển đang giao` → mở **modal nhỏ 400px** (không rời slide-over): trường **Mã vận đơn \*** (text, placeholder `VD: GHN123456789`) + trường Ghi chú (tùy chọn — ghi vào `note` của mốc ĐANG GIAO, khách thấy). Thiếu mã vận đơn → lỗi inline tại trường "Vui lòng nhập mã vận đơn." và chặn lưu. **[Giả định trong F-016: "ĐANG GIAO → yêu cầu nhập mã vận đơn"]**
- Nút `Xác nhận đang giao` (Primary) / `Hủy` (Secondary). Thành công → toast "Đơn {mã} đã chuyển sang Đang giao."; mã vận đơn hiện ở timeline mốc Đang giao (§3.7) và phía khách cũng thấy (theo-doi-don §3.2 đã giả định hiển thị `trackingCode` khi có).
- **[Giả định — lệch ERD]:** `Order` chưa có field mã vận đơn — đề xuất field riêng `trackingCode` trên Order (doc-writer cập nhật 02-ERD); tạm thời không nhét mã vận đơn vào `statusHistory.note` dạng text tự do vì khách/admin đều cần đọc cấu trúc.

### 4.5 Đánh dấu HOÀN THÀNH → FR-012, F-008

- Đơn COD chưa thu tiền: bấm `Đánh dấu hoàn thành` → confirm nhỏ (§B.3): "Xác nhận đã giao thành công và đã thu {total} tiền mặt từ khách?" — nút `Đã giao & đã thu tiền` / `Quay lại`. (Căn cứ F-008: COD thu khi giao xong; Payment → ĐÃ THANH TOÁN theo §3.6.)
- Đơn đã thanh toán trước (MoMo/CK): chuyển thẳng không confirm thêm.
- Thành công → toast "Đơn {mã} đã hoàn thành."

### 4.6 Hoàn trả → FR-012

- Từ HOÀN THÀNH (trong 7 ngày) hoặc từ ĐANG GIAO khi khách từ chối nhận: mở confirm như §4.3 với tiêu đề "Hoàn trả đơn {mã đơn}?", **lý do bắt buộc** (ghi vào `statusHistory[].note`, khách thấy), nội dung hậu quả: "Đơn chuyển sang Hoàn trả. Hàng hoàn về sẽ được kiểm tra trước khi nhập lại kho — tồn kho KHÔNG tự cộng lại ngay khi hoàn trả." **[Giả định — docs chưa mô tả quy trình nhập lại hàng hoàn; spec chọn không tự hoàn kho để tránh cộng kho hàng hỏng; backend/parent quyết ở bước code]**. Nếu Payment đã thanh toán → cảnh báo hoàn tiền như §4.3 và Payment → `Hoàn tiền` **[Giả định]**.
- Thành công → toast "Đã chuyển đơn {mã} sang Hoàn trả."

### 4.7 Mỗi lần chuyển trạng thái — ghi vết & toast

- Mọi chuyển đổi đều **append `statusHistory { status, at, note }`** ở backend (F-009/F-016) — FE không tự sửa timeline lạc quan; nhận response mới rồi vẽ lại.
- Bảng toast chuẩn: Xác nhận → "Đã xác nhận đơn {mã}." · Đang giao → §4.4 · Hoàn thành → §4.5 · Hủy → §4.3 · Hoàn trả → §4.6.

---

## §5. Hành động phụ

- **In thông tin đơn** **[Đề xuất của spec — KHÔNG có trong docs (không FR/F nào mô tả in/xuất đơn), chờ user duyệt tại demo]:** nút Secondary `In đơn` ở header slide-over → mở bản in thân thiện của trình duyệt (`window.print` + print CSS): chỉ gồm mã đơn + ngày đặt, khách/địa chỉ, bảng món (không SKU? — bản in nội bộ giữ SKU), tóm tắt tiền, phương thức thanh toán. Không sinh file, không có nút xuất Excel/PDF vì docs không yêu cầu — nếu bị từ chối ở demo, bỏ nút này mà không ảnh hưởng phần còn lại.
- **Ghi chú nội bộ:** đã định nghĩa ở §3.8 (có trong FR-022/F-016 — không phải đề xuất).
- Không có hành động sửa đơn (địa chỉ/món/giá): đơn là snapshot bất biến (ERD §3, nhất quán màn 11 §3.5) — admin cần thay đổi thì hủy đơn và hướng dẫn khách đặt lại. Ghi rõ để builder không tự thêm nút sửa.

---

## §6. Trạng thái trang & trường hợp biên → operating rule 2

- **Bảng loading:** 5 hàng skeleton (§B.1). **Tab/lọc loading:** giữ khung tab, chỉ bảng hiện skeleton.
- **Bảng rỗng — chưa có đơn nào (không lọc):** icon + "Chưa có đơn hàng nào." + chữ phụ "Đơn hàng sẽ xuất hiện tại đây khi khách đặt mua."
- **Bảng rỗng — đang lọc/tìm không khớp:** "Không tìm thấy đơn hàng phù hợp." + nút "Xóa bộ lọc" (đưa tab về Tất cả, xóa tìm kiếm/ngày/phương thức — §B.1).
- **Bảng lỗi:** "Không tải được dữ liệu." + nút "Thử lại" (chỉ tải lại bảng).
- **Slide-over loading:** skeleton các khối (header + 3 dòng món + khung tiền) trong lúc tải chi tiết. **Lỗi tải chi tiết:** nội dung slide-over hiện "Không tải được chi tiết đơn hàng." + nút "Thử lại" — không mở slide-over trống.
- **Đơn không tồn tại** (mở từ `?ma-don=` sai): theo §2.5.
- **Guard:** theo §A.4 (chưa login → `/dang-nhap?returnTo=/admin/don-hang`; không phải ADMIN → trang 403). Mọi endpoint `/admin/**` yêu cầu role ADMIN ở backend.
- **Đơn MoMo MỚI chưa thanh toán:** trong slide-over hiện banner vàng ở khối hành động: "Đơn đang chờ thanh toán qua Ví MoMo — hệ thống sẽ tự hủy sau 30 phút nếu khách không thanh toán." (đúng cơ chế màn 8/F-008). Admin vẫn thấy nút `Xác nhận đơn`/`Hủy đơn` theo ma trận — nhưng khi scheduler đã tự hủy trước, đơn hiển thị ĐÃ HỦY kèm mốc history của hệ thống (§3.7), không còn nút hành động (§4.2 xử lý 422 nếu bấm trễ).

---

## §7. Contract backend (builder/code dùng mock khớp shape này)

- `GET /admin/orders?status=&paymentMethod=&from=&to=&q=&sort=createdAt,desc|createdAt,asc|total,asc|total,desc&page=&size=` → `{ content: [{ orderNumber, customerName, customerPhone, itemCount, itemKinds, total, paymentMethod, paymentStatus, status, createdAt }], totalElements, totalPages, page, size, statusCounts: { ALL, MOI, DA_XAC_NHAN, DANG_GIAO, HOAN_THANH, DA_HUY, HOAN_TRA } }` (`statusCounts` tính theo các lọc còn lại, bỏ qua chính `status` — phục vụ §2.1; endpoint này cũng phục vụ bảng đơn mới nhất của Dashboard §10 với `size=8&sort=createdAt,desc`.) `status` truyền lên dạng slug §2.5 hoặc enum — backend chuẩn hóa 1 kiểu, FE gửi slug.
- `GET /admin/orders/{orderNumber}` → `{ orderNumber, createdAt, status, statusHistory: [{ status, at, note, bySystem }], receiver: { name, phone, province, district, ward, detail }, note, adminNote, trackingCode, items: [{ image, productName, color, colorHex, sku, price, qty, areaM2, flashSaleProgramId }], subtotal, discount, voucherCode, shippingFee, totalAreaM2, total, paymentMethod, payment: { method, amount, status, providerRef, paidAt } }` · `404` khi không có đơn.
- `PATCH /admin/orders/{orderNumber}/status` — body `{ status, trackingCode?, note? }` (note = lý do/ghi chú của mốc mới) → `200` đơn đã cập nhật (kèm `statusHistory` mới) · `422 { message }` khi: sai ma trận §4.1, thiếu `trackingCode` khi → ĐANG GIAO, thiếu lý do khi → ĐÃ HỦY/HOÀN TRẢ, quá 7 ngày khi → HOÀN TRẢ từ HOÀN THÀNH · hủy/hoàn trả kích hoạt hoàn kho + hoàn voucher + hoàn suất flash sale ở backend (§4.3).
- `PATCH /admin/orders/{orderNumber}/admin-note` — body `{ adminNote }` → `200` (yêu cầu field `adminNote` mới — §3.8).
- `PATCH /admin/orders/{orderNumber}/payment-confirm` — xác nhận đã nhận chuyển khoản (§3.6) → `200` Payment đã cập nhật · `422` khi phương thức không phải BANK_TRANSFER hoặc đã thanh toán rồi.
- Mọi endpoint `/admin/**`: 401 chưa đăng nhập, 403 khi role != ADMIN (§A.4); entry `/admin` trong vite proxy đã có từ màn 14 (bài học /claims).

---

## §8. Traceability

| Mục spec | Nguồn |
|---|---|
| Route `/admin/don-hang`, khung sidebar/topbar, guard ADMIN + 403 | admin-dashboard §A · FR-022 |
| DataTable: tìm kiếm, lọc, sort, phân trang 10/20/50, skeleton/empty/error | admin-dashboard §B.1 · F-016 |
| Lọc theo trạng thái (tab 6 trạng thái) / khoảng ngày / từ khóa (mã đơn, tên, SĐT) | FR-022 · F-016 ("lọc theo trạng thái/khoảng ngày/từ khóa") |
| Lọc thêm theo phương thức thanh toán; cột phương thức + trạng thái thu tiền | F-008 · Entity Payment (`method`, `status`, `providerRef`, `paidAt`) |
| Cột mã đơn copy được, khách (tên + SĐT), số món, tổng tiền, badge trạng thái, thời gian tạo; sort mặc định mới nhất | FR-022 · F-016 · theo-doi-don §2.2 (pattern mã đơn copy phía khách) |
| Đọc `?trang-thai=` (gồm `cho-xu-ly`) + `?ma-don=` từ Dashboard | admin-dashboard §2, §4, §7 |
| Chi tiết dạng slide-over 720px (chọn thay trang con, có lý do) + deep-link query | admin-dashboard §B.2 (slide-over) — ngoại lệ bề rộng ghi rõ ở §1 |
| Chi tiết: receiver snapshot, món snapshot (ảnh/tên/màu/SKU/qty/đơn giá/thành tiền), tiền (subtotal/discount + voucherCode/shippingFee/total) | ERD Order + OrderItem snapshot (§3 ERD) · FR-022 |
| Admin thấy SKU trong chi tiết đơn | US-015 (admin thấy SKU) · admin-dashboard §8 |
| Tổng diện tích `Σ areaM2 × qty` cạnh phí ship | FR-029 · F-007 rule 5 · ERD OrderItem.areaM2 |
| Timeline từ `statusHistory`, nhãn mốc + note khách thấy được, mốc hệ thống có nhãn | F-009 · F-016 · theo-doi-don §3.2 · ERD Order.statusHistory |
| Ma trận chuyển trạng thái chỉ tiến theo vòng đời + ĐÃ HỦY trước khi giao + HOÀN TRẢ sau khi nhận (7 ngày) | FR-012 · F-016 ("chỉ chuyển theo vòng đời FR-012") |
| Nút Xác nhận đơn / Chuyển đang giao / Đánh dấu hoàn thành (luồng US-014) | US-014 · F-016 · FR-022 |
| → ĐANG GIAO bắt buộc mã vận đơn | F-016 [Giả định trong docs] · US-014 ("cập nhật ĐANG GIAO kèm mã vận đơn") |
| Hủy đơn từ MỚI/ĐÃ XÁC NHẬN qua confirm + lý do bắt buộc ghi `statusHistory` | FR-012 · FR-013 · F-009 · admin-dashboard §B.3 |
| Hủy → hoàn kho từng variant + hoàn lượt voucher + hoàn suất flash sale (dùng chung đường hủy màn 8/11/13) | FR-011 · F-009 · F-007/F-008 · flash-sale (hoàn suất) |
| COD → HOÀN THÀNH đồng thời Payment ĐÃ THANH TOÁN; xác nhận chuyển khoản thủ công | F-008 · F-020 (doanh thu tính COD đã thu) |
| Ghi chú nội bộ không hiện cho khách (field riêng `adminNote`) | FR-022 · F-016 · ERD Order.note là ghi chú khách (F-007) — xem ghi chú lệch §9 |
| Banner chờ thanh toán MoMo + đơn tự hủy sau 30 phút hiện mốc hệ thống | F-008 [Giả định 30 phút] · thanh-toan (màn 8) |
| Không sửa được đơn đã tạo (snapshot bất biến) | ERD §3 · theo-doi-don §3.5 |
| Toast kết quả từng thao tác; lỗi 422 hiện message cụ thể + tải lại | admin-dashboard §B.3 |
| Text tiếng Việt, giá `vi-VN` + `đ`, không enum/mã nội bộ phía hiển thị | copy-ux-linter · theo-doi-don §4 |

**Ghi chú lệch tài liệu (builder/parent cần biết):**
1. **`adminNote` chưa có trong ERD** — ERD `Order.note` là ghi chú của khách. FR-022/F-016 yêu cầu ghi chú nội bộ không hiện cho khách → backend thêm field `adminNote`, doc-writer cập nhật 02-ERD (§3.8).
2. **`trackingCode` chưa có field trong ERD Order** — F-016 chỉ [Giả định] việc nhập mã vận đơn. Đề xuất field riêng `Order.trackingCode` (§4.4).
3. **HOÀN TRẢ từ ĐANG GIAO** chỉ áp cho case khách từ chối nhận hàng — FR-012 gốc chỉ ghi HOÀN TRẢ "sau khi nhận, trong 7 ngày" (tức từ HOÀN THÀNH). Mở rộng này là [Giả định] của spec vì docs chưa có trạng thái/đường đi cho đơn bị từ chối lúc giao.
4. **Hoàn kho khi HOÀN TRẢ:** docs không mô tả → spec chọn KHÔNG tự hoàn kho (chờ kiểm hàng) — [Giả định] ở §4.6, khác với hủy đơn (hoàn kho ngay theo FR-011/F-009).
5. **Trạng thái hoàn tiền MoMo/CK khi hủy/hoàn trả đơn đã thanh toán:** F-008 không mô tả quy trình hoàn tiền → spec chỉ ghi Payment → `Hoàn tiền` trong hệ thống [Giả định] (§4.3).
6. **In thông tin đơn:** không có FR/F tương ứng — [Đề xuất chờ duyệt tại demo] ở §5; xuất Excel/PDF không làm.

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Quản lý đơn hàng`, `Đơn chờ xử lý` (nhãn lọc gộp MỚI + ĐÃ XÁC NHẬN), `Xác nhận đơn`, `Chuyển đang giao`, `Đánh dấu hoàn thành`, `Mã vận đơn`, `Lý do hủy đơn`, `Ghi chú nội bộ`, `Xác nhận đã nhận chuyển khoản`, `Đã sao chép mã đơn.` (đã dùng ở màn 11), `Tổng diện tích chiếm chỗ`.
