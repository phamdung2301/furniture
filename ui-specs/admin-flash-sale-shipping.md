# Spec giao diện — Flash sale & Phí vận chuyển (admin) (admin-flash-sale-shipping)

- **Dự án:** noi-that-shop · **Màn:** 22 — màn CUỐI của dự án (wave 4 — admin)
- **Nguồn:** FR-028 · F-022 · US-019, US-018 (flash sale) + FR-029 · F-023 · US-021 (phí ship) · Entities: Voucher (`type=FLASH_SALE`, `items[]`), ShippingRule (02-ERD §2, §4)
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** tái dùng nguyên xi §0 của `trang-chu.md` + **§A layout admin** và **§B quy ước DataTable / form modal & slide-over / confirm / toast / badge** của `admin-dashboard.md` — spec này TUÂN THỦ, không định nghĩa lại. Tiền format `vi-VN` + `đ`; ngày giờ `dd/MM/yyyy HH:mm`; diện tích format như `formatAreaM2` hiện có của màn 7 (`4.2 m²`, `3 m²`).
- **Nguyên tắc (bắt buộc):** phía khách của flash sale và phí ship **đã ship xong** — trang `/flash-sale` + khối trang chủ (màn 13, `flash-sale.md`), báo giá ship + tooltip breakdown ở checkout (màn 7, `dat-hang.md` §5.3). Backend hiện hành đã có `FlashSaleService` (resolve giá, claim suất nguyên tử, giới hạn 2 suất/khách, không cộng dồn voucher thường, hoàn suất khi hủy đơn) và `ShippingService` (tra nấc `SHIPPING_RULE` active, miễn phí theo ngưỡng, chặn đơn > 10 m²). Màn này **chỉ thêm CRUD cấu hình admin** cho hai service đó — tuyệt đối không viết lại logic tính giá / claim suất / tính phí phía khách.

---

## §0. Ranh giới & quy ước đọc spec (đọc trước)

### 0.1 Ranh giới với màn 19 — Quản lý Voucher (`admin-voucher.md` §0)

| | Màn 19 (`/admin/voucher`) | Màn này (22 — tab Flash sale) |
|---|---|---|
| Đối tượng | Voucher thường: Voucher `type = PERCENT \| FIXED`, khách **nhập mã** ở checkout | Chương trình flash sale: cùng entity Voucher nhưng `type = FLASH_SALE` + mảng `items[]`; giá **tự áp theo khung giờ**, khách không nhập mã, không cộng dồn voucher thường (F-022) |
| Định danh | `code` do admin đặt, khách nhìn thấy và nhập | `name` là **tên nội bộ chỉ admin thấy** (§3.2); `code` hệ thống tự sinh, khách không thấy (§10.2) |

- Hai màn dùng **chung collection `vouchers`** và `code` unique **toàn cục** (02-ERD §3) — mã tự sinh của chương trình flash sale vẫn chiếm chỗ trong không gian mã đó (§3.2).
- Bảng tab Flash sale ở màn này **chỉ gồm `type=FLASH_SALE`**; voucher thường không xuất hiện ở đây dưới bất kỳ bộ lọc nào (đối xứng với màn 19 luôn loại `FLASH_SALE`).

### 0.2 Ba giá trị đang hardcode mà màn này CHỈ hiển thị, không cho sửa

| Giá trị | Đang nằm ở | Hiển thị ở |
|---|---|---|
| Giới hạn **2 suất / khách / chương trình** (F-022 [Giả định]) | `FlashSaleService.MAX_SLOTS_PER_CUSTOMER = 2` | Form chương trình (§3.2) — dòng thông tin chỉ-đọc |
| Trần diện tích **10 m²** → "Liên hệ báo giá" + chặn checkout online (F-023 [Giả định]) | `ShippingService.MAX_AREA_M2 = 10` | Tab Phí vận chuyển (§5.1) — dòng ghi chú chỉ-đọc |
| Ngưỡng miễn phí **10.000.000đ** | `ShippingService.FREE_SHIPPING_THRESHOLD` — **màn này chuyển thành cấu hình sửa được** (§5.3, divergence §10.3) | Tab Phí vận chuyển (§5.3) |

---

## §1. Cấu trúc màn — 1 route, 2 tab → FR-028, FR-029

### 1.1 Quyết định: route `/admin/khuyen-mai` với 2 tab (không phải 2 route, không xếp dọc 2 khối)

- Route: **`/admin/khuyen-mai`** — đúng route sidebar hiện hành đã ship trong code (`AdminLayout.jsx`: mục 9 "Flash sale & Phí ship" → `/admin/khuyen-mai`; `App.jsx` đang đặt placeholder tại route con `khuyen-mai`). Topbar theo §A.3: tiêu đề `Flash sale & Phí ship`, breadcrumb `Quản trị / Flash sale & Phí ship`. Sidebar mục 9 active. **[Divergence: `admin-dashboard.md` §A.2 ghi route `/admin/flash-sale` — đã lệch code thật; lấy code thật + brief làm chuẩn, xem §10.1.]**
- Trong vùng nội dung, dưới hàng tiêu đề trang là **thanh tab** (segmented tabs, gạch chân `--brand-700` cho tab active, nhãn 15px/600):
  1. `Flash sale` — mặc định.
  2. `Phí vận chuyển`.
- Tab được phản ánh qua query param: `/admin/khuyen-mai?tab=flash-sale` | `?tab=phi-ship` (thiếu/sai param → `flash-sale`). Đổi tab = thay param, **không reload trang**; mỗi tab tự tải dữ liệu độc lập và **giữ nguyên trạng thái** (trang bảng, bộ lọc, cuộn) khi quay lại trong cùng phiên.

**Lý do chọn 2 tab trong 1 route (ghi rõ để builder/orchestrator không mở lại):**

1. **Khớp khung đã ship:** sidebar chỉ có đúng 1 mục cho cả hai việc (FR-028 + FR-029 gộp 1 mục từ §A.2). Tách 2 route sẽ phải sửa sidebar + routing đã chạy và phá route `/admin/khuyen-mai` hiện hành.
2. **Cùng một phiên làm việc:** hai khối thuộc cùng nhóm "khuyến mãi & chi phí đơn hàng" — admin tạo flash sale xong thường kiểm tra luôn phí ship của đơn flash (đơn flash vẫn tính ship theo diện tích bình thường, F-007 rule 5). Tab cho phép qua lại tức thì mà không mất ngữ cảnh.
3. **Không xếp dọc 2 khối:** cả hai khối đều là bảng + form nặng; xếp dọc khiến trang rất dài, bảng bậc phí bị đẩy dưới chương trình và khó đối chiếu khi sửa. Tab giữ mỗi khối full chiều ngang như các màn admin khác.
4. Bản khung cũ `admin-flash-sale-phi-ship.md` từng đề xuất 2 route riêng (`/admin/flash-sale`, `/admin/phi-ship`) — spec này **thay thế** đề xuất đó (xem §10.1).

### 1.2 Hàng tiêu đề trang (chung cho cả 2 tab)

- Trái: H1 `Flash sale & Phí vận chuyển` 24px/700 + dòng phụ 13px `--text-muted`: `Chương trình giảm giá theo khung giờ và bảng phí vận chuyển theo diện tích. Voucher thường được quản lý ở màn Voucher.`
- Phải: nút hành động **theo tab đang mở** — tab Flash sale: Primary `+ Tạo chương trình` (§3); tab Phí vận chuyển: Primary `+ Thêm bậc phí` (§5.2). Không hiện cả hai nút cùng lúc.
- Không có khối KPI riêng ở màn này [không có trong docs — không tự thêm thống kê ngoài FR-028/FR-029].

### 1.3 Guard & phân quyền

Theo §A.4: chưa đăng nhập → redirect `/dang-nhap?returnTo=/admin/khuyen-mai` (kèm cả `?tab=` đang xin vào); `role != ADMIN` → trang 403; mọi endpoint của màn này nằm dưới `/admin/**` yêu cầu role ADMIN ở backend (§8).

---

## §2. Tab Flash sale — danh sách chương trình → FR-028, F-022, US-019

### 2.1 Thanh công cụ (theo §B.1)

- **Ô tìm kiếm theo tên chương trình:** icon kính lúp, placeholder `Tìm theo tên chương trình…`, debounce 300ms. (Tìm theo tên nội bộ admin — chương trình không có mã khách nhập nên không tìm theo mã như màn 19.)
- **Lọc trạng thái** (chips, 1 chọn tại 1 thời điểm): `Tất cả` · `Đang chạy` · `Sắp chạy` · `Đã kết thúc` · `Đã tắt` — định nghĩa tại §2.3. Mặc định `Tất cả`.
- Tìm + lọc kết hợp dạng AND; đổi điều kiện → về trang 1, tải lại. Đang lọc mà rỗng → empty state có nút `Xóa bộ lọc` (§7).
- Nút `+ Tạo chương trình` ở góc phải thanh công cụ (cùng nút với §1.2 — mobile chỉ giữ nút trong thanh công cụ).

