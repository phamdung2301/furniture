# Spec giao diện — Quản lý Voucher (admin-voucher)

- **Dự án:** noi-that-shop · **Màn:** 19 — Quản lý Voucher (wave 4 — admin)
- **Nguồn:** FR-024 · F-018 · US-017 · Hỗ trợ phía khách: FR-019, F-007 rule 2, US-007 (voucher áp ở checkout, màn 7) · Entity: Voucher (02-ERD §2)
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** tái dùng nguyên xi §0 của `trang-chu.md` + **§A layout admin** và **§B quy ước DataTable / form / confirm / toast / badge** của `admin-dashboard.md` — spec này TUÂN THỦ, không định nghĩa lại. Tiền format `vi-VN` + `đ`; ngày giờ `dd/MM/yyyy HH:mm`.

---

## §0. Ranh giới & quy ước đọc spec (đọc trước)

### 0.1 Ranh giới với màn 22 — Flash sale & Phí ship (FR-028, FR-029)

| | Màn này (19 — `/admin/voucher`) | Màn 22 (`admin-flash-sale-phi-ship.md`) |
|---|---|---|
| Đối tượng | Voucher thường: entity Voucher với `type = PERCENT \| FIXED` | Chương trình flash sale: cùng entity Voucher nhưng `type = FLASH_SALE` (+ mảng `items[]`), và `ShippingRule` (phí ship) |
| Form | Mã code khách nhập ở checkout, mức giảm, điều kiện, giới hạn lượt | Danh sách món/màu áp dụng, giá flash / % giảm theo món, `itemQuota`, đếm ngược |
| Phía khách | Khách tự nhập mã ở bước 2 checkout (màn 7) | Giá tự áp theo khung giờ ở trang flash sale (màn 13), **không nhập mã, không cộng dồn voucher thường** (F-022) |

- Hai màn dùng **chung collection `vouchers`** và `code` là unique **toàn cục** (02-ERD §3): tạo mã ở màn này trùng mã của một chương trình flash sale (kể cả đã tắt) → vẫn bị từ chối 409.
- Bảng ở màn này **luôn loại `type=FLASH_SALE`** khỏi kết quả — kể cả khi API trả lẫn, FE phải lọc; builder không hiển thị chương trình flash sale dưới bất kỳ bộ lọc nào của màn này.
- Màn này **không có**: trường `items[]`, `flashPrice`, `itemQuota`, đếm ngược, cấu hình phí ship. Thấy các trường đó trong dữ liệu trả về → bỏ qua, không render.

### 0.2 Ánh xạ tên trường (brief ↔ ERD/code hiện hành — tránh chế field mới)

- Brief gọi nhóm voucher này là `type DISCOUNT` và hai trường `discountType percent|fixed` + `discountValue`: trong ERD và `Voucher.java` hiện hành **không có** các field đó. Ánh xạ 1–1: nhóm "DISCOUNT" ≡ `type ∈ {PERCENT, FIXED}`; `discountType` ≡ chính field `type`; `discountValue` ≡ field `value`. Spec dùng tên ERD/code (`type`, `value`) để builder/code khớp ngay, không tạo field song song.
- `applicableCategoryIds` (brief) ≡ `applicableCategories` trong ERD/code (mảng id danh mục dạng string); `applicableProductIds` giữ nguyên tên.
- **`perUserLimit` (giới hạn mỗi khách) CHƯA có trong ERD và `Voucher.java`** — xem divergence §9.1: spec vẫn đưa vào form theo yêu cầu brief nhưng gắn nhãn [Giả định], builder dựng demo bằng mock, code thật phải bổ sung field + logic đếm ở backend trước khi tính năng có hiệu lực.

### 0.3 Rule đã chốt ở màn 7 (không thay đổi ở màn này)

- Voucher **chỉ nhập ở bước Mã ưu đãi của checkout** (màn 7 §3), không có ô nhập ở giỏ hàng; mỗi đơn **1 voucher** (FR-019 [Giả định]).
- Voucher **không áp lên các dòng flash sale**: ở checkout, discount chỉ tính trên tổng các dòng thường (`nonFlashSubtotal` — `OrderService` hiện hành). Chọn phạm vi áp dụng ở màn này (§3.4) cũng không làm thay đổi rule đó.
- Các message lỗi phía khách đã ship ở màn 7 và giữ nguyên: `Mã đã hết hạn.` / `Mã đã hết lượt sử dụng.` / `Đơn hàng chưa đạt giá trị tối thiểu {X}đ.` — admin tắt/hết hạn/hết lượt một voucher thì khách đang ở checkout sẽ gặp đúng các message này (hoặc `Mã ưu đãi không tồn tại.` khi voucher bị tắt — hành vi `VoucherService.validate` hiện hành: `active=false` trả về case NOT_FOUND).

---

## §1. Bố cục trang `/admin/voucher` → FR-024, F-018

Khung §A của `admin-dashboard.md`: sidebar mục 6 "Voucher" active, topbar tiêu đề `Voucher`, breadcrumb `Quản trị / Voucher`. Vùng nội dung từ trên xuống:

1. **Hàng tiêu đề trang:** trái — H1 `Quản lý voucher` 24px/700 + dòng phụ 13px `--text-muted`: `Mã giảm giá khách nhập khi đặt hàng. Chương trình flash sale được quản lý ở màn Flash sale & Phí ship.`; phải — nút Primary **`+ Tạo voucher`** (mở form §3 ở chế độ tạo mới).
2. **Thẻ bảng DataTable** (§B.1): thanh công cụ (tìm kiếm + bộ lọc, §2.1) → bảng (§2.2) → phân trang (§B.1: `Trang X / Y · Tổng N mục`, chọn 10/20/50 mục/trang).
3. **Form tạo/sửa:** slide-over (§3). **Confirm vô hiệu hóa / xóa:** modal nhỏ §B.3 (§4).

Không có khối KPI riêng ở màn này [không có trong docs — không tự thêm biểu đồ/thống kê ngoài FR-024].

---

## §2. DataTable voucher → FR-024, F-018, US-017

### 2.1 Thanh công cụ (theo §B.1)

- **Ô tìm kiếm theo mã:** icon kính lúp, placeholder `Tìm theo mã voucher…`, debounce 300ms; gõ đến đâu tự in hoa hiển thị đến đó (`code` lưu uppercase — F-018); tìm theo tiền tố/chuỗi con của `code`, không phân biệt hoa thường ở tầng query. Xóa ô tìm → tải lại danh sách không lọc.
- **Lọc trạng thái** (select hoặc hàng chips, 1 chọn tại 1 thời điểm): `Tất cả` · `Đang chạy` · `Sắp chạy` · `Hết hạn` · `Hết lượt` · `Đã tắt` — định nghĩa trạng thái suy ra tại §2.3. Mặc định `Tất cả`.
- **Lọc loại giảm** (select/chips): `Tất cả loại giảm` · `Giảm %` (PERCENT) · `Giảm số tiền` (FIXED).
- Hai bộ lọc + ô tìm **kết hợp dạng AND**; đổi bất kỳ điều kiện nào → về trang 1 và tải lại. Khi đang có lọc/tìm mà kết quả rỗng → empty state có nút `Xóa bộ lọc` (§5).
- Nút `+ Tạo voucher` ở góc phải thanh công cụ (cùng nút với §1.1 — trên mobile hàng tiêu đề thu gọn, chỉ giữ nút trong thanh công cụ của bảng).

### 2.2 Cột bảng (header theo §B.1: 13px/700 uppercase `--text-muted`)

| # | Cột | Nội dung & định dạng |
|---|---|---|
| 1 | **Mã code** | `code` font mono, 600, `--brand-700`, luôn uppercase (VD `KHAITRUONG`). Click vào mã (hoặc icon sao chép cạnh mã) → copy vào clipboard + toast `Đã sao chép mã KHAITRUONG.` |
| 2 | **Loại giảm** | PERCENT: dòng chính `Giảm {value}%`, dòng phụ 13px `--text-muted` `tối đa {maxDiscount}đ` (chỉ khi có `maxDiscount`; không có → `không giới hạn mức giảm`). FIXED: dòng chính `Giảm {value}đ`, không dòng phụ. |
| 3 | **Điều kiện & phạm vi** | Dòng chính: `minOrderValue > 0` → `Đơn từ {minOrderValue}đ`; `minOrderValue = 0`/trống → `Mọi đơn hàng`. Dòng phụ (phạm vi §3.4): `Toàn đơn` / `{n} danh mục` / `{n} sản phẩm` — hover/click dòng phụ hiện tooltip liệt kê tên danh mục/sản phẩm đã chọn. |
| 4 | **Thời gian hiệu lực** | 2 dòng 13px: `Từ {startAt}` / `Đến {endAt}` (format `dd/MM/yyyy HH:mm`). Dòng phụ thứ ba (chỉ khi liên quan, 12px): trạng thái `Sắp chạy` → `Bắt đầu sau {n} ngày/giờ`; `Đang chạy` và còn < 48 giờ → chữ `--warning` `Còn {n} giờ`; `Hết hạn` → `Đã kết thúc {n} ngày trước`. |
| 5 | **Đã dùng / Giới hạn** | Dòng chính: `{usedCount} / {totalUsageLimit}`; `totalUsageLimit` trống/0 = không giới hạn → `{usedCount} / Không giới hạn`. Dưới dòng chính: thanh tiến độ mini (cao 6px, nền `--border`, phần đã dùng `--brand-700`; ≥ 90% chuyển `--warning`, = 100% chuyển `--error`) — chỉ vẽ khi có giới hạn hữu hạn. Dòng phụ khi có `perUserLimit` (§9.1): `Tối đa {perUserLimit} lượt/khách`. |
| 6 | **Trạng thái** | Badge suy ra theo §2.3 (màu theo §B.4). |
| 7 | **Hành động** | Cụm icon phải, kèm tooltip chữ (§B.1): `Sửa` (mở slide-over §3) · `Vô hiệu hóa` / `Bật lại` (theo `active` hiện tại — §4.1) · `Xóa` (disabled + tooltip lý do khi không được xóa — §4.2). |

