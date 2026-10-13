# Spec giao diện — Quản lý Banner (admin-banner)

- **Dự án:** noi-that-shop · **Màn:** Quản lý Banner (màn 21, wave 4 — admin)
- **Nguồn:** FR-027 · F-021 · F-001 (phía khách) · US-001 (phía khách) · Entity: Banner (`id, imageUrl, linkUrl, title, subtitle, ctaText, sortOrder, active`)
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** §0 của `trang-chu.md` + **layout admin §A** và **quy ước §B** của `admin-dashboard.md` — tuân thủ, spec này KHÔNG định nghĩa lại. Mọi xóa qua confirm §B.3, kết quả qua toast §B.3.
- **Ảnh hưởng phía khách hàng (builder phải biết):** banner ở màn này chính là khối hero trang chủ (`trang-chu.md` §2.4, component `HeroCarousel` đã có): chỉ lấy banner `active = true`, xếp theo `sortOrder` tăng dần, ảnh nền full khung tỉ lệ **21/8 desktop · 16/10 mobile**, bo `20px`, overlay gradient trái (đen 45% → trong suốt), khối chữ bên trái (tiêu đề 36px/800 trắng · mô tả phụ 16px trắng 85% · nút Primary chữ `ctaText` bấm theo `linkUrl`). Mọi trường trong form §4 phải khớp 1-1 cách khách nhìn thấy — không thêm trường hiển thị nào mà hero không dùng.
- **Về "thời gian hiển thị":** entity Banner trong ERD + model backend hiện tại **không có** `startAt`/`endAt` (chỉ có 8 trường liệt kê ở trên), FR-027 gốc cũng chỉ ghi "(ảnh, liên kết, thứ tự, bật/tắt)" → màn này **không có** trạng thái "Theo lịch" và **không có** trường thời gian trong form. Muốn hẹn giờ hiện banner phải bổ sung ERD/model trước — ghi ở §9, không tự chế ở spec này.
- **Không có user story admin riêng cho banner** trong docs (nhóm ADMIN chỉ có US-013→US-017, US-019) — spec trace chính về FR-027 + F-021; phía khách trace về F-001 + US-001. Không bịa US.

---

## §1. Bố cục trang `/admin/banner`

Theo khung §A: sidebar mục "Banner" active (mục 8) · topbar tiêu đề "Quản lý banner", breadcrumb `Quản trị / Banner`. Vùng nội dung 1 khối duy nhất:

1. **Thanh tiêu đề khối:** H1 "Banner trang chủ" 20px/700 + dòng đếm nhỏ `--text-muted`: "{Y} banner · {X} đang hiện" — bên phải: nút Text "Xem trang chủ ↗" (mở `/` tab mới, để đối chiếu hero thật) + nút Primary `+ Thêm banner` (mở form §4 ở chế độ thêm mới).
2. **Dải cảnh báo hệ quả (chỉ hiện khi có điều kiện):** khi `X = 0` (không banner nào đang bật — kể cả khi vẫn còn banner đã tắt): dải nền `#FDF3E0` viền `--warning`, icon ⚠ + chữ: "Hiện không có banner nào đang bật — trang chủ sẽ **không hiển thị khối banner** ở đầu trang." (đúng edge case F-001: không có banner → ẩn khối hero, trang chủ vẫn chạy bình thường với các khối dưới). Không hiện dải này khi `X ≥ 1`.
3. **Danh sách thẻ banner** (§2) — dạng thẻ, **không** dùng DataTable §B.1 (lý do ở §2.1).
4. Dưới danh sách, dòng chú thích nhỏ `--text-muted`: "Thứ tự và trạng thái bật/tắt ở đây áp dụng ngay cho khối banner đầu trang chủ. Kéo-thả hoặc dùng nút ↑ ↓ để đổi thứ tự."