### 2.2 Cột bảng (DataTable §B.1)

| # | Cột | Nội dung & định dạng |
|---|---|---|
| 1 | **Chương trình** | Dòng chính: `name` 600 (VD `Flash sale cuối tuần`). Dòng phụ 12px `--text-muted` mono: `code` tự sinh (VD `FS-8K2QX4`) — chỉ để admin tra soát, kèm hint ở đầu bảng (§2.4). |
| 2 | **Khung giờ** | 2 dòng 13px: `Từ {startAt}` / `Đến {endAt}` (`dd/MM/yyyy HH:mm`). Dòng phụ thứ ba khi liên quan (12px): `Đang chạy` và còn < 24 giờ → chữ `--warning` `Còn {n} giờ`; `Sắp chạy` → `Bắt đầu sau {n} ngày/giờ`; `Đã kết thúc` vì hết suất → `Đã hết suất trước giờ kết thúc`. |
| 3 | **Sản phẩm** | `{n} sản phẩm` — hover/click hiện tooltip/popover liệt kê tên các món trong `items[]` kèm phạm vi áp dụng (`Tất cả các màu` hoặc tên màu cụ thể). |
| 4 | **Đã bán / Tổng suất** | Dòng chính: `{usedCount} / {totalUsageLimit}`; `totalUsageLimit = 0` (không giới hạn) → `{usedCount} / Không giới hạn`. Dưới dòng chính: thanh tiến độ mini (cao 6px, nền `--border`, phần đã bán `--brand-700`; ≥ 90% chuyển `--warning`, = 100% chuyển `--error`) — chỉ vẽ khi có giới hạn hữu hạn. |
| 5 | **Trạng thái** | Badge suy ra theo §2.3 (màu theo §B.4). |
| 6 | **Hành động** | Cụm icon phải kèm tooltip chữ (§B.1): `Sửa` (mở slide-over §3 — với chương trình Đã kết thúc đổi nhãn tooltip thành `Xem chi tiết`) · `Tắt chương trình` / `Bật lại` (theo `active` — §4.1) · `Xóa` (disabled + tooltip lý do khi không được xóa — §4.2). |

- **Sắp xếp:** click header đổi chiều ↑↓ cho cột Chương trình (theo `name`), Khung giờ (theo `startAt`), Đã bán. **Mặc định: `startAt` giảm dần** (chương trình gần nhất/sắp tới lên đầu) [Đề xuất của spec].
- Phân trang theo §B.1: `Trang X / Y · Tổng N chương trình`, chọn 10/20/50 mục/trang.

### 2.3 Trạng thái hiển thị — suy ra, không lưu thêm field

Cùng triết lý `admin-voucher.md` §2.3 và khớp `FlashSaleService.statusOf` hiện hành (bổ sung lớp `active` ở trên cùng, vì `statusOf` chỉ xét các chương trình đang bật):

| Ưu tiên | Điều kiện | Badge | Màu (§B.4) |
|---|---|---|---|
| 1 | `active = false` | `Đã tắt` | nền xám, chữ `--text-muted` |
| 2 | `now < startAt` | `Sắp chạy` | nền `#FDF3E0`, chữ `--warning` |
| 3 | `now ≥ endAt` **hoặc** (`totalUsageLimit > 0` và `usedCount ≥ totalUsageLimit`) | `Đã kết thúc` | nền xám, chữ `--text-muted` |
| 4 | Còn lại | `Đang chạy` | nền `#E8F5E9`, chữ `--success` |

- Nhất quán phía khách (màn 13): chỉ chương trình `Đang chạy` mới resolve giá flash; `Sắp chạy` chỉ hiện giá dự kiến ở trang `/flash-sale`; `Đã kết thúc`/`Đã tắt` → giá về thường, trang `/flash-sale` chuyển empty state hoặc sang chương trình sắp chạy kế tiếp (màn 13 §8.3 — backend tự chọn 1 chương trình hiện hành).
- Chương trình hết suất trước giờ kết thúc vẫn là `Đã kết thúc` (đúng `statusOf`: hết suất → `ENDED`) — phân biệt lý do bằng dòng phụ ở cột Khung giờ (§2.2), không tạo badge thứ 5.

### 2.4 Dữ liệu mẫu demo (builder dùng đúng số này — "hôm nay" của demo là 12/10/2026)

Chương trình 1 **phải khớp từng số với dữ liệu đã ship ở màn 13** (`flash-sale.md` §9, `flashSaleMock.js`) vì đó là chương trình khách đang nhìn thấy:

| # | Tên (nội bộ) / Code | Khung giờ | Sản phẩm | Đã bán / Tổng suất | Trạng thái suy ra |
|---|---|---|---|---|---|
| 1 | Flash sale cuối tuần / `FS-8K2QX4` | Hôm qua 20:00 → Ngày mai 22:00 | 5 sản phẩm | 73 / 100 | Đang chạy |
| 2 | Flash sale 20/10 / `FS-3MD7PA` | 20/10/2026 20:00 → 21/10/2026 22:00 | 3 sản phẩm | 0 / 50 | Sắp chạy |
| 3 | Khai trương tháng 10 / `FS-9QW2ZE` | 01/10/2026 09:00 → 05/10/2026 23:59 | 4 sản phẩm | 64 / 100 | Đã kết thúc (hết giờ) |
| 4 | Flash sale thử nghiệm / `FS-5TBN8C` | 15/10/2026 20:00 → 15/10/2026 22:00 | 2 sản phẩm | 0 / 20 | Đã tắt (`active = false`) |

Chi tiết `items[]` của chương trình 1 (đúng màn 13 — tổng đã bán từng món 14 + 29 + 6 + 4 + 20 = **73** = `usedCount`; tổng `itemQuota` 20 + 30 + 15 + 15 + 20 = 100 — bằng `totalUsageLimit` ở demo này là trùng hợp, hai trần là độc lập, xem §3.4):

| Sản phẩm | Phạm vi màu | Kiểu giảm | Giá gốc → Giá flash | Suất món / Đã bán |
|---|---|---|---|---|
| Sofa góc L Nordic | Màu Xám | Giảm 30% | 12.900.000đ → 9.030.000đ | 20 / 14 |
| Ghế ăn bọc vải | Màu Be | Giá cố định 990.000đ | 1.450.000đ → 990.000đ (−32%) | 30 / 29 |
| Bàn trà gỗ Sồi | Màu Tự nhiên | Giảm 20% | 3.450.000đ → 2.760.000đ | 15 / 6 |
| Đèn sàn trang trí | Màu Đen | Giá cố định 749.000đ | 890.000đ → 749.000đ (−16%) | 15 / 4 |
| Ghế lười hạt xốp | Màu Xám | Giảm 25% | 650.000đ → 488.000đ | 20 / 20 (hết suất món) |

---

## §3. Form tạo / sửa chương trình — slide-over → FR-028, F-022, US-019

### 3.1 Hình thức: slide-over (không phải modal)

- **Slide-over trượt từ phải, rộng 560px, mobile full-screen** theo §B.2: form có nhiều nhóm trường + danh sách món động (§3.4) → thuộc nhóm form dài như sản phẩm/voucher.
- Tiêu đề: tạo mới → `Tạo chương trình flash sale`; sửa → `Sửa chương trình` + tên chương trình nhỏ bên dưới; chương trình Đã kết thúc → `Chi tiết chương trình` (chỉ-đọc, §3.5).
- Chân form cố định: `Hủy` (Secondary) + Primary — tạo: `Tạo chương trình`, sửa: `Lưu thay đổi`. Đang lưu: nút loading + khóa toàn form (§B.2). Đóng bằng ×/Esc/click overlay; đã sửa mà chưa lưu → confirm `Bạn có thay đổi chưa lưu. Đóng mà không lưu?` (§B.2).
- Validate inline khi rời trường: viền `--error` + message 12px dưới trường (§B.2). Trường bắt buộc có dấu `*`.

### 3.2 Nhóm 1 — Thông tin chung