- **Sắp xếp:** click header đổi chiều ↑↓ (§B.1) cho cột Mã code, Thời gian hiệu lực (theo `endAt`), Đã dùng. **Mặc định: `endAt` tăng dần** (voucher sắp hết hạn lên đầu) [Đề xuất của spec — entity Voucher không có `createdAt` nên không sắp theo "mới tạo" được; xem §9.4].
- Hàng hover nền `#FBF8F3` (§B.1). Bảng cuộn ngang trên mobile, giữ nguyên thứ tự cột.

### 2.3 Trạng thái hiển thị — suy ra, không lưu thêm field

Trạng thái tính tại thời điểm hiển thị từ `active` + `startAt`/`endAt` + `usedCount`/`totalUsageLimit` (cùng triết lý `FlashSaleService.statusOf` đã ship ở màn 13), theo **thứ tự ưu tiên từ trên xuống**:

| Ưu tiên | Điều kiện | Badge | Màu (§B.4) |
|---|---|---|---|
| 1 | `active = false` | `Đã tắt` | nền xám, chữ `--text-muted` |
| 2 | `active = true` và `now > endAt` | `Hết hạn` | nền xám, chữ `--text-muted` |
| 3 | `active = true` và `now < startAt` | `Sắp chạy` | nền `#FDF3E0`, chữ `--warning` |
| 4 | Đang trong hiệu lực và có giới hạn và `usedCount ≥ totalUsageLimit` | `Hết lượt` | nền `#FDECEA`, chữ `--error` |
| 5 | Còn lại (đang trong hiệu lực, còn lượt) | `Đang chạy` | nền `#E8F5E9`, chữ `--success` |

- Hệ quả phải nhất quán với checkout (F-007 rule 2): chỉ voucher `Đang chạy` mới áp được; `Sắp chạy` → khách áp sẽ lỗi hết hạn/chưa hiệu lực; `Hết lượt` → `Mã đã hết lượt sử dụng.`; `Hết hạn` → `Mã đã hết hạn.`; `Đã tắt` → `Mã ưu đãi không tồn tại.` (theo `VoucherService` hiện hành, §0.3).
- Bật lại (`active = true`) một voucher đã qua `endAt` → badge vẫn là `Hết hạn`, không tự thành `Đang chạy` (xem §4.1).

### 2.4 Dữ liệu mẫu demo (builder dùng đúng số này — "hôm nay" của demo là 12/10/2026)

| Code | Loại giảm | Đơn tối thiểu / Phạm vi | Hiệu lực | Đã dùng / Giới hạn | Trạng thái suy ra |
|---|---|---|---|---|---|
| `KHAITRUONG` | PERCENT 10%, tối đa 200.000đ | 1.000.000đ / Toàn đơn | 01/10/2026 00:00 → 31/10/2026 23:59 | 128 / 500 · tối đa 1 lượt/khách | Đang chạy *(đúng ví dụ US-017)* |
| `NOITHAT50` | PERCENT 50%, tối đa 200.000đ | 1.000.000đ / Toàn đơn | 01/10/2026 00:00 → 31/12/2026 23:59 | 342 / 1.000 | Đang chạy *(mã đã có ở màn 7)* |
| `NOITHAT10` | FIXED 500.000đ | 10.000.000đ / Toàn đơn | 01/10/2026 00:00 → 31/12/2026 23:59 | 200 / 200 | Hết lượt *(mã đã có ở màn 7)* |
| `NOITHAT20` | PERCENT 20%, tối đa 100.000đ | 20.000.000đ / 1 danh mục (Sofa) | 01/10/2026 00:00 → 31/12/2026 23:59 | 45 / 300 | Đang chạy *(mã đã có ở màn 7)* |
| `NOEL2026` | FIXED 300.000đ | 5.000.000đ / Toàn đơn | 20/12/2026 00:00 → 26/12/2026 23:59 | 0 / 150 | Sắp chạy |
| `TRUNGTHU` | PERCENT 15%, tối đa 150.000đ | 500.000đ / Toàn đơn | 01/09/2026 00:00 → 30/09/2026 23:59 | 89 / 200 | Hết hạn |
| `SINHNHAT` | FIXED 100.000đ | Mọi đơn hàng / Toàn đơn | 01/10/2026 00:00 → 31/10/2026 23:59 | 12 / 100 | Đã tắt (`active=false`, có lượt dùng → demo case không xóa được) |
| `WELCOME` | PERCENT 5%, tối đa 50.000đ | Mọi đơn hàng / Toàn đơn | 01/10/2026 00:00 → 31/12/2026 23:59 | 0 / 50 | Đang chạy (chưa từng được dùng → demo case xóa được) |

Kiểm tra chéo: `KHAITRUONG` khớp từng số với acceptance của US-017 (giảm 10%, trần 200.000đ, đơn từ 1.000.000đ, trong tháng 10, giới hạn 500 lượt).

---

## §3. Form tạo / sửa — slide-over → FR-024, F-018, US-017

### 3.1 Hình thức: slide-over (không phải modal)