Không có tìm kiếm / bộ lọc / phân trang trên màn này (số banner ít, thứ tự chỉ có nghĩa khi nhìn toàn bộ danh sách cùng lúc — lọc sẽ phá ngữ cảnh sắp xếp, cùng lý do màn Danh mục ẩn nút ↑↓ khi đang tìm kiếm).

---

## §2. Danh sách banner → FR-027, F-021

### 2.1 Dạng thẻ ngang có preview lớn (không phải bảng)

Banner là nội dung hình ảnh — admin phải **nhìn thấy ảnh** mới quản lý được, bảng chữ thuần §B.1 không đáp ứng được. Dùng danh sách thẻ dọc, mỗi thẻ là 1 card trắng (bo `16px`, viền `--border` theo §A.1), xếp theo `sortOrder` tăng dần, khoảng cách giữa các thẻ 16px. Thẻ gồm, từ trái sang phải:

| Thành phần | Nội dung |
|---|---|
| Tay kéo | Icon `⠿` 20px `--text-muted`, cursor grab — kéo-thả đổi thứ tự (§3). Kèm tooltip "Kéo để đổi thứ tự" |
| Preview ảnh | Khung tỉ lệ **21/8**, rộng 300px desktop (mobile: full chiều ngang thẻ, tỉ lệ 16/10 như hero mobile), bo `12px`, `object-fit: cover` — **cùng cách cắt ảnh phía khách**. Banner `active = false`: ảnh mờ `opacity .55` + lọc xám nhẹ. Ảnh lỗi tải → khung gradient `--bg → --border` + icon ảnh + chữ "Ảnh lỗi" |
| Số thứ tự | Badge tròn `--accent`: `#{vị trí}` (1..n theo vị trí hiện tại trong danh sách, không hiện số `sortOrder` thô khi đã lệch — sau mỗi thao tác backend chuẩn hoá về 1..n, §3) |
| Tiêu đề | `title` 16px/700, tối đa 2 dòng cắt `…` |
| Mô tả phụ | `subtitle` 13px `--text-muted`, 1 dòng cắt `…`; rỗng → hiện "—" |
| Dòng link đích | Chip chữ nút: nút Primary thu nhỏ hiển thị đúng `ctaText` (chỉ để nhìn, không bấm được) + `linkUrl` 13px mono `--brand-700` + icon mở ↗ (mở `linkUrl` tab mới để kiểm tra đích) |
| Trạng thái | Badge theo §B.4: `Đang hiện` (nền `#E8F5E9`, chữ `--success`) khi `active = true` · `Đã tắt` (nền xám, chữ `--text-muted`) khi `active = false`. Chỉ có 2 trạng thái này (không có "Theo lịch" — xem ghi chú đầu spec) |
| Bật / tắt nhanh | Toggle switch `active` ngay trên thẻ (nhãn trợ năng "Đang hiện / Đã tắt") — §6.1 |
| Hành động | Cụm phải, icon kèm tooltip (§B.1): `↑` `↓` (§3) · `Sửa` (mở form §4) · `Xóa` (§6.2) |

- Click vào preview hoặc tiêu đề (trừ các nút/toggle) → mở form Sửa.
- **Responsive:** <768px thẻ chuyển dọc: tay kéo + hàng hành động lên đầu thẻ, preview full-width tỉ lệ 16/10, thông tin xếp dưới.

### 2.2 Dữ liệu mẫu demo (khớp `mockBanners` hiện có trong `frontend/src/mocks/homeMock.js`)