| Trường | Control | Quy tắc |
|---|---|---|
| Tên chương trình `name`* | Input text | Bắt buộc, 3–80 ký tự. Hint cố định dưới trường: `Tên chỉ để quản lý nội bộ — khách hàng không thấy tên này, phía khách chỉ hiển thị khung giờ và đếm ngược.` (Đúng màn 13 §2.1: trang khách dùng nhãn cố định "Flash sale" + khung giờ. Field `name` là bổ sung ERD — §10.2.) |
| Mã chương trình `code` | Chỉ-đọc, mono, `--text-muted` | Hệ thống **tự sinh** dạng `FS-XXXXXX` khi tạo (hiện từ chế độ sửa; chế độ tạo hiện dòng chữ `Mã sẽ được tự sinh khi tạo chương trình.`). Không có ô nhập: khách không nhập mã flash sale nên admin không cần đặt mã; mã chỉ phục vụ tra soát/unique toàn cục (§0.1). Không sửa được ở mọi chế độ. |
| Bắt đầu `startAt`* | `datetime-local` | Bắt buộc. Được chọn quá khứ (chương trình thành `Đang chạy` ngay nếu đang bật và còn suất) hoặc tương lai (`Sắp chạy`). |
| Kết thúc `endAt`* | `datetime-local` | Bắt buộc. **`endAt > startAt`** — validate cả FE lẫn BE (như F-018): `Thời gian kết thúc phải sau thời gian bắt đầu.` |
| Tổng suất toàn chương trình `totalUsageLimit` | Input số nguyên + checkbox `Không giới hạn` | Có giới hạn: `≥ 1`. Tick `Không giới hạn` → khóa ô số, gửi `0` (convention ERD: `0` = không giới hạn). Khi sửa: không được đặt giới hạn **nhỏ hơn `usedCount` hiện tại** → `Tổng suất phải từ {usedCount} trở lên (đã bán {usedCount}).` |
| Giới hạn mỗi khách | **Chỉ-đọc** | Dòng thông tin (không control): `Mỗi khách hàng tối đa 2 suất cho mỗi chương trình.` + hint `Giới hạn cố định cho toàn hệ thống (F-022), không cấu hình riêng theo chương trình.` (§0.2 — "suất" tính theo tổng số lượng món flash sale của 1 khách trong chương trình, đúng màn 13 §5.2.) |
| Kích hoạt `active` | Switch, mặc định **bật** khi tạo mới | Tắt ngay khi tạo = chương trình `Đã tắt` dù chưa tới giờ. Sửa: tắt switch của chương trình **đang chạy** rồi Lưu → vẫn phải qua confirm hậu quả của §4.1 trước khi gọi API. |

- **Chế độ sửa:** kèm dòng thông tin chỉ-đọc `Đã bán: {usedCount} suất` (không có control sửa `usedCount`/`itemSoldCount` ở bất kỳ đâu trong form).
- **Trùng lịch [Giả định — docs không yêu cầu, đề xuất chặn cứng]:** khi lưu, nếu khoảng `[startAt, endAt)` của chương trình (đang `active`) **chồng lấn** với bất kỳ chương trình flash sale `active` nào khác → BE trả 422, FE hiện banner lỗi trên đầu form: `Khung giờ trùng với chương trình "{tên chương trình xung đột}" ({startAt} – {endAt}). Hãy đổi khung giờ hoặc tắt chương trình đó trước.` Lý do đề xuất: phía khách chỉ hiển thị **1 chương trình hiện hành** tại một thời điểm (màn 13 §8.3, `FlashSaleService.currentProgram`) — hai chương trình chồng lịch sẽ khiến một chương trình bị ẩn hoàn toàn phía khách và suất bị tranh nhau khó hiểu. Chương trình `Đã tắt` không tham gia kiểm tra trùng. Xem §10.4.

### 3.3 Thứ tự các nhóm trong form

Slide-over gồm đúng 2 nhóm: **Nhóm 1 Thông tin chung (§3.2) → Nhóm 2 Sản phẩm tham gia (§3.4)**, rồi tới chân form (§3.1). Không có nhóm riêng cho "mã giảm giá đi kèm" của US-019 — mã đó là voucher thường, tạo ở màn 19.

### 3.4 Nhóm 2 — Sản phẩm tham gia (`items[]`) → F-022 input, ERD `Voucher.items[]`

- Đầu nhóm: nhãn `Sản phẩm tham gia *` + nút Text `+ Thêm sản phẩm`. Chưa có món nào → khung trống viền đứt nét: `Chưa có sản phẩm nào. Bấm "+ Thêm sản phẩm" để chọn món đưa vào chương trình.` Lưu khi danh sách rỗng → lỗi tại nhóm: `Chương trình cần ít nhất 1 sản phẩm.`
- **Thêm món:** bấm `+ Thêm sản phẩm` → hiện ô tìm sản phẩm (debounce 300ms, nguồn `GET /admin/products?q=` của màn 15, chỉ sản phẩm `active = true`, hiện ảnh nhỏ + tên + giá từ) → chọn 1 sản phẩm → một **thẻ món** được thêm vào cuối danh sách (cấu trúc dưới đây). Sản phẩm đã có thẻ trong chương trình thì không xuất hiện lại trong kết quả tìm (hoặc hiện disabled kèm chữ `Đã thêm`).
- **Thẻ món** (card con nền `#FBF8F3`, bo 12px, viền `--border`) gồm:
  1. Hàng đầu: ảnh thumbnail 48px + tên sản phẩm (600) + nút `×` xóa thẻ ở góc phải (chỉ hiện khi được phép sửa món — §3.5).
  2. **Phạm vi màu `variantId`:** radio 2 lựa chọn — `Tất cả các màu` (`variantId = null`, mặc định) · `Chỉ 1 màu` → hiện select màu của sản phẩm đó (mỗi lựa chọn: chấm màu `colorHex` + tên màu + giá bán + `Còn {stock}`; màu hết hàng vẫn chọn được — chương trình có thể bắt đầu sau khi nhập hàng [Giả định hiển thị, backend resolve giá/tồn tại thời điểm bán như màn 13]).
  3. **Kiểu giảm:** segmented control 2 lựa chọn (mỗi món chọn **đúng 1** kiểu — đúng cấu trúc `FlashSaleItem`: `flashPrice` **hoặc** `discountPercent`):
     - `Giá flash cố định` → input tiền `flashPrice`*: `> 0` và **phải nhỏ hơn giá bán** của phạm vi áp dụng: áp 1 màu → nhỏ hơn giá màu đó; áp tất cả màu → nhỏ hơn **giá thấp nhất** trong các màu (để không màu nào bị giá flash ≥ giá gốc). Vi phạm → `Giá flash phải nhỏ hơn giá bán ({giá tham chiếu}đ).` Bên cạnh hiện dòng suy ra chỉ-đọc: `Tương đương giảm {percent}%` (backend tính theo `discountPercentOf` — FE chỉ tính nháp hiển thị).
     - `Giảm %` → input `discountPercent`*: nguyên **1–99** (`% giảm phải từ 1 đến 99.` — 100% không được phép vì giá flash phải > 0 và < giá gốc); kèm input tùy chọn `Giảm tối đa (trần)` `maxDiscount` (`> 0` nếu nhập; trống = không trần).
  4. **Giá dự kiến (chỉ-đọc, cập nhật theo gõ):** dòng 13px: `Giá gốc {originalPrice}đ → Giá flash dự kiến {flashPrice}đ` — với kiểu %, giá dự kiến tính nháp ở FE và làm tròn nghìn như backend, kèm chú thích nhỏ `Giá chốt do hệ thống tính lại khi lưu.` (Giữ nguyên tắc màn 13 §5.1: FE không phải nguồn giá — đây chỉ là xem trước trong form admin.) Giá tham chiếu: màu đã chọn, hoặc variant mặc định của sản phẩm (màu còn hàng rẻ nhất, F-004) khi áp tất cả màu; nếu các màu ra giá flash khác nhau (kiểu %) → hiện thêm `Giá flash từng màu có thể khác nhau theo giá gốc của màu.`
  5. **Suất riêng của món `itemQuota`:** input số nguyên + checkbox `Không giới hạn theo món`. Mặc định khi thêm món: ô số trống, checkbox chưa tick — admin phải nhập số hoặc tick chọn không giới hạn; để trống mà không tick khi lưu → lỗi `Nhập suất cho món này hoặc chọn "Không giới hạn theo món".`. Có giới hạn: `≥ 1`. Gửi `null` khi không giới hạn (đúng kiểu `Integer itemQuota` của ERD/code — `null` = chỉ còn trần toàn chương trình chặn).
  6. **Đã bán `itemSoldCount`:** chỉ-đọc, chỉ hiện ở chế độ sửa: `Đã bán: {itemSoldCount}` (+ ` / {itemQuota}` nếu có quota).