- **Chọn slide-over trượt từ phải, rộng 560px, mobile full-screen** theo §B.2. Lý do ghi rõ: form có **> 6 trường** và 4 nhóm (§3.2–§3.5) cộng khối xem trước (§3.6) — vượt ngưỡng "form ngắn ≤ 6 trường → modal 520px" mà §B.2 dành cho danh mục/voucher đơn giản; voucher ở dự án này có thêm phạm vi áp dụng + 2 giới hạn nên thuộc nhóm form dài như sản phẩm (màn 15).
- Tiêu đề: tạo mới → `Tạo voucher`; sửa → `Sửa voucher {code}`. Đóng bằng ×/Esc/click overlay; đã sửa mà chưa lưu → confirm `Bạn có thay đổi chưa lưu. Đóng mà không lưu?` (§B.2).
- Chân form cố định: nút `Hủy` (Secondary) + nút Primary — tạo: `Tạo voucher`, sửa: `Lưu thay đổi`. Đang lưu: nút loading + khóa toàn form (§B.2).
- Validate inline khi rời trường: viền `--error` + message 12px dưới trường (§B.2). Trường bắt buộc có dấu `*`.

### 3.2 Nhóm 1 — Mã & trạng thái

| Trường | Control | Quy tắc |
|---|---|---|
| Mã voucher `code`* | Input text, mono, tự chuyển uppercase + trim khi gõ | Bắt buộc; 3–30 ký tự, chỉ gồm `A–Z 0–9 - _` (không dấu, không khoảng trắng) — sai định dạng: `Mã chỉ gồm chữ in hoa, số, dấu - và _.` Unique toàn cục (kể cả flash sale, §0.1): trùng → lỗi ngay tại trường khi API trả 409: `Mã này đã tồn tại. Hãy chọn mã khác.` (F-018) |
| Tạo mã tự động | Nút Text `Tạo mã ngẫu nhiên` cạnh ô code [Đề xuất của spec — chờ duyệt tại demo] | Bấm → sinh mã 8 ký tự chữ+số in hoa, điền vào ô; admin vẫn sửa tay được. Không ghi đè khi admin đã gõ (chỉ điền khi ô trống hoặc admin bấm lần nữa sau khi xác nhận bằng hành vi bấm nút). |
| Kích hoạt `active` | Switch, mặc định **bật** khi tạo mới | Tắt ngay khi tạo = voucher ở trạng thái `Đã tắt` dù còn trong hiệu lực. Sửa: đổi switch ở đây tương đương hành động `Vô hiệu hóa`/`Bật lại` ở bảng — nếu voucher đang chạy mà admin tắt switch rồi Lưu → vẫn phải qua confirm hậu quả của §4.1 trước khi gọi API. |

- **Chế độ sửa:** nếu voucher đã có lượt dùng (`usedCount > 0`) → ô `code` **disabled** kèm hint `Không đổi được mã khi voucher đã có lượt dùng.` [Giả định diễn giải F-018 — docs chỉ chốt "đã dùng thì không xóa"; khóa mã vì `Order.voucherCode` tham chiếu theo chuỗi mã, đổi mã sẽ đứt liên kết đơn cũ]. Kèm dòng thông tin chỉ-đọc: `Đã dùng: {usedCount} lượt` (không có control sửa `usedCount` ở bất kỳ đâu trong form).

### 3.3 Nhóm 2 — Mức giảm (`type` + `value` + `maxDiscount`)

- **Loại giảm `type`\*:** segmented control 2 lựa chọn: `Giảm %` (PERCENT) · `Giảm số tiền` (FIXED). Mặc định PERCENT.
- **Giá trị giảm `value`\*:** input số, hậu tố theo loại (`%` hoặc `đ`).
  - PERCENT: nguyên 1–100; `> 100` hoặc `≤ 0` → `Phần trăm giảm phải từ 1 đến 100.` (task brief: % ≤ 100; value > 0 theo F-018/code).
  - FIXED: số tiền `> 0`, format nghìn khi gõ; `≤ 0` → `Số tiền giảm phải lớn hơn 0đ.`
- **Giảm tối đa `maxDiscount`:** chỉ hiện khi PERCENT. Bắt buộc khi PERCENT [theo bản khung đã chốt của màn này + đúng mọi ví dụ docs: US-017, màn 7 đều có trần]; `> 0`; trống → `Nhập mức giảm tối đa khi giảm theo %.` Gợi ý phụ: để trống = không trần thì **không được phép** trong form này — nếu nghiệp vụ đổi ý, bỏ validate này và gửi `null` (backend đã hỗ trợ `maxDiscount = null` = không trần). Khi chuyển sang FIXED → ẩn trường và gửi `maxDiscount = null` (backend `calcDiscount` với FIXED lấy `value` chặn bởi tổng đơn, không dùng `maxDiscount`).
- Đổi loại giảm qua lại không làm mất giá trị đã nhập của loại còn lại trong phiên mở form (giữ state cục bộ), nhưng khi Lưu chỉ gửi theo loại đang chọn.

### 3.4 Nhóm 3 — Điều kiện & phạm vi áp dụng → FR-019, F-007 rule 2