| # | Ảnh | Tiêu đề | Mô tả phụ | Nút / Link đích | Trạng thái |
|---|---|---|---|---|---|
| 1 | `hero-living.jpg` | Khai trương — Giảm đến 20% sofa phòng khách | Từ 12/10 đến 31/10 · Áp dụng cho 50+ mẫu sofa | `Mua ngay` → `/danh-muc/sofa` | Đang hiện |
| 2 | `bed-walnut.jpg` | Bộ sưu tập Gỗ Óc Chó 2026 | Vân gỗ tự nhiên · Bảo hành 5 năm | `Khám phá` → `/danh-muc/tu-quan-ao` | Đang hiện |
| 3 | `sofa-2.jpg` | Flash sale cuối tuần | Giảm sâu giờ vàng 20h – 22h mỗi tối | `Săn ngay` → `/flash-sale` | Đang hiện |
| 4 | `bedroom-2.png` | Nội thất phòng ngủ — Ưu đãi tháng 10 | Trọn bộ giường + tủ đồng bộ gỗ tự nhiên | `Xem ngay` → `/danh-muc/giuong-ngu` | **Đã tắt** |

(Dòng 1–3 lấy nguyên văn mock hiện có — cũng là 3 banner mẫu ở `trang-chu.md` §2.4. Dòng 4 là **[bổ sung cho demo]** để thể hiện trạng thái Đã tắt + kéo-thả qua banner tắt; khi code thật, seed có hoặc không đều được.)

---

## §3. Đổi thứ tự hiển thị → F-021 (`sortOrder`)

F-021 chốt "kéo-thả sắp xếp `sortOrder`" — spec giữ kéo-thả làm cách chính, cộng nút ↑↓ làm đường thay thế (bàn phím / mobile / trợ năng), đúng pattern đã chốt ở màn Danh mục (§4 của `admin-danh-muc.md`):

- **Kéo-thả:** nắm tay kéo `⠿` (chỉ tay kéo mới kéo được, tránh kéo nhầm khi cuộn/bấm) → thẻ được kéo nhấc nhẹ (shadow §0.4) + vạch chèn `--accent` 2px ở vị trí đích. Thả → gọi `PUT /admin/banners/reorder` với **toàn bộ danh sách `ids` theo thứ tự mới**; backend gán lại `sortOrder` = dãy liên tục **1..n**. Cập nhật lạc quan (thẻ ở ngay vị trí mới); lỗi API → khôi phục thứ tự cũ + toast đỏ "Không đổi được thứ tự. Thử lại."
- **Nút ↑ / ↓:** hoán đổi với banner kề trên / kề dưới, đi qua cùng endpoint reorder (gửi danh sách id sau hoán đổi). Nút ở biên (đầu/cuối danh sách) disabled mờ. Thao tác thành công **không toast** (kết quả thấy ngay — như màn Danh mục).
- Banner **đã tắt vẫn giữ nguyên vị trí** trong danh sách admin và tham gia sắp xếp bình thường — `sortOrder` là thứ tự của toàn bộ danh sách; phía khách chỉ lọc bỏ banner tắt rồi hiện các banner còn lại theo thứ tự này (F-021: "chỉ banner `active` mới hiện").
- Đang có thao tác reorder chưa xong → khóa tay kéo + nút ↑↓ (tránh 2 lần sắp xếp chồng nhau).

---

## §4. Form thêm / sửa — slide-over → FR-027, F-021

### 4.1 Hình thức: slide-over (không phải modal) — lý do ghi rõ

- **Chọn slide-over trượt từ phải, rộng 560px, mobile full-screen** theo §B.2. §B.2 vốn liệt kê banner vào nhóm "form ngắn → modal 520px", nhưng form banner thực tế có **7 trường + bộ chọn ảnh 2 tab + khối xem trước hero trực tiếp (§5)** — khối xem trước cần chiều ngang để tái hiện khung 21/8 và phải cập nhật theo từng ký tự gõ; modal 520px sẽ bóp preview còn quá nhỏ để判断 chữ có tràn ảnh hay không. Đây là cùng tiền lệ màn Voucher (`admin-voucher.md` §3.1): khi form có khối xem trước thì thuộc nhóm form dài → slide-over.
- Tiêu đề: `Thêm banner` / `Sửa banner` (+ tiêu đề banner nhỏ ở chế độ sửa). Footer sticky: `Hủy` (Secondary) + `Lưu banner` (Primary). Đóng khi đã sửa chưa lưu → confirm theo §B.2. Khi đang lưu: nút loading + khóa form (§B.2).
- Trường bắt buộc có dấu `*`; validate inline khi rời trường (§B.2).