- **Validate trong danh sách:**
  - Không trùng khóa `(productId, variantId)`: thẻ `Tất cả các màu` khóa toàn bộ sản phẩm đó (không thêm được thẻ màu lẻ của cùng sản phẩm và ngược lại); hai thẻ màu lẻ phải khác màu nhau. Trùng → lỗi tại thẻ vừa thêm: `Sản phẩm/màu này đã có trong chương trình.`
  - Tổng `itemQuota` của các món có quota **nhỏ hơn** `totalUsageLimit` (khi cả hai đều có giới hạn) → cảnh báo vàng dưới nhóm (không chặn lưu): `Tổng suất theo món ({X}) đang nhỏ hơn tổng suất toàn chương trình ({Y}) — chương trình sẽ hết suất theo món trước.` Ngược lại (tổng quota món > trần chương trình) không cảnh báo — trần chương trình chạm trước là bình thường.
- Thứ tự thẻ = thứ tự hiển thị phía khách (màn 13 §1: grid khách xếp theo thứ tự admin cấu hình) — kéo-thả đổi thứ tự thẻ **không** làm ở màn này [không có trong docs]; thứ tự = thứ tự thêm vào, muốn đổi thì xóa thêm lại [ghi rõ để builder không tự chế kéo-thả].

### 3.5 Khóa trường khi sửa theo vòng đời (ma trận bắt buộc)

Cùng triết lý F-018/màn 19 (đã bán thì chỉ tắt, không sửa giá) và bản khung màn 22:

| Trạng thái chương trình | Sửa được | Khóa (disabled + hint lý do) |
|---|---|---|
| `Sắp chạy`, chưa bán (`usedCount = 0`) | Mọi trường, thêm/xóa món tự do | Chỉ `code` (luôn khóa) |
| `Đã tắt`, chưa tới giờ, chưa bán | Như Sắp chạy (+ bật lại) | Chỉ `code` |
| `Đang chạy` (kể cả đã bán = 0) | `name` · `active` (tắt — qua confirm §4.1) · **tăng** `totalUsageLimit`/`itemQuota` · **rút ngắn** `endAt` (phải vẫn > hiện tại; rút xuống ≤ hiện tại = kết thúc ngay → qua confirm §4.1 tương tự tắt) | `startAt` (đã bắt đầu) · thêm/xóa món · đổi phạm vi màu · đổi kiểu giảm/giá flash/% giảm của món đã có · **giảm** giới hạn xuống dưới số đã bán. Hint chung trên đầu form: `Chương trình đang chạy nên giá và danh sách sản phẩm đã khóa. Bạn chỉ có thể tăng suất, rút ngắn thời gian hoặc tắt chương trình.` |
| `Đã kết thúc` | Không sửa gì — form mở ở chế độ **chỉ-đọc toàn bộ**, ẩn nút Lưu, chân form chỉ còn nút `Đóng` | Toàn bộ |

- Món **mới thêm vào khi đang chạy**: không cho phép (khóa nút `+ Thêm sản phẩm` theo ma trận trên) — tránh món mới nhảy vào chương trình khách đang xem giữa chừng.

### 3.6 Lưu & lỗi

- Tạo thành công → đóng form, toast `Đã tạo chương trình "{name}".`, bảng tải lại (nếu bộ lọc hiện tại loại chương trình mới ra, reset lọc về `Tất cả` trước khi tải lại — như màn 19 §3.7).
- Sửa thành công → toast `Đã lưu chương trình "{name}".`, bảng tải lại đúng trang hiện tại (§B.3).
- Lỗi 422 validate backend (trùng lịch §3.2, `endAt ≤ startAt`, giá flash ≥ giá gốc, giới hạn < đã bán…) → message API hiện tại đúng trường/nhóm tương ứng nếu map được; trùng lịch và lỗi không map được → banner lỗi đỏ trên đầu form. Lỗi mạng/500 → banner lỗi trên đầu form + nút `Thử lại` (gửi lại nguyên payload), không đóng form, không mất dữ liệu.

---

## §4. Tắt, bật lại, xóa chương trình → F-022, §B.3

### 4.1 Tắt chương trình đang chạy (confirm bắt buộc, nêu đúng hậu quả)

- Hành động `Tắt chương trình` trên hàng, hoặc tắt switch `active` trong form sửa của chương trình `Đang chạy`/`Sắp chạy` → **confirm dialog** §B.3 (modal nhỏ 400px):
  - Tiêu đề: `Tắt chương trình "{name}"?` (tên in đậm).
  - Nội dung (với chương trình **đang chạy**): `Khách hàng sẽ mất giá flash sale ngay lập tức: trang flash sale và giá ở trang sản phẩm trở về giá thường, đơn đang ở bước đặt hàng sẽ chốt theo giá thường. Các đơn đã đặt trước đó giữ nguyên giá flash sale đã chốt. Suất đã bán ({usedCount}) được giữ nguyên và bạn có thể bật lại chương trình sau.`
  - Nội dung (với chương trình **sắp chạy**): `Chương trình sẽ không bắt đầu theo lịch đã đặt và khách sẽ không thấy chương trình này. Bạn có thể bật lại trước giờ bắt đầu.`
  - Nút nguy hiểm nền `--error`: `Tắt chương trình`; nút `Hủy` Secondary.
- Xác nhận → `PATCH …/active { active: false }` → toast `Đã tắt chương trình "{name}".` → badge chuyển `Đã tắt`, bảng tải lại.
- **Bật lại:** hành động `Bật lại` — không cần confirm, gọi PATCH ngay, toast `Đã bật chương trình "{name}".`. Nếu chương trình đã qua `endAt` hoặc đã hết suất → toast cảnh báo thay toast thường: `Đã bật chương trình "{name}", nhưng chương trình đã kết thúc nên khách chưa thấy được. Hãy gia hạn thời gian kết thúc.` và badge hiển thị `Đã kết thúc` (như màn 19 §4.1).
- Rút ngắn `endAt` xuống ≤ thời điểm hiện tại khi sửa chương trình đang chạy = kết thúc ngay → dùng lại confirm §4.1 (bản đang chạy) trước khi lưu.

### 4.2 Xóa chương trình (chỉ khi chưa chạy và chưa có lượt bán)

- Điều kiện được xóa (cả hai phải đúng, đúng yêu cầu brief + triết lý F-018): chương trình **chưa bắt đầu** (`now < startAt`, gồm cả đang `Đã tắt` mà chưa tới giờ) **và** `usedCount = 0` **và** mọi `items[].itemSoldCount = 0` (đồng thời không tồn tại đơn nào có dòng `flashSaleProgramId` = chương trình này).
- Không thỏa → nút `Xóa` **disabled** + tooltip theo case: đang chạy → `Chương trình đang chạy — hãy tắt chương trình thay vì xóa.`; đã có lượt bán → `Chương trình đã có lượt bán — chỉ có thể tắt, không thể xóa.`; đã kết thúc → `Chương trình đã kết thúc — giữ lại làm lịch sử, không thể xóa.`
- Thỏa → confirm §B.3: tiêu đề `Xóa chương trình "{name}"?`, nội dung: `Chương trình "{name}" (in đậm) chưa bắt đầu và chưa có lượt bán nào. Thao tác này không thể hoàn tác.`, nút `--error` `Xóa`, nút `Hủy`.
- Xóa xong → toast `Đã xóa chương trình "{name}".`, bảng tải lại đúng trang hiện tại; trang rỗng sau xóa → lùi 1 trang (§B.3). API trả 409 khi cố xóa chương trình không thỏa điều kiện (đường gọi trực tiếp ngoài UI) → toast đỏ đúng message API, bảng tải lại.

### 4.3 Những gì KHÔNG làm ở tab này

- Không sửa `usedCount`/`itemSoldCount` thủ công, không "reset suất" (không có trong docs).
- Không tạo voucher thường đi kèm ngay trong form này — US-019 nhắc "1 mã giảm giá đi kèm" nhưng mã đó thuộc màn 19 (tạo ở `/admin/voucher`).
- Không xem danh sách đơn đã mua flash sale của 1 chương trình (thuộc QL Đơn hàng màn 17, lọc theo `flashSaleProgramId` nếu cần) — không tự thêm ngoài FR-028/F-022.

---

## §5. Tab Phí vận chuyển → FR-029, F-023, US-021

Khung giờ/tab: vào tab qua `?tab=phi-ship` (§1.1). Vùng nội dung từ trên xuống:

1. **Khối giải thích cách tính** (§5.1).
2. **Thẻ bảng bậc phí** (§5.2) — DataTable rút gọn.
3. **Hàng 2 cột** (desktop 7/5, mobile xếp chồng): trái = **thẻ Ngưỡng miễn phí** (§5.3); phải = **thẻ Thử tính phí** (§5.4).

### 5.1 Khối giải thích cách tính (chỉ-đọc)

Card nhỏ nền `#F5EFE6`, bo 12px, chữ 13px:

> `Phí vận chuyển tính theo tổng diện tích chiếm chỗ của đơn hàng: Tổng diện tích = Σ (dài × rộng × số lượng) của từng sản phẩm, tra vào bảng bậc phí dưới đây. Đơn đạt ngưỡng miễn phí thì phí = 0đ. Đơn có tổng diện tích trên 10 m² sẽ hiển thị "Liên hệ báo giá" và không đặt hàng trực tuyến được.`

(Đúng công thức F-023 + ví dụ US-021: sofa 3,8 m² + bàn ăn 1,6 m² = 5,4 m² → bậc 3–6 m². Trần 10 m² là hardcode — §0.2.)

### 5.2 Bảng bậc phí (`ShippingRule`) → FR-029, F-023

- Bảng trong thẻ trắng theo §B.1 rút gọn — **không** tìm kiếm/phân trang (số bậc ít, thứ tự chỉ có nghĩa khi nhìn toàn bộ): cột:
  | # | Cột | Nội dung |
  |---|---|---|
  | 1 | **Từ (m²)** | `minAreaM2` — bậc đầu luôn bắt đầu từ `0`. |
  | 2 | **Đến (m²)** | `maxAreaM2`; `null` → chữ `Trở lên` (không giới hạn). |
  | 3 | **Khoảng hiển thị** | Chuỗi thân thiện suy từ 2 cột trên, đúng cách khách hiểu biên: bậc đầu `0 – 1 m²`; bậc sau `Trên 1 – 3 m²`; bậc cuối mở `Trên 6 m²`. (Biên: backend tra nấc theo `[min, max]` và lấy nấc `min` nhỏ nhất khớp — diện tích đúng bằng biên chung rơi vào nấc thấp hơn, đúng `ShippingService.findTier` hiện hành; chuỗi hiển thị "Trên X" phản ánh đúng điều này.) |
  | 4 | **Phí** | `fee` format `vi-VN + đ`; `fee = 0` → chữ `Miễn phí` màu `--success`. |
  | 5 | **Trạng thái** | Badge §B.4: `Đang áp dụng` (`active = true`, nền `#E8F5E9`, chữ `--success`) · `Đã tắt` (`active = false`, xám). Bậc đã tắt **không** tham gia tính phí và không tham gia kiểm tra phủ liên tục (§5.2 validate). |
  | 6 | **Hành động** | Icon kèm tooltip (§B.1): `Sửa` (modal §5.2.1) · `Tắt`/`Bật lại` · `Xóa` (§5.5). |
- Sắp xếp cố định: `minAreaM2` tăng dần (không cho đổi chiều — thứ tự bậc là bản chất dữ liệu).
- **Dải cảnh báo phủ liên tục (chỉ hiện khi có vấn đề):** hệ thống kiểm tra các bậc `active` có phủ liên tục từ `0` hay không. Có lỗ hổng → dải nền `#FDF3E0` viền `--warning` ngay trên bảng: `Bảng phí đang có khoảng trống: diện tích {a} – {b} m² chưa có bậc phí. Đơn rơi vào khoảng này sẽ không tính được phí vận chuyển.` (Nhiều khoảng trống → liệt kê từng khoảng, cách nhau dấu chấm phẩy.) Không có lỗ hổng → không hiện dải.

#### 5.2.1 Form thêm / sửa bậc phí — modal

- **Modal giữa màn hình rộng 520px** (mobile thành bottom-sheet) theo §B.2 — form ngắn đúng 4 trường, thuộc nhóm form ngắn mà §B.2 dành cho modal (khác form flash sale dài → slide-over).
- Tiêu đề: `Thêm bậc phí` / `Sửa bậc phí`. Chân form: `Hủy` (Secondary) + `Lưu bậc phí` (Primary). Validate inline khi rời trường (§B.2); trường bắt buộc có dấu `*`.
- Trường:
  | Trường | Control | Quy tắc |
  |---|---|---|
  | Từ `minAreaM2`* | Input số thập phân (m², tối đa 2 số lẻ) | `≥ 0`. Bậc đầu tiên của bảng phải bắt đầu từ `0` — tạo bậc đầu mà `min > 0` → cảnh báo tại trường (không chặn): `Đơn có diện tích nhỏ hơn {min} m² sẽ không có bậc phí.` |
  | Đến `maxAreaM2` | Input số thập phân + checkbox `Không giới hạn (trở lên)` | Có giá trị: **`> minAreaM2`** → sai: `Diện tích "đến" phải lớn hơn diện tích "từ".` Tick không giới hạn → khóa ô số, gửi `null`. Chỉ **1 bậc active** được không giới hạn và đó phải là bậc có `min` lớn nhất — vi phạm → lỗi tại trường: `Đã có bậc "trở lên" đang áp dụng (từ {min} m²).` |
  | Phí `fee`* | Input tiền | `≥ 0`; `0` = miễn phí cho bậc này. Âm → `Phí vận chuyển không được âm.` |
  | Áp dụng `active` | Switch, mặc định bật | Tắt = bậc không tham gia tính phí (có thể tạo lỗ hổng → §5.5 confirm khi tắt bậc đang áp dụng). |
- **Validate chồng lấp [Giả định — docs không định nghĩa, đề xuất chặn cứng cả FE lẫn BE]:** khoảng `[min, max]` của bậc đang lưu (khi `active`) **không được chồng lấp** với bất kỳ bậc `active` nào khác (bậc không giới hạn coi như kéo dài vô hạn). Vi phạm → lỗi banner trên đầu modal, nêu rõ bậc bị chồng: `Khoảng {min} – {max} m² đang chồng với bậc {min2} – {max2} m² (phí {fee2}đ). Hãy chỉnh lại khoảng.` BE trả 422 với cùng nội dung. Bậc `active = false` không tham gia kiểm tra chồng lấp.
- **Lỗ hổng: cảnh báo, không chặn [Giả định kèm đề xuất — §10.5]:** lưu xong mà tập bậc active tạo lỗ hổng → vẫn lưu, nhưng (a) trước khi lưu, nếu hệ thống dự tính được lỗ hổng mới sẽ xuất hiện, confirm §5.5 phải nêu khoảng trống đó; (b) sau khi lưu, dải cảnh báo §5.2 hiện khoảng trống. Lý do không chặn cứng: admin có thể đang sửa dở nhiều bậc liên tiếp (xóa bậc cũ trước, thêm bậc mới sau) — chặn cứng sẽ khóa cả quá trình chỉnh sửa hợp lệ.

#### 5.2.2 Dữ liệu mẫu demo (đúng bảng đề xuất 02-ERD §4 + `shippingApi.js` hiện hành)

| Từ (m²) | Đến (m²) | Khoảng hiển thị | Phí | Trạng thái |
|---|---|---|---|---|
| 0 | 1 | 0 – 1 m² | 100.000đ | Đang áp dụng |
| 1 | 3 | Trên 1 – 3 m² | 200.000đ | Đang áp dụng |
| 3 | 6 | Trên 3 – 6 m² | 350.000đ | Đang áp dụng |
| 6 | 10 | Trên 6 – 10 m² | 550.000đ | Đang áp dụng |

(Không có bậc "trở lên": diện tích > 10 m² thuộc diện "Liên hệ báo giá" theo trần §5.1, không tra bậc. Bốn bậc phủ liên tục 0–10 → demo mặc định **không** hiện dải cảnh báo lỗ hổng.)

### 5.3 Ngưỡng miễn phí vận chuyển → FR-029, F-023, 02-ERD §4

- Thẻ riêng, tiêu đề `Ngưỡng miễn phí vận chuyển`. Nội dung:
  - Dòng giải thích 13px `--text-muted`: `Đơn hàng có tạm tính từ mức này trở lên được miễn phí vận chuyển, bất kể diện tích (trừ đơn trên 10 m² thuộc diện liên hệ báo giá). Tạm tính là tổng tiền hàng trước khi trừ mã giảm giá.` (Đúng `ShippingService` hiện hành: so sánh trên `subtotal` chưa trừ voucher; đúng tooltip màn 7: "Đơn từ 10.000.000đ được miễn phí vận chuyển.")
  - Input tiền `freeThreshold`* — giá trị hiện tại **10.000.000đ**. Quy tắc: `≥ 0`; nhập `0` = mọi đơn đều miễn phí → hint vàng dưới trường khi giá trị = 0: `Đặt 0đ nghĩa là miễn phí vận chuyển cho mọi đơn hàng.` Không có control "tắt ngưỡng" riêng — muốn không miễn phí, đặt ngưỡng thật cao [Giả định vận hành, ghi rõ để admin không tìm nút tắt không tồn tại].
  - Nút Primary `Lưu ngưỡng` — chỉ bấm được khi giá trị khác giá trị đã lưu (dirty check); lưu qua confirm §5.5.