- **Đơn tối thiểu `minOrderValue`:** input tiền, mặc định `0`. `≥ 0`; `0` = mọi đơn hàng đều dùng được. Âm → `Giá trị đơn tối thiểu không được âm.` Hint: `Tính trên tổng các dòng thường của đơn (không gồm dòng flash sale, không gồm phí vận chuyển).` [nhất quán `OrderService` hiện hành — discount tính trên subtotal dòng thường]
- **Phạm vi áp dụng:** radio 3 lựa chọn (chọn đúng 1):
  1. `Toàn đơn` (mặc định) → gửi `applicableCategories = []`, `applicableProductIds = []` (ERD: rỗng = áp mọi danh mục).
  2. `Theo danh mục` → hiện multi-select danh mục (checkbox list lấy từ màn 16, gồm danh mục cha/con): phải chọn ≥ 1, trống → `Chọn ít nhất 1 danh mục.` Gửi id vào `applicableCategories`.
  3. `Theo sản phẩm cụ thể` → hiện ô tìm sản phẩm (debounce 300ms, nguồn màn 15) + danh sách sản phẩm đã chọn dạng chip có nút ×: phải chọn ≥ 1, trống → `Chọn ít nhất 1 sản phẩm.` Gửi id vào `applicableProductIds`.
- Hint cố định dưới nhóm: `Mã giảm giá không áp dụng cho các sản phẩm đang flash sale.` (§0.3 — F-022 không cộng dồn).
- ⚠️ Phạm vi là dữ liệu ERD có thật nhưng việc **ép điều kiện ở checkout hiện chưa được backend thực thi** — xem divergence §9.3. Form vẫn thu thập và lưu đúng field; demo mock hiển thị đúng ở cột bảng.

### 3.5 Nhóm 4 — Giới hạn lượt & thời gian hiệu lực

| Trường | Control | Quy tắc |
|---|---|---|
| Tổng giới hạn lượt `totalUsageLimit` | Input số nguyên + checkbox `Không giới hạn` | Có giới hạn: `≥ 1`. Tick `Không giới hạn` → khóa ô số, gửi `0` (convention §9.2). Khi sửa: không được đặt giới hạn **nhỏ hơn `usedCount` hiện tại** → `Giới hạn phải từ {usedCount} lượt trở lên (đã dùng {usedCount}).` |
| Giới hạn mỗi khách `perUserLimit` [Giả định — §9.1] | Input số nguyên + checkbox `Không giới hạn` (mặc định tick) | Có giới hạn: `≥ 1`. Nếu đồng thời có tổng giới hạn và `perUserLimit > totalUsageLimit` → cảnh báo vàng dưới trường (không chặn): `Giới hạn mỗi khách đang lớn hơn tổng giới hạn lượt.` |
| Bắt đầu `startAt`* | `datetime-local` | Bắt buộc. Được chọn quá khứ (voucher thành `Đang chạy` ngay nếu đang bật) hoặc tương lai (`Sắp chạy`). |
| Kết thúc `endAt`* | `datetime-local` | Bắt buộc. **`endAt > startAt`** — validate cả FE lẫn BE (F-018: không cho `endAt < startAt`; spec chặt thêm: bằng nhau cũng lỗi): `Thời gian kết thúc phải sau thời gian bắt đầu.` Nếu `endAt` đã ở quá khứ khi lưu → cảnh báo vàng trên đầu form (không chặn): `Voucher sẽ ở trạng thái Hết hạn ngay sau khi lưu.` |

- Chips chọn nhanh thời hạn [Đề xuất — chờ duyệt tại demo]: `7 ngày` · `30 ngày` · `Hết tháng này` — bấm → tự điền `startAt` = đầu hôm nay, `endAt` = 23:59 của ngày đích. Chỉ là trợ nhập, không field dữ liệu riêng.

### 3.6 Khối xem trước (cuối form, chỉ-đọc)

Card nền `#F5EFE6`, bo 12px, tiêu đề nhỏ `Khách sẽ thấy ở bước Mã ưu đãi (checkout)`: hiển thị 1 dòng mô tả tự sinh từ các trường đang nhập, **đúng format `VoucherService.describe` đã ship**: PERCENT → `Giảm {value}% tối đa {maxDiscount}đ — đơn từ {minOrderValue}đ`; FIXED → `Giảm {value}đ — đơn từ {minOrderValue}đ` (bỏ vế đơn khi `minOrderValue = 0`). Trường chưa đủ dữ liệu → hiện placeholder các vế còn thiếu bằng `…`. Khối này giúp admin tự kiểm tra trước khi lưu, không gửi thêm dữ liệu nào.

### 3.7 Lưu & lỗi

- Tạo thành công → đóng form, toast `Đã tạo voucher {code}.`, bảng tải lại và **đưa voucher mới lên vùng nhìn thấy** (nếu bộ lọc hiện tại loại nó ra, reset bộ lọc về `Tất cả` trước khi tải lại — để admin thấy ngay kết quả).
- Sửa thành công → toast `Đã lưu voucher {code}.`, bảng tải lại đúng trang hiện tại (§B.3).
- Lỗi 409 (trùng mã) → lỗi tại trường `code` (§3.2), giữ nguyên form + dữ liệu đã nhập. Lỗi 422 (validate backend: `endAt ≤ startAt`, giới hạn < đã dùng…) → message của API hiển thị tại đúng trường tương ứng nếu map được, không map được thì banner lỗi đỏ trên đầu form. Lỗi mạng/500 → banner lỗi trên đầu form + nút `Thử lại` (gửi lại nguyên payload), không đóng form, không mất dữ liệu.