### 4.2 Các trường (khớp 1-1 entity Banner + cách hero hiển thị)

| Trường | Kiểu | Validate / ghi chú |
|---|---|---|
| Ảnh banner * | Bộ chọn ảnh (§4.3) | Bắt buộc (`imageUrl`). Khuyến nghị **2100 × 800px** (đúng tỉ lệ 21/8), tối thiểu 1680 × 640px **[Đề xuất kích thước — docs không ghi]**. Dưới ô chọn hiện dòng nhắc: "Ảnh hiển thị ở khung 21:8 trên máy tính và 16:10 trên điện thoại, hệ thống tự cắt giữa ảnh — hãy để nội dung quan trọng ở vùng giữa." |
| Tiêu đề * | text | Bắt buộc, tối đa 80 ký tự **[Giả định — docs không ghi giới hạn]** + bộ đếm ký tự. Đây là dòng chữ lớn 36px trên hero — dài quá sẽ tràn khung, bộ đếm + preview §5 là lưới an toàn |
| Mô tả phụ | text | Không bắt buộc, tối đa 120 ký tự **[Giả định]** + bộ đếm. Dòng nhỏ dưới tiêu đề trên hero |
| Chữ trên nút | text | Không bắt buộc, tối đa 20 ký tự **[Giả định]**; để trống → hero dùng mặc định `Mua ngay` **[Giả định — hero luôn cần chữ nút]**. VD: `Mua ngay`, `Khám phá`, `Săn ngay` |
| Link đích * | Chọn nhanh + ô nhập (§4.4) | Bắt buộc (`linkUrl`) — nơi khách tới khi bấm nút trên hero |
| Thứ tự hiển thị | số nguyên | `≥ 1`. Thêm mới: gợi ý sẵn = vị trí cuối danh sách (số banner hiện có + 1). Nhập số nhỏ hơn vị trí hiện tại của banner khác → banner được **chèn** vào vị trí đó, các banner sau dịch xuống 1 bậc; sau khi lưu backend chuẩn hoá lại toàn bộ thành 1..n (cùng cơ chế §3). Chú thích dưới trường: "Số nhỏ hiện trước trên trang chủ. Cũng có thể kéo-thả trực tiếp ở danh sách." |
| Đang hiện | toggle | Nhãn "Đang hiện trên trang chủ" + chú thích "Tắt = banner không xuất hiện ở trang chủ nhưng vẫn giữ trong danh sách này để bật lại sau." (`active`). Thêm mới: mặc định BẬT |
| Thời gian hiển thị | — | **Không có trường này** — ERD/model Banner không có `startAt`/`endAt` (xem ghi chú đầu spec + §9). Không dựng trường giả |

### 4.3 Bộ chọn ảnh (1 ảnh duy nhất — `imageUrl`)

Cùng bộ chọn ảnh của màn Danh mục (`admin-danh-muc.md` §3.1), chỉ khác khung preview:

- Ô preview theo đúng tỉ lệ hero **21/8**, bo `12px`: có ảnh → hiện ảnh + 2 nút `Đổi ảnh` / `Xóa ảnh`; chưa có → vùng đứt nét "Chưa có ảnh — bấm để chọn ảnh".
- `Đổi ảnh` / bấm vào ô → panel 2 tab:
  - Tab **Tải ảnh lên**: kéo-thả file hoặc bấm chọn file. JPG/PNG/WebP, ≤ 5MB/ảnh (nhất quán màn 15/16) — file sai → toast đỏ nêu tên file + lý do. Đang tải: spinner trên preview → xong thì thay ảnh + đóng panel.
  - Tab **Thư viện có sẵn**: lưới 4 cột các ảnh nội thất đã có trong hệ thống (bộ ảnh mock hiện có: phòng khách, phòng ngủ, sofa…) — bấm 1 ảnh là chọn xong, đóng panel.