- **[Divergence — §10.3]:** ngưỡng này hiện đang hardcode ở backend (`FREE_SHIPPING_THRESHOLD`) và ở mock FE (`shippingApi.js`). Code thật của màn này phải chuyển nó thành cấu hình lưu trữ (contract §8) thì ô nhập này mới có hiệu lực; trước khi chuyển xong, builder chỉ dựng demo bằng mock và **không** để admin hiểu nhầm là đã sửa được thật.

### 5.4 Thử tính phí (xem trước ví dụ) → F-023, US-021

- Thẻ riêng, tiêu đề `Thử tính phí` + dòng phụ: `Kiểm tra cấu hình đã lưu áp vào một đơn giả lập. Sửa bậc phí xong hãy lưu rồi thử lại — công cụ này luôn dùng cấu hình đã lưu, không dùng số đang gõ dở.`
- Hai input + nút:
  | Input | Quy tắc |
  |---|---|
  | Tổng diện tích đơn (m²)* | Số thập phân `> 0`, tối đa 2 số lẻ |
  | Tạm tính đơn (đ)* | Tiền `≥ 0`; để trống/`0` = chỉ kiểm tra bậc phí, không xét miễn phí theo ngưỡng |
  - Nút Primary `Tính thử`.
- **Kết quả** (khối dưới nút, gọi `POST /admin/shipping-rules/preview` — §8; backend dùng đúng logic `ShippingService`):
  - Trúng bậc, không miễn phí: `Diện tích {area} m² thuộc bậc {khoảng hiển thị} → Phí vận chuyển: {fee}đ.` + dòng phụ hiện bậc dạng thô `Từ {min} m² đến {max} m²`.
  - Đạt ngưỡng miễn phí: `Tạm tính {subtotal}đ đạt ngưỡng miễn phí ({freeThreshold}đ) → Phí vận chuyển: 0đ (Miễn phí).` kèm dòng gạch ngang phí gốc theo bậc `{fee}đ` (đúng cách checkout hiển thị ở màn 7).
  - Rơi khoảng trống: chữ `--warning`: `Diện tích {area} m² không thuộc bậc phí nào — đơn như thế này sẽ không tính được phí vận chuyển. Hãy kiểm tra lại bảng bậc phí.`
  - Trên 10 m²: chữ `--warning`: `Diện tích {area} m² vượt trần 10 m² — đơn thuộc diện "Liên hệ báo giá", không đặt hàng trực tuyến được.`
- Ví dụ mẫu để builder/demo kiểm chứng (khớp US-021): nhập diện tích `5.4`, tạm tính `8.000.000` → bậc `Trên 3 – 6 m²`, phí **350.000đ**; giữ diện tích `5.4`, tạm tính `15.600.000` → **Miễn phí** (đạt ngưỡng 10.000.000đ); diện tích `0.8` → bậc `0 – 1 m²`, phí **100.000đ**; diện tích `12` → thông báo vượt trần.

### 5.5 Lưu thay đổi ở tab Phí vận chuyển — confirm + phạm vi áp dụng (áp cho mọi thao tác ghi)

Mọi thao tác ghi ở tab này — thêm/sửa/xóa bậc, tắt/bật bậc, lưu ngưỡng miễn phí — đều qua **confirm dialog** §B.3 trước khi gọi API, với nội dung gồm 2 phần bắt buộc:

1. **Tóm tắt thay đổi cụ thể:** VD `Đổi phí bậc "Trên 3 – 6 m²" từ 350.000đ thành 400.000đ.` / `Xóa bậc "Trên 6 – 10 m²" (phí 550.000đ) — khoảng 6 – 10 m² sẽ không còn bậc phí.` / `Đổi ngưỡng miễn phí từ 10.000.000đ thành 12.000.000đ.` Nếu thay đổi tạo lỗ hổng phủ (§5.2.1) → thêm câu: `Thay đổi này tạo khoảng trống {a} – {b} m² chưa có bậc phí.`
2. **Phạm vi áp dụng (câu cố định, không rút gọn):** `Áp dụng cho đơn hàng tạo mới kể từ lúc lưu. Các đơn đã tạo giữ nguyên phí vận chuyển đã chốt trong đơn. Khách đang ở bước đặt hàng sẽ thấy phí theo cấu hình mới khi bấm đặt hàng.`

- Nút xác nhận theo hành động (`Lưu`, `Xóa bậc`, `Tắt bậc`… — nút nguy hiểm nền `--error` chỉ dùng cho Xóa/Tắt; sửa phí/lưu ngưỡng dùng nút Primary trong confirm); nút `Hủy` Secondary.
- Thành công → toast theo mẫu §B.3: `Đã lưu bậc phí.` / `Đã xóa bậc phí.` / `Đã lưu ngưỡng miễn phí vận chuyển.` + tải lại bảng + tính lại dải cảnh báo lỗ hổng + (nếu đang mở khối Thử tính phí) xóa kết quả thử cũ (vì cấu hình đã đổi).
- **Cơ sở của phạm vi áp dụng:** phí ship được chốt vào `Order.shippingFee` dạng snapshot lúc tạo đơn (02-ERD §3, F-007 rule 5) — sửa cấu hình không bao giờ làm đổi phí của đơn đã tạo; không cần cơ chế "áp dụng từ ngày" riêng.

---

## §6. Ảnh hưởng phía khách & kiểm tra bắt buộc sau khi thay đổi cấu hình

Màn này không có giao diện khách riêng, nhưng mọi thao tác ghi đều chạm tới hành vi phía khách đã ship. Builder/code dùng mục này làm checklist regression — không phải tính năng mới:

**Sau khi tạo / sửa / tắt / bật chương trình flash sale:**

- Trang `/flash-sale` (màn 13): chương trình hiện hành đổi theo đúng §8.3 của `flash-sale.md` (đang chạy → sắp chạy gần nhất → empty state); đếm ngược, tiến độ toàn chương trình và theo món khớp số admin vừa lưu.
- Giá flash ở trang chi tiết sản phẩm, QuickView, giỏ hàng và checkout resolve lại theo chương trình mới (backend là nguồn giá — màn 13 §5); chương trình bị tắt → các điểm đó về giá thường, checkout hiện banner cảnh báo giá thay đổi như màn 13 §5.4.
- Khối flash sale ở trang chủ (màn 13 §6) ẩn/hiện theo trạng thái chương trình mới.

**Sau khi lưu bảng bậc phí / ngưỡng miễn phí:**

- Checkout màn 7: phí hiển thị + tooltip breakdown (tổng diện tích → bậc) khớp bảng mới; đơn đạt ngưỡng mới → hiện "Miễn phí" gạch giá gốc; đơn > 10 m² vẫn bị chặn "Liên hệ báo giá".
- Báo giá ở giỏ hàng (`POST /shipping/quote`) ra cùng kết quả với khối Thử tính phí (§5.4) cho cùng một diện tích + tạm tính.
- Đơn đã tạo trước thời điểm lưu: mở chi tiết đơn (màn 11/17) kiểm tra `shippingFee` giữ nguyên số cũ (snapshot — §5.5).

---

## §7. Trạng thái toàn trang & từng tab → operating rule 2

Hai tab tải độc lập: tab nào lỗi/rỗng chỉ ảnh hưởng tab đó; chuyển tab không bị chặn bởi lỗi của tab kia.