---

## §4. Vô hiệu hóa, bật lại, xóa → F-018, §B.3

### 4.1 Vô hiệu hóa voucher đang chạy / sắp chạy (confirm bắt buộc)

- Hành động `Vô hiệu hóa` trên hàng (icon tắt nguồn, tooltip `Vô hiệu hóa`) hoặc tắt switch `active` trong form sửa → **confirm dialog** §B.3 (modal nhỏ 400px):
  - Tiêu đề: `Vô hiệu hóa voucher {code}?` (code in đậm).
  - Nội dung nêu hậu quả cụ thể (không viết chung chung): `Khách đang ở bước đặt hàng sẽ không áp được mã này nữa (hệ thống báo "Mã ưu đãi không tồn tại."). Các đơn đã tạo trước đó không bị ảnh hưởng. Lượt đã dùng ({usedCount}) được giữ nguyên và bạn có thể bật lại voucher sau.`
  - Nút nguy hiểm nền `--error`: `Vô hiệu hóa`; nút `Hủy` Secondary.
- Xác nhận → `PATCH …/active { active: false }` → toast `Đã tắt voucher {code}.` → badge chuyển `Đã tắt`, bảng tải lại.
- **Bật lại:** hành động `Bật lại` — **không cần confirm**, gọi PATCH ngay, toast `Đã bật voucher {code}.`. Nếu voucher đã qua `endAt` → toast cảnh báo thay toast thường: `Đã bật voucher {code}, nhưng voucher đã hết hạn nên khách chưa dùng được. Hãy gia hạn thời gian kết thúc.` và badge hiển thị `Hết hạn`.

### 4.2 Xóa voucher (chỉ khi chưa từng được dùng)

- Điều kiện được xóa (cả hai phải đúng, đúng F-018 "voucher đang có đơn dùng → chỉ được tắt, không xóa"): `usedCount = 0` **và** không tồn tại đơn nào có `voucherCode` = mã này (bất kỳ trạng thái đơn nào — kể cả đơn đã hủy: đơn hủy đã hoàn lượt làm `usedCount` về 0 nhưng mã vẫn nằm trong lịch sử đơn, vẫn không được xóa).
- Không thỏa điều kiện → nút `Xóa` **disabled** + tooltip: `Voucher đã có lượt dùng — chỉ có thể vô hiệu hóa, không thể xóa.` (case demo: `SINHNHAT`, `KHAITRUONG`…).
- Thỏa điều kiện → confirm §B.3: tiêu đề `Xóa voucher {code}?`, nội dung: `Voucher {code} (in đậm) chưa từng được dùng trong đơn nào. Thao tác này không thể hoàn tác.`, nút `--error` `Xóa`, nút `Hủy`.
- Xóa xong → toast `Đã xóa voucher {code}.`, bảng tải lại đúng trang hiện tại; trang rỗng sau xóa → lùi 1 trang (§B.3).
- API trả 409/422 khi cố xóa voucher đã có đơn dùng (đường gọi trực tiếp ngoài UI) → toast đỏ đúng message API, bảng tải lại để đồng bộ trạng thái.

### 4.3 Những gì KHÔNG làm ở màn này

- Không sửa `usedCount` thủ công; không "reset lượt" (không có trong docs).
- Không nhân bản/sao chép voucher, không xuất Excel/CSV, không xem danh sách đơn đã dùng một mã (thuộc QL Đơn hàng màn 17, lọc theo `voucherCode` nếu cần) — không tự thêm ngoài FR-024/F-018.

---

## §5. Trạng thái toàn trang → §B.1

| Tình huống | Hiển thị |
|---|---|
| **Loading lần đầu / đổi lọc / đổi trang** | Bảng skeleton 5 hàng xám nhấp nháy (§B.1); thanh công cụ giữ nguyên, ô tìm/filters không bị khóa. |
| **Empty — chưa có voucher nào** (không lọc) | Trong khung bảng: icon tem giảm giá + `Chưa có voucher nào.` + nút Primary `+ Tạo voucher` (mở form §3). |
| **Empty — đang lọc/tìm** | Icon + `Không có voucher nào khớp bộ lọc.` + nút Secondary `Xóa bộ lọc` (đặt lại tìm kiếm + 2 bộ lọc về mặc định, tải lại). |
| **Error tải danh sách** | Trong khung bảng: `Không tải được danh sách voucher.` + nút `Thử lại` (chỉ gọi lại list API với đúng điều kiện lọc hiện tại). Lỗi toàn cục mất mạng → banner đỏ trên vùng nội dung theo §9 admin-dashboard + `Tải lại trang`. |
| **Loading trong form** | Mở sửa: slide-over hiện skeleton các nhóm trường trong lúc tải chi tiết voucher; lỗi tải chi tiết → banner lỗi trong slide-over + `Thử lại`, nút Lưu khóa cho đến khi tải xong. |
| **Đang lưu / đang tắt / đang xóa** | Nút tương ứng hiện spinner + khóa các hành động còn lại trên cùng hàng/form; confirm dialog không đóng được bằng Esc/overlay trong lúc đang gọi API. |