- Ảnh chỉ được gắn khi bấm `Lưu banner` (upload trả về `url` trước qua `POST /admin/banners/images`, lưu cùng form — cùng pattern màn 16).

### 4.4 Link đích — chọn nhanh + tự nhập

Ô `Link đích` gồm 1 hàng chip chọn nhanh phía trên + ô nhập phía dưới; chọn nhanh chỉ **điền sẵn** vào ô nhập, admin vẫn sửa tay được:

| Chip chọn nhanh | Hành vi |
|---|---|
| `Trang chủ` | Điền `/` |
| `Flash sale` | Điền `/flash-sale` |
| `Danh mục…` | Mở select danh sách danh mục (từ `GET /admin/categories` của màn 16, chỉ danh mục gốc đang hiển thị) → điền `/danh-muc/{slug}` |
| `Sản phẩm…` | Mở ô tìm sản phẩm (gõ tên, debounce 300ms, từ `GET /admin/products` của màn 15) → chọn 1 kết quả → điền `/san-pham/{slug}` |
| `Tự nhập` | Không điền gì, focus vào ô nhập |

- Validate ô nhập: bắt buộc; phải bắt đầu bằng `/` (link nội bộ) **hoặc** là URL đầy đủ `http://` / `https://` — sai → lỗi tại trường: "Link đích phải bắt đầu bằng / (trang trong cửa hàng) hoặc là địa chỉ web đầy đủ bắt đầu bằng http." Dưới ô nhập hiện preview dạng chữ: "Khách bấm nút trên banner sẽ tới: {linkUrl}".
- Không kiểm tra link có tồn tại hay không ở phía form (slug có thể thuộc nội dung sắp tạo) — admin tự kiểm bằng nút mở ↗ ở thẻ (§2.1).

### 4.5 Lưu & lỗi

- Bấm `Lưu banner`: validate toàn form — trường lỗi đầu tiên được focus; nút chuyển loading + khóa form (§B.2).
- Lỗi API: `400/422` kèm `field` → gắn lỗi tại trường đó; lỗi khác → toast đỏ message cụ thể từ API (§B.3), không message chung chung.
- Lưu thành công: đóng slide-over + toast xanh "Đã lưu banner." (§B.3) + danh sách tải lại đúng thứ tự mới; thêm mới → thẻ mới xuất hiện ở đúng vị trí đã chọn.

---

## §5. Xem trước như khách thấy (preview hero) → F-001, trang-chu §2.4

- Nằm ở **cuối form §4**, tiêu đề nhỏ "Xem trước trên trang chủ" + 2 nút chuyển khung: `Máy tính` | `Điện thoại`.
- Khung xem trước tái dùng đúng style hero thật (`.hero` / `HeroCarousel` hiện có): ảnh nền full + overlay gradient trái đen 45% + khối chữ trái gồm **tiêu đề** (cỡ chữ thu theo tỉ lệ khung: khung máy tính rộng ~528px → tiêu đề ≈ 20px/800), **mô tả phụ**, **nút Primary** với đúng `ctaText` (trống → hiện `Mua ngay` theo §4.2) — bấm nút trong preview **không điều hướng** (chỉ để nhìn).
- Khung `Máy tính`: tỉ lệ **21/8**. Khung `Điện thoại`: tỉ lệ **16/10** — để admin kiểm tra ảnh bị cắt dọc nhiều hơn và chữ có tràn ở màn nhỏ không.
- Cập nhật **trực tiếp** theo từng thay đổi ở §4.2/§4.3 (ảnh, tiêu đề, mô tả phụ, chữ nút) — chưa có ảnh → khung hiện vùng đứt nét + chữ "Chọn ảnh để xem trước"; tiêu đề trống → hiện chữ mờ mẫu "Tiêu đề banner" để admin thấy vị trí chữ.
- Mục đích duy nhất: duyệt WYSIWYG trước khi lưu. Sau khi lưu, đối chiếu thật bằng nút "Xem trang chủ ↗" ở §1.