| Tình huống | Tab Flash sale | Tab Phí vận chuyển |
|---|---|---|
| **Loading lần đầu / đổi lọc / đổi trang** | Bảng skeleton 5 hàng xám nhấp nháy (§B.1); thanh công cụ giữ nguyên, không khóa ô tìm/lọc | Bảng bậc phí skeleton 4 hàng; thẻ Ngưỡng miễn phí + Thử tính phí hiện skeleton khối chữ |
| **Empty — chưa có dữ liệu** (không lọc) | Trong khung bảng: icon ⚡ + `Chưa có chương trình flash sale nào.` + nút Primary `+ Tạo chương trình` (mở form §3) | Bảng rỗng kèm dải cảnh báo đỏ/nền `#FDECEA`: `Chưa cấu hình bậc phí nào — mọi đơn hàng sẽ không tính được phí vận chuyển.` + nút Primary `+ Thêm bậc phí`. Thẻ Ngưỡng/Thử tính vẫn dùng được (Thử tính với bảng rỗng luôn trả case "không thuộc bậc nào") |
| **Empty — đang lọc/tìm** | Icon + `Không có chương trình nào khớp bộ lọc.` + nút Secondary `Xóa bộ lọc` | — (tab ship không có lọc) |
| **Error tải dữ liệu** | Trong khung bảng: `Không tải được danh sách chương trình.` + nút `Thử lại` (gọi lại với đúng điều kiện lọc hiện tại) | Khối nào lỗi hiện message trong đúng khối đó: `Không tải được bảng bậc phí.` / `Không tải được ngưỡng miễn phí.` + nút `Thử lại` cho riêng khối. Thử tính phí lỗi → message đỏ ngay trong thẻ: `Không tính thử được. Thử lại.` |
| **Đang lưu / tắt / xóa** | Nút tương ứng hiện spinner + khóa các hành động còn lại trên cùng hàng/form; confirm không đóng được bằng Esc/overlay trong lúc gọi API | Tương tự cho modal bậc phí + nút Lưu ngưỡng |
| **Lỗi toàn cục** (mất mạng) | Banner đỏ trên cùng vùng nội dung theo §9 `admin-dashboard.md` + nút `Tải lại trang` | Như tab Flash sale |

Loading trong form flash sale: mở sửa → slide-over hiện skeleton các nhóm trường trong lúc tải chi tiết; lỗi tải chi tiết → banner lỗi trong slide-over + `Thử lại`, nút Lưu khóa cho đến khi tải xong.

---

## §8. Contract backend (builder/code dùng mock khớp shape này)

**Flash sale (chỉ `type=FLASH_SALE`):**

- `GET /admin/flash-sales?q=&status=&page=0&size=20&sort=startAt,desc`
  - `q`: tìm theo `name` (không phân biệt hoa thường). `status`: `RUNNING | UPCOMING | ENDED | INACTIVE` — server suy ra đúng §2.3 (lọc ở server để phân trang đúng).
  - → `{ items: [{ id, code, name, startAt, endAt, totalUsageLimit, usedCount, active, status, itemCount, items: [{ productId, productName, image, variantId, color, flashPrice, discountPercent, maxDiscount, itemQuota, itemSoldCount, originalPrice }] }], total, page, size }` (ngày giờ ISO-8601; `totalUsageLimit: 0` = không giới hạn; `itemQuota: null` = không giới hạn theo món; `originalPrice` = giá của phạm vi áp dụng tại thời điểm trả — variant đã chọn hoặc variant mặc định F-004).
- `GET /admin/flash-sales/{id}` → 1 chương trình đầy đủ như trên (cho form sửa/xem).
- `POST /admin/flash-sales` — body `{ name, startAt, endAt, totalUsageLimit, active, items: [{ productId, variantId, flashPrice | discountPercent, maxDiscount, itemQuota }] }` (`code` server tự sinh `FS-…`, `type` server gán `FLASH_SALE`) → `201` chương trình đã tạo · `422 { message, field? }` vi phạm validate §3 (kèm case trùng lịch §3.2) · `409` khi mã tự sinh trùng (server tự sinh lại, không đẩy lỗi này cho admin).
- `PUT /admin/flash-sales/{id}` — sửa → `200` · `422` (vi phạm ma trận khóa §3.5 ở tầng server: sửa giá/món của chương trình đang chạy, giảm giới hạn dưới đã bán, `endAt ≤ startAt`, trùng lịch…).
- `PATCH /admin/flash-sales/{id}/active` — body `{ active }` → `200`.
- `DELETE /admin/flash-sales/{id}` → `204` · `409 { message }` khi không thỏa điều kiện §4.2.
- Nguồn dữ liệu phụ cho form: tìm sản phẩm + biến thể → `GET /admin/products?q=` (màn 15, response phải kèm `variants: [{ id, color, colorHex, price, stock }]` của sản phẩm).

**Phí vận chuyển:**

- `GET /admin/shipping-rules` → `{ rules: [{ id, minAreaM2, maxAreaM2, fee, active }] (sort minAreaM2 asc), config: { freeThreshold, maxAreaM2 } }` (`maxAreaM2` trong `config` là trần 10 m² chỉ-đọc — §0.2).
- `POST /admin/shipping-rules` — body `{ minAreaM2, maxAreaM2, fee, active }` → `201` · `422 { message }` chồng lấp / `max ≤ min` / 2 bậc "trở lên" (§5.2.1).
- `PUT /admin/shipping-rules/{id}` → `200` · `422` như trên. (Bật/tắt bậc đi qua chính PUT với `active` đổi — không cần endpoint PATCH riêng.)
- `DELETE /admin/shipping-rules/{id}` → `204`.
- `PUT /admin/shipping-config` — body `{ freeThreshold }` → `200 { freeThreshold }` (cơ chế lưu trữ xem §10.3).
- `POST /admin/shipping-rules/preview` — body `{ areaM2, subtotal }` → `{ tier: { min, max } | null, originalFee, fee, freeShipping, overLimit }` — dùng lại logic `ShippingService` (tra bậc + ngưỡng + trần), không tự chế công thức ở FE.
- Hạ tầng: mọi endpoint dưới `/admin/**` → role ADMIN (§A.4). **Không** đặt CRUD dưới `/shipping/**`: `SecurityConfig` hiện hành có matcher public `POST /shipping/quote` phải đứng trước matcher ADMIN của `/shipping/**` (bẫy thứ tự đã ghi ở màn 7) — CRUD admin nằm gọn dưới `/admin/**` thì không đụng bẫy đó. Vite proxy đã có entry `/admin` từ màn 14 — code thật kiểm tra lại entry này trước khi kết luận lỗi backend (bài học /claims).

---

## §9. Traceability