Guard & phân quyền: theo §A.4 — chưa đăng nhập → `/dang-nhap?returnTo=/admin/voucher`; `role != ADMIN` → trang 403; mọi endpoint `/admin/**` yêu cầu ADMIN ở backend.

---

## §6. Contract backend (builder/code dùng mock khớp shape này)

- `GET /admin/vouchers?q=&status=&discountType=&page=0&size=20&sort=endAt,asc`
  - `q`: tìm theo `code` (không phân biệt hoa thường). `status`: `RUNNING | UPCOMING | EXPIRED | EXHAUSTED | INACTIVE` — server suy ra đúng §2.3 (lọc ở server để phân trang đúng). `discountType`: `PERCENT | FIXED` (ánh xạ sang field `type`, §0.2).
  - Kết quả **chỉ gồm `type ∈ {PERCENT, FIXED}`** — không bao giờ trả `FLASH_SALE`.
  - → `{ items: [{ id, code, type, value, maxDiscount, minOrderValue, applicableCategories: [categoryId…], applicableProductIds: [productId…], perUserLimit, startAt, endAt, totalUsageLimit, usedCount, active }], total, page, size }` (ngày giờ ISO-8601; `totalUsageLimit: 0` và `perUserLimit: null | 0` = không giới hạn — §9.1, §9.2).
- `GET /admin/vouchers/{id}` → 1 voucher đầy đủ như trên (cho form sửa).
- `POST /admin/vouchers` — body như item (trừ `id`, `usedCount`) → `201` voucher đã tạo · `409 { message }` trùng `code` · `422 { message, field? }` vi phạm validate §3 (`endAt ≤ startAt`, % ngoài 1–100, giới hạn < 1…).
- `PUT /admin/vouchers/{id}` — sửa → `200` · `409` trùng mã · `422` (đổi mã khi `usedCount > 0`; `totalUsageLimit < usedCount`; `endAt ≤ startAt`).
- `PATCH /admin/vouchers/{id}/active` — body `{ active }` → `200` voucher đã cập nhật.
- `DELETE /admin/vouchers/{id}` → `204` · `409 { message }` khi `usedCount > 0` hoặc đã có đơn tham chiếu mã (§4.2).
- Nguồn dữ liệu phụ cho form: danh mục → `GET /admin/categories` (màn 16); tìm sản phẩm → `GET /admin/products?q=` (màn 15).
- Hạ tầng: mọi endpoint dưới `/admin/**` → role ADMIN (§A.4); vite proxy đã có entry `/admin` từ màn 14 — code thật kiểm tra lại entry này trong `vite.config.js` trước khi kết luận lỗi backend (bài học /claims).

---

## §7. Traceability