---

## §6. Bật / tắt và Xóa — phân biệt rõ → FR-027, §B.3

### 6.1 Tắt banner (active = false) ≠ Xóa

| | Tắt (`Đã tắt`) | Xóa |
|---|---|---|
| Dữ liệu | Giữ nguyên toàn bộ (ảnh, chữ, link, thứ tự) | Mất hẳn, không khôi phục được |
| Phía khách | Không hiện trên trang chủ | Không hiện trên trang chủ |
| Bật lại | 1 thao tác toggle | Phải tạo lại từ đầu |
| Khi nào dùng | Ẩn tạm (hết đợt khuyến mãi, chờ duyệt nội dung…) | Banner sai hẳn / không bao giờ dùng lại |

- Toggle trên thẻ (§2.1) hoặc trong form: bấm → gọi `PATCH /admin/banners/{id}` `{ active }` ngay (không cần mở form), cập nhật lạc quan; lỗi → toggle trở lại vị trí cũ + toast đỏ "Không đổi được trạng thái banner. Thử lại." Thành công: **không toast** khi bật/tắt từ thẻ (thấy ngay bằng badge + ảnh mờ/sáng — thao tác nhẹ như ↑↓ §3); tắt/bật qua form thì đi cùng toast lưu của form.
- Tắt banner cuối cùng đang hiện → dải cảnh báo §1.2 xuất hiện ngay (hệ quả hero trống phải thấy ngay, không để admin tắt xong mới biết).

### 6.2 Xóa banner

- Banner **không gắn với đơn hàng / sản phẩm** (không entity nào tham chiếu Banner — ERD §2) → **xóa cứng được**, không cần cơ chế chặn xóa hay "chỉ được tắt" như voucher/sản phẩm/danh mục.
- Confirm dialog §B.3: tiêu đề "Xóa banner?", nội dung: "Bạn sắp xóa banner **{title}** (thứ tự #{vị trí}). Thao tác này không thể hoàn tác." + dòng nhắc phân biệt: "Nếu chỉ muốn ẩn tạm khỏi trang chủ, hãy Hủy và tắt banner thay vì xóa." Nút nguy hiểm nền `--error`: `Xóa` · nút `Hủy` Secondary.
- Banner chưa có `title` (dữ liệu cũ) → nội dung confirm thay bằng "banner ở thứ tự #{vị trí}" để vẫn xác định được đối tượng.
- Xóa xong: toast xanh "Đã xóa banner." + danh sách tải lại; backend chuẩn hoá `sortOrder` của các banner còn lại thành 1..n. Nếu banner vừa xóa là banner đang hiện cuối cùng → dải cảnh báo §1.2 hiện ra kèm theo.

---

## §7. Trạng thái của trang & form

- **Danh sách loading:** 3 thẻ skeleton (khung preview 21/8 xám nhấp nháy + 2 dòng chữ xám) — theo tinh thần §B.1.
- **Danh sách lỗi:** card trống: icon ⚠ + "Không tải được danh sách banner." + nút Secondary "Thử lại" (chỉ tải lại danh sách).
- **Danh sách rỗng — chưa có banner nào (tổng = 0):** icon ảnh + chữ **"Chưa có banner nào"** + dòng giải thích hệ quả: "Trang chủ hiện không hiển thị khối banner ở đầu trang (các khối sản phẩm bên dưới vẫn hiển thị bình thường)." + nút Primary `+ Thêm banner` ngay trong vùng trống. (Đây là trạng thái hợp lệ theo F-001 — không phải lỗi.)
- **Có banner nhưng tất cả đã tắt:** vẫn hiện danh sách bình thường + dải cảnh báo §1.2 — **không** dùng empty state (dữ liệu vẫn còn, chỉ đang ẩn phía khách).
- **Form loading (chế độ Sửa):** mở slide-over ngay với skeleton các trường trong lúc tải chi tiết; lỗi tải chi tiết → nội dung slide-over hiện "Không tải được thông tin banner." + "Thử lại", không mở form trống.
- **Đang reorder / đang đổi toggle:** xem §3, §6.1 (khóa điều khiển liên quan, lỗi thì khôi phục + toast).
- **Guard:** theo §A.4 (chưa login → `/dang-nhap?returnTo=/admin/banner`; không phải ADMIN → trang 403).