| Mục spec | Nguồn |
|---|---|
| Route `/admin/khuyen-mai`, 2 tab Flash sale / Phí vận chuyển trong 1 mục sidebar | Brief màn 22 · code hiện hành `AdminLayout.jsx`/`App.jsx` · FR-028 + FR-029 (gộp 1 mục §A.2) |
| Layout sidebar/topbar/guard ADMIN + trang 403 | admin-dashboard §A (§A.2, §A.3, §A.4) |
| DataTable, slide-over form dài, modal form ngắn, confirm nêu hậu quả, toast | admin-dashboard §B.1, §B.2, §B.3 |
| Badge trạng thái dùng token `--success`/`--warning`/`--error`/`--text-muted` | admin-dashboard §B.4 · trang-chu §0 |
| Tạo chương trình: sản phẩm/màu chỉ định, giá cố định hoặc % giảm, khung giờ, tổng suất; hết giờ/hết suất → tự đóng | FR-028 · F-022 (input admin) · US-019 · Voucher `type=FLASH_SALE`, `items[]`, `totalUsageLimit`, `usedCount`, `startAt`, `endAt` |
| Trạng thái suy ra Đang chạy/Sắp chạy/Đã kết thúc/Đã tắt từ `active` + giờ + suất | `FlashSaleService.statusOf` (màn 13) · cùng triết lý admin-voucher §2.3 |
| Tên chương trình chỉ nội bộ; phía khách chỉ thấy khung giờ + đếm ngược + nhãn "Flash sale" | flash-sale.md §2.1 + divergence §10 mục 3 (chốt bổ sung `name` tại màn này — §10.2) |
| Giới hạn 2 suất/khách/chương trình — hiển thị chỉ-đọc | F-022 [Giả định] · `FlashSaleService.MAX_SLOTS_PER_CUSTOMER` · flash-sale.md §5.2 |
| `itemQuota`/`itemSoldCount` theo món; tiến độ đã bán từng món phía khách | flash-sale.md §4.3, §9 · ERD `items[]` (mở rộng 2026-10-12) |
| Không cộng dồn voucher thường; đơn đã đặt giữ giá snapshot khi tắt chương trình | F-022 · FR-019 · flash-sale.md §5.4 · 02-ERD §3 (snapshot đơn) |
| Tắt thay vì xóa khi đã/đang bán; xóa chỉ khi chưa chạy + chưa bán | F-018 (triết lý voucher đã dùng) · bản khung màn 22 §A.3 |
| Dữ liệu mẫu chương trình 1 (5 món, 73/100 suất) | flash-sale.md §9 · `flashSaleMock.js` · US-018 (sofa giảm 30%), US-019 (5 sản phẩm, 100 suất) |
| Bảng bậc phí theo diện tích, sửa/thêm/xóa bậc, ngưỡng miễn phí cấu hình được | FR-029 · F-023 · ShippingRule (`minAreaM2`, `maxAreaM2`, `fee`, `active`) |
| Công thức `totalAreaM2 = Σ(lengthM × widthM × qty)`; ví dụ 5,4 m² → bậc 3–6 m² | F-023 · F-007 rule 5 · US-021 |
| Ngưỡng miễn phí 10.000.000đ tính trên tạm tính chưa trừ voucher | 02-ERD §4 [Giả định] · `ShippingService.FREE_SHIPPING_THRESHOLD` · dat-hang.md §5.3 |
| Đơn > 10 m² → "Liên hệ báo giá", chặn checkout online — hiển thị chỉ-đọc | F-023 [Giả định] · `ShippingService.MAX_AREA_M2` |
| Bảng bậc mẫu 0–1 / 1–3 / 3–6 / 6–10 m² = 100.000 / 200.000 / 350.000 / 550.000đ | 02-ERD §4 · `shippingApi.js` (màn 7) |
| Phí ship chốt snapshot lúc tạo đơn → sửa cấu hình chỉ áp cho đơn tạo mới | 02-ERD §3 · F-007 rule 5 · entity Order `shippingFee` |
| Ranh giới FLASH_SALE + `items[]` + phí ship thuộc màn 22, voucher thường thuộc màn 19 | admin-voucher.md §0.1 · FR-024/F-018 (màn 19) |
| Loading skeleton / empty / error + Thử lại cho từng tab | Operating rule 2 · admin-dashboard §B.1, §9 |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Flash sale & Phí vận chuyển` (đã có ở sidebar) · `Tạo chương trình` · `Tên chương trình` · `Khung giờ` · `Tổng suất` · `Sản phẩm tham gia` · `Phạm vi màu` · `Tất cả các màu` · `Giá flash cố định` · `Suất riêng của món` · `Tắt chương trình` · `Phí vận chuyển` (đã chốt màn 7) · `Bậc phí` · `Ngưỡng miễn phí vận chuyển` · `Thử tính phí` · `Đang áp dụng`. Trạng thái `Đang chạy` / `Sắp chạy` / `Đã kết thúc` / `Đã tắt` dùng lại nguyên văn màn 19/13, không chế mới.

**Toggle demo cho live-ui-builder:** tab Flash sale — danh sách: `Có dữ liệu` (mặc định, §2.4) / `Trống` / `Lỗi tải`; form: `Tạo mới` / `Sửa — Sắp chạy` / `Sửa — Đang chạy (khóa trường §3.5)` / `Xem — Đã kết thúc`. Tab Phí vận chuyển: `Có bậc phí` (mặc định, §5.2.2) / `Chưa có bậc nào` / `Có lỗ hổng` (bảng mẫu bỏ bậc 3–6 để hiện dải cảnh báo) / `Lỗi tải`.

---

## §10. Divergence & giả định (builder/code đọc kỹ — không tự suy diễn)

### 10.1 Route và file khung cũ

`admin-dashboard.md` §A.2 ghi mục 9 trỏ `/admin/flash-sale`; bản khung `admin-flash-sale-phi-ship.md` đề xuất 2 route riêng `/admin/flash-sale` + `/admin/phi-ship`. Cả hai đều lệch thực tế: code đã ship dùng **1 route `/admin/khuyen-mai`** (`AdminLayout.jsx`, `App.jsx`) và brief màn 22 chốt 1 route 2 tab. Spec này theo code thật + brief; bản khung cũ chỉ còn giá trị ở các rule nghiệp vụ (đã kế thừa vào §3.5, §5.2.1, §5.3). Doc-writer cần: sửa route ở §A.2 khi có dịp, và sửa tham chiếu tên file ở `admin-voucher.md` §0.1 (đang trỏ `admin-flash-sale-phi-ship.md`) sang file spec này.

### 10.2 Field `name` cho chương trình flash sale — bổ sung ERD/model [Quyết định chốt tại màn 22]

`flash-sale.md` §10 divergence 3 để mở: Voucher **không có** field tên chương trình, phía khách dùng nhãn cố định "Flash sale". Màn này chốt: **bổ sung `name`** (string, chỉ dùng khi `type=FLASH_SALE`) vào entity Voucher + 02-ERD, vì admin cần phân biệt nhiều chương trình trong danh sách mà `code` tự sinh không gợi nghĩa. Phía khách **không** đọc field này — giữ nguyên nhãn cố định + khung giờ như màn 13. Hệ quả đi kèm: `code` vẫn bắt buộc unique/not-null trong DB nên server tự sinh `FS-XXXXXX` khi tạo chương trình (admin không nhập, không sửa, khách không thấy). Trước khi backend bổ sung `name`, demo chạy bằng mock có field này.

### 10.3 Ngưỡng miễn phí đang hardcode — phải chuyển thành cấu hình mới sửa được

`ShippingService.FREE_SHIPPING_THRESHOLD = 10.000.000` (backend) và `FREE_SHIP_THRESHOLD` trong `shippingApi.js` (mock FE) đang là hằng số. §5.3/§8 giả định code thật của màn này sẽ: (1) lưu ngưỡng vào một cấu hình bền (đề xuất: document cấu hình ship đơn nhất — collection `app_configs` khóa `SHIPPING` hoặc collection riêng `shipping_configs` — doc-writer/backend chọn 1 và ghi vào ERD); (2) `ShippingService` đọc cấu hình thay vì hằng số, giữ giá trị khởi tạo 10.000.000đ khi chưa có cấu hình. Chưa làm 2 bước này thì ô nhập ngưỡng ở §5.3 **không có hiệu lực thật** — builder phải ghi chú trong demo/PR.

### 10.4 Chặn trùng lịch chương trình [Giả định của spec]

FR-028/F-022 không nói gì về hai chương trình chồng lịch. Spec đề xuất **chặn cứng** (§3.2) vì phía khách chỉ hiển thị 1 chương trình hiện hành. Nếu chủ dự án muốn cho phép chồng lịch (VD chương trình dự phòng), bỏ validate này — hành vi phía khách khi đó vẫn do `FlashSaleService.currentProgram` quyết định (chương trình kết thúc sớm hơn thắng khi đang chạy), và admin phải tự chịu việc một chương trình bị ẩn. Ghi rõ để người duyệt quyết tại demo.

### 10.5 Validate bậc phí: chồng lấp chặn cứng, lỗ hổng cảnh báo [Giả định của spec]

F-023/02-ERD không định nghĩa validate cho bảng bậc phí (chỉ có bảng mẫu phủ liên tục 0–10 m²). Spec chốt [Giả định]: chồng lấp giữa các bậc active = **chặn cứng** FE + BE (phí không thể mơ hồ giữa 2 bậc); lỗ hổng = **cảnh báo vàng, vẫn cho lưu** (§5.2, §5.2.1) vì admin cần sửa nhiều bậc theo trình tự. Hệ quả của lỗ hổng đã nêu rõ trong UI: đơn rơi vào khoảng trống không tính được phí (`ShippingService` tra không ra bậc → `fee = null`) — checkout hiện hành xử lý case này là việc của màn 7, spec này chỉ đảm bảo admin **nhìn thấy** lỗ hổng trước khi nó chạm tới khách.

### 10.6 Hai hằng số giữ nguyên hardcode ở màn này

Trần 10 m² (`MAX_AREA_M2`) và giới hạn 2 suất/khách (`MAX_SLOTS_PER_CUSTOMER`) đều là [Giả định] trong docs và đang hardcode ở service. Màn này chỉ hiển thị chỉ-đọc (§0.2) — đưa chúng thành cấu hình sửa được là thay đổi nghiệp vụ ngoài FR-028/FR-029, không tự làm; nếu chủ dự án muốn sửa được, làm cùng cơ chế cấu hình của §10.3 trong một vòng riêng.

### 10.7 Chương trình legacy không có `items[]`

`FlashSaleService.effectiveItems` có fallback: chương trình cũ chỉ có `applicableProductIds` + `value` (% cho mọi màu) thì vẫn chạy phía khách. Form màn này luôn ghi `items[]` đầy đủ; khi mở sửa một chương trình legacy, backend trả `items` suy từ fallback đó (mỗi sản phẩm 1 item `variantId = null`, `discountPercent = value`, `itemQuota = null`) và lần Lưu đầu tiên sẽ chuẩn hóa nó thành `items[]` thật. Builder demo không cần mô phỏng case này; code thật phải xử lý ở tầng DTO, không để FE tự suy.