| Mục spec | Nguồn |
|---|---|
| Trang `/admin/voucher`, CRUD voucher (mã, loại giảm, điều kiện, thời gian, giới hạn lượt) | FR-024 · F-018 |
| Ví dụ kiểm chứng `KHAITRUONG` 10% / trần 200.000đ / đơn từ 1.000.000đ / tháng 10 / 500 lượt | US-017 |
| Layout sidebar/topbar/guard ADMIN + trang 403 | admin-dashboard §A (§A.2, §A.3, §A.4) |
| DataTable: tìm kiếm debounce, lọc, sắp xếp, phân trang, skeleton/empty/error của bảng | admin-dashboard §B.1 |
| Form slide-over cho form dài, validate inline, confirm khi đóng form chưa lưu | admin-dashboard §B.2 |
| Confirm vô hiệu hóa/xóa (nêu đối tượng + hậu quả), toast kết quả, tải lại bảng sau thao tác | admin-dashboard §B.3 |
| Badge trạng thái dùng token `--success`/`--warning`/`--error`/`--text-muted` | admin-dashboard §B.4 · trang-chu §0 |
| Trạng thái suy ra từ `active` + `startAt`/`endAt` + lượt dùng (không lưu field trạng thái) | F-018 · `FlashSaleService.statusOf` (màn 13, cùng triết lý) · entity Voucher |
| `code` uppercase + unique; `endAt > startAt` validate FE + BE | F-018 |
| Đã có đơn dùng → chỉ tắt, không xóa; chưa dùng → xóa sau confirm | F-018 |
| Loại giảm PERCENT có trần `maxDiscount` / FIXED số tiền; đơn tối thiểu; mỗi đơn 1 voucher | FR-019 · F-007 rule 2 · entity Voucher (`type`, `value`, `maxDiscount`, `minOrderValue`) |
| Phạm vi toàn đơn / danh mục / sản phẩm | FR-019 ("danh mục áp dụng") · entity Voucher (`applicableCategories`, `applicableProductIds` — rỗng = mọi danh mục) |
| Hậu quả vô hiệu hóa phía khách: không áp được ở checkout, message từng case, đơn đã tạo không đổi | F-007 rule 2 · màn 7 (dat-hang §3) · `VoucherService.validate` |
| Voucher không áp cho dòng flash sale; không cộng dồn | F-022 · FR-019 · màn 7/13 |
| Ranh giới FLASH_SALE + `items[]` + phí ship thuộc màn 22 | FR-028, FR-029 · F-022, F-023 · `admin-flash-sale-phi-ship.md` |
| Mã `NOITHAT50 / NOITHAT10 / NOITHAT20` + mô tả phía khách trong dữ liệu mẫu | Màn 7 (dat-hang §3, §7) · `voucherApi.js` |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Quản lý voucher`, `Tạo voucher`, `Mã voucher`, `Loại giảm`, `Giảm tối đa`, `Đơn tối thiểu` (nhãn rút của "Giá trị đơn tối thiểu"), `Phạm vi áp dụng`, `Tổng giới hạn lượt`, `Giới hạn mỗi khách`, `Thời gian hiệu lực`, `Đang chạy`, `Sắp chạy`, `Hết lượt`, `Vô hiệu hóa`, `Bật lại`. (Thuật ngữ phía khách `Mã ưu đãi` đã chốt ở màn 7 — giữ nguyên, không đổi ở admin.)

---

## §9. Divergence & giả định (builder/code đọc kỹ — không tự suy diễn)

> Đánh số §9 giữ theo thông lệ các spec admin trước (mục divergence đặt cuối, sau traceability §7; không có §8).

### 9.1 `perUserLimit` — field CHƯA có trong ERD/code [Giả định theo brief]

Brief yêu cầu form có "giới hạn mỗi khách" nhưng 02-ERD và `Voucher.java` hiện hành **không có** field này, F-018/FR-024 cũng không nhắc. Xử lý trong spec: form có trường (§3.5) với nhãn [Giả định]; demo chạy bằng mock. Code thật muốn có hiệu lực phải: (1) thêm `perUserLimit` (Integer, `null`/0 = không giới hạn) vào entity Voucher + ERD; (2) `VoucherService.validate/apply` đếm số đơn của user hiện tại đã dùng mã (theo `Order.userId + voucherCode`, không tính đơn ĐÃ HỦY/HOÀN TRẢ) và từ chối khi đạt giới hạn với message `Bạn đã dùng mã này tối đa {n} lần.` — message này cũng là [Giả định], chưa có ở màn 7. Chưa làm 2 bước trên thì **không được** quảng cáo tính năng này cho admin là đã hoạt động.

### 9.2 Convention "không giới hạn" của `totalUsageLimit` đang lệch giữa hai service

Entity khai `totalUsageLimit` là `int` (không nullable). `FlashSaleService.statusOf` hiểu `0` = không giới hạn (chỉ xét khi `> 0`), nhưng `VoucherService.available/validate` hiện so trực tiếp `usedCount < totalUsageLimit` / `usedCount >= totalUsageLimit` — voucher có limit `0` sẽ bị coi là **hết lượt ngay**. Spec chốt convention hiển thị: `0` (hoặc `null` nếu sau này đổi kiểu) = `Không giới hạn`. **Code thật của màn này phải sửa `VoucherService` cho khớp convention đó** (bỏ qua kiểm tra lượt khi limit ≤ 0), nếu không mọi voucher "không giới hạn" tạo từ màn này sẽ không bao giờ áp được ở checkout.

### 9.3 Phạm vi áp dụng chưa được backend ép ở checkout

`VoucherService.validate` hiện hành chỉ kiểm tra `active`, hiệu lực, tổng lượt, `minOrderValue` — **chưa kiểm tra `applicableCategories`/`applicableProductIds`**, và discount tính trên toàn bộ subtotal dòng thường. Khi code thật làm màn này, cần bổ sung ở backend: voucher có phạm vi danh mục/sản phẩm thì chỉ các dòng thuộc phạm vi mới được tính vào cơ số đạt `minOrderValue` và cơ số tính discount [diễn giải FR-019 "danh mục áp dụng" — docs chưa định nghĩa chi tiết cơ số tính, ghi rõ để người duyệt quyết]. Trước khi bổ sung xong, admin chọn phạm vi ≠ Toàn đơn sẽ **không có tác dụng phía khách** — builder phải ghi chú điều này trong demo/PR, không để admin hiểu nhầm.

### 9.4 Entity Voucher không có `createdAt`

02-ERD/`Voucher.java` không có trường thời gian tạo → spec không dùng sắp xếp "mới nhất" và không hiển thị cột ngày tạo; mặc định sắp theo `endAt` tăng dần (§2.2). Nếu cần audit tạo/sửa, bổ sung `createdAt`/`updatedAt` vào entity ở vòng code thật [Đề xuất — ngoài docs].

### 9.5 Các điểm gắn nhãn trong spec

- `Tạo mã ngẫu nhiên` (§3.2), chips thời hạn (§3.5), khóa `code` khi đã có lượt dùng (§3.2): **[Đề xuất/Giả định của spec — chờ duyệt tại demo]**, không có trong FR-024/F-018.
- `Hết lượt` là trạng thái hiển thị suy ra thứ 5 ngoài 4 trạng thái brief nêu (Đang chạy/Sắp chạy/Hết hạn/Đã tắt) — suy trực tiếp từ case lỗi "hết lượt" đã có ở F-007 rule 2/màn 7, không phải tính năng mới.