---

## §8. Contract backend (builder/code dùng mock khớp shape này)

- `GET /admin/banners` → **toàn bộ** banner (cả đã tắt), sắp `sortOrder` tăng dần: `[{ id, imageUrl, linkUrl, title, subtitle, ctaText, sortOrder, active }]`
- `GET /admin/banners/{id}` → 1 banner cùng shape (nạp vào form §4)
- `POST /admin/banners` — body như GET detail (bỏ `id`) → `201` banner đã tạo (`sortOrder` đã chuẩn hoá trong dãy 1..n) · `400 { field, message }` khi validate lỗi (thiếu `imageUrl`/`linkUrl`, `linkUrl` sai định dạng §4.4)
- `PUT /admin/banners/{id}` — cùng body → `200` · `400` như POST · `404` khi không tồn tại
- `PATCH /admin/banners/{id}` — `{ active }` → `200` (toggle nhanh §6.1)
- `PUT /admin/banners/reorder` — `{ ids: [...] }` (toàn bộ id theo thứ tự mới) → `200` trả danh sách sau chuẩn hoá `[{ id, sortOrder }]` (dãy 1..n)
- `DELETE /admin/banners/{id}` → `204` (sau xóa backend chuẩn hoá lại `sortOrder` các banner còn lại)
- `POST /admin/banners/images` — multipart 1 file → `{ url }` (≤5MB; JPG/PNG/WebP) — pattern upload dùng chung với màn 15/16 (backend đã có `AdminCategoryController.uploadImage` tương tự)
- **Phía khách (đã có sẵn, không sửa):** `GET /banners?active=true` (`HomeController`) chỉ trả banner `active = true` theo `sortOrder` — endpoint public trong `SecurityConfig`; FE trang chủ đã dùng từ màn 1.
- Mọi endpoint `/admin/**`: 401 chưa đăng nhập, 403 khi role != ADMIN (§A.4). Vite proxy đã có sẵn entry `/admin` và `/banners` (kiểm chứng trong `frontend/vite.config.js` — bài học /claims: màn code thật vẫn rà lại file trước khi chạy).

---

## §9. Traceability

| Mục spec | Nguồn |
|---|---|
| Route `/admin/banner`, khung sidebar/topbar, guard ADMIN | admin-dashboard §A · FR-027 |
| CRUD banner: ảnh, tiêu đề, mô tả phụ, chữ nút, link, thứ tự, bật/tắt | FR-027 · ERD BANNER (title/subtitle/ctaText bổ sung 2026-10-10) · model `Banner.java` hiện có |
| Danh sách dạng thẻ có preview tỉ lệ hero thay cho DataTable | FR-027 + tính chất hình ảnh của banner — **[Quyết định của spec]**, trạng thái vẫn theo §B.1 |
| Hero phía khách: 21/8 desktop · 16/10 mobile, overlay trái, chữ trái, CTA theo `linkUrl`/`ctaText` | trang-chu §2.4 · `HeroCarousel` + CSS `.hero` hiện có · F-001 |
| Chỉ banner `active = true` hiện phía khách, xếp theo `sortOrder` | F-021 · F-001 · `BannerRepository.findByActiveTrueOrderBySortOrderAsc` hiện có |
| Kéo-thả sắp xếp + API reorder gửi toàn bộ ids, chuẩn hoá 1..n | F-021 ("kéo-thả sắp xếp sortOrder") |
| Nút ↑↓ dự phòng + không toast khi đổi thứ tự thành công | Pattern màn Danh mục (admin-danh-muc §4) |
| Banner đã tắt vẫn giữ vị trí trong danh sách admin | F-021 (chỉ lọc khi hiển thị phía khách) |
| Không banner đang bật → trang chủ ẩn khối hero, không vỡ layout; dải cảnh báo + empty state nêu rõ hệ quả này | F-001 edge case ("chưa có banner → ẩn khối banner") |
| Xóa cứng qua confirm §B.3 nêu tiêu đề banner; phân biệt tắt (ẩn, khôi phục được) với xóa | §B.3 · ERD §2 (không entity nào tham chiếu Banner) · FR-027 (bật/tắt) |
| Form slide-over cho form có khối xem trước; validate inline; confirm đóng form chưa lưu | admin-dashboard §B.2 · tiền lệ admin-voucher §3.1 |
| Bộ chọn ảnh upload ≤5MB / thư viện có sẵn; ảnh gắn khi lưu form | Pattern màn 16 (admin-danh-muc §3.1) · màn 15 |
| Chọn nhanh link đích: danh mục / flash sale / sản phẩm / tự nhập | `linkUrl` trong mock hero hiện có (`/danh-muc/{slug}`, `/flash-sale`, `/san-pham/{slug}` — trang-chu §2.4, homeMock) |
| Endpoint public `GET /banners` đã có; endpoint admin mới dưới `/admin/banners` | `HomeController` + `SecurityConfig` hiện có · §A.4 |
| Text tiếng Việt, không lộ mã nội bộ phía khách hàng | copy-ux-linter · §0.3 trang-chu |

**Ghi chú lệch / thiếu trong tài liệu (builder/parent cần biết):**
1. **Không có thời gian hiển thị:** brief màn này nhắc "thời gian hiển thị nếu ERD có" — ERD **không có** (`Banner` chỉ 8 trường, model backend khớp ERD). Spec không dựng trường `startAt`/`endAt` và không có trạng thái "Theo lịch". Nếu chủ dự án muốn hẹn giờ: bổ sung 2 trường vào ERD + model + điều kiện lọc ở `GET /banners` trước, spec sẽ cập nhật sau.
2. **FR-027 gốc ngắn hơn thực tế đã triển khai:** SRE chỉ ghi "(ảnh, liên kết, thứ tự, bật/tắt)" — `title`/`subtitle`/`ctaText` đến từ ERD (bổ sung 2026-10-10 khi implement hero) và đã có trong mock + `HeroCarousel`. Spec theo ERD/code hiện có.
3. **Không có user story cho quản lý banner** — acceptance suy trực tiếp từ business rules của F-021 + F-001, không tự chế US.
4. **§B.2 vs lựa chọn slide-over:** §B.2 liệt kê banner vào nhóm form ngắn (modal), spec chọn slide-over vì khối xem trước hero — cùng tiền lệ đã được áp ở màn Voucher. Nếu parent muốn giữ đúng §B.2 tuyệt đối thì đổi §4.1 thành modal 720px và giữ nguyên mọi nội dung còn lại.
5. **Giới hạn ký tự** (tiêu đề 80 · mô tả phụ 120 · chữ nút 20), **kích thước ảnh khuyến nghị** (2100×800) và **CTA mặc định "Mua ngay" khi để trống** đều là **[Giả định của spec]** — docs không ghi; chọn theo giới hạn hiển thị thật của hero (tràn khung là lỗi nhìn thấy được).

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Quản lý banner`, `Banner trang chủ`, `Thêm banner`, `Lưu banner`, `Đang hiện`, `Đã tắt`, `Xem trước trên trang chủ`, `Kéo để đổi thứ tự`, `Link đích`, `Chữ trên nút`, `Thứ tự hiển thị`, `Thư viện có sẵn`, `Chưa có banner nào`.
