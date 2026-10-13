# Spec giao diện — Quản lý Tồn kho (admin-ton-kho)

- **Dự án:** noi-that-shop · **Màn:** Quản lý Tồn kho (màn 18, wave 4 — admin)
- **Nguồn:** FR-023 · F-017 · US-015 · Entity: ProductVariant (`sku`, `color`, `colorHex`, `price`, `stock`, `lowStockThreshold`)
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** §0 của `trang-chu.md` + **layout admin §A** và **quy ước §B (DataTable / modal / confirm / toast / badge)** của `admin-dashboard.md` — tuân thủ nguyên xi, spec này KHÔNG định nghĩa lại. Màn này là bản đầy đủ của khối cảnh báo tồn kho ở Dashboard §8: cùng điều kiện `stock ≤ lowStockThreshold` (mặc định ngưỡng **5** — F-017), cùng dữ liệu `GET /admin/inventory/low-stock` / `LowStockItemDto`, không định nghĩa lại DTO đó.
- **Đơn vị dữ liệu:** 1 dòng = **1 biến thể màu** của 1 sản phẩm (tồn kho theo dõi đến cấp màu — QĐ 2026-10-10, FR-023). Màn này KHÔNG tạo biến thể mới (tạo ở màn 15 QL Sản phẩm) nên không có nút `+ Thêm mới`.

---

## §1. Bố cục trang `/admin/ton-kho`

Theo khung §A: sidebar mục "Tồn kho" active (badge số variant sắp hết trên menu — §A.2) · topbar tiêu đề "Quản lý tồn kho", breadcrumb `Quản trị / Tồn kho`. Vùng nội dung từ trên xuống:

1. **Hàng thẻ tổng quan** — 3 thẻ nhỏ (card trắng §A.1): `Sắp hết` · `Hết hàng` · `Tổng số biến thể` (§2.2). Click thẻ → áp chip lọc tương ứng ở bảng §3.
2. **Card DataTable** (§B.1): thanh công cụ (chips trạng thái + tìm kiếm + lọc danh mục) → bảng biến thể → phân trang.

Không có khối nào khác trên trang.

---

## §2. Trạng thái tồn & thẻ tổng quan → FR-023, F-017, US-015

### 2.1 Định nghĩa trạng thái (tính từ `stock` + `lowStockThreshold` của từng variant)

| Trạng thái | Điều kiện | Badge (§B.4) |
|---|---|---|
| Hết hàng | `stock = 0` | `Hết hàng` — nền `--error`, chữ trắng |
| Sắp hết | `0 < stock ≤ lowStockThreshold` | `Sắp hết` — nền `#FDF3E0`, chữ `--warning` |
| Còn hàng | `stock > lowStockThreshold` | `Còn hàng` — nền `#E8F5E9`, chữ `--success` |

- **Quy ước đếm (khớp Dashboard, tránh lệch số):** nhóm "sắp hết" dùng cho KPI Dashboard §2, badge menu sidebar §A.2 và chip lọc §3.1 là `stock ≤ lowStockThreshold` — **bao gồm cả hết hàng** (số demo = 4, trong đó 1 hết hàng). Badge từng dòng thì tách 3 trạng thái như bảng trên: dòng `stock = 0` hiện `Hết hàng`, không hiện `Sắp hết`.

### 2.2 Thẻ tổng quan

| Thẻ | Số liệu | Click |
|---|---|---|
| Sắp hết | Số variant `stock ≤ lowStockThreshold` (khớp KPI Dashboard + `lowStockCount`) | Áp chip `Sắp hết` |
| Hết hàng | Số variant `stock = 0` | Áp chip `Hết hàng` |
| Tổng số biến thể | Tổng variant của mọi sản phẩm (kể cả của sản phẩm ngừng bán) | Áp chip `Tất cả` |

- Số trên thẻ lấy từ `counts` của API §9 (cùng nguồn với chip) — không tính 2 nơi khác nhau.
- Dữ liệu demo: Sắp hết **4** · Hết hàng **1** (khớp Dashboard §8) · Tổng số biến thể = `totalElements` của chip `Tất cả`.

---

## §3. DataTable biến thể → FR-023, F-017, US-015

### 3.1 Thanh công cụ

- **Chips trạng thái tồn** (hàng chip trên thanh công cụ, mỗi chip kèm số đếm trong ngoặc):
  - `Tất cả (N)` — mọi variant.
  - `Sắp hết (N)` — `stock ≤ lowStockThreshold` (gồm hết hàng, theo §2.1); chip có chấm `--warning`.
  - `Hết hàng (N)` — `stock = 0`; chip có chấm `--error`.
  - Chọn chip → về trang 1, tải lại bảng, đồng bộ query `?trang-thai=` (§4).
- **Ô tìm kiếm** (debounce 300ms, §B.1): placeholder `Tìm theo tên sản phẩm, màu, SKU…` — khớp `productName`, `color` hoặc `sku` (admin được tìm/thấy SKU — US-015).
- **Lọc Danh mục**: select `Tất cả danh mục` + danh sách danh mục (danh mục con thụt lề 1 cấp — FR-021; nguồn `GET /admin/categories` màn 16).
- Đổi tìm kiếm/lọc → về trang 1, tải lại bảng (§B.1).

### 3.2 Cột bảng (header theo §B.1: 13px/700 uppercase `--text-muted`)

| Cột | Nội dung | Sắp xếp |
|---|---|---|
| Sản phẩm | Ảnh 48px bo 8px + tên sản phẩm 600 (1 dòng cắt `…`) + dưới tên: chấm màu (`colorHex`) + tên màu 13px · cạnh tên có badge nhỏ `Ngừng bán` (`--text-muted`) nếu sản phẩm `active = false` — variant vẫn quản lý kho được | Tên A–Z / Z–A |
| SKU | Mono, 13px, copy được khi click (icon copy + toast "Đã sao chép SKU.") | — |
| Giá bán | `price` của variant, `vi-VN` + `đ`, căn phải | Tăng / giảm |
| Tồn hiện tại | Số nguyên căn phải, 15px/600. `= 0` → chữ `--error`; `≤ ngưỡng` → chữ `--warning` | **Mặc định: tăng dần** (khẩn cấp nhất lên đầu — nhất quán Dashboard §8); đổi được giảm dần. Hòa (cùng tồn) → tên sản phẩm A–Z |
| Ngưỡng cảnh báo | Số nguyên + icon bút chì (tooltip "Sửa ngưỡng") — sửa inline tại ô (§6) | — |
| Trạng thái | Badge theo §2.1 | — |
| Hành động | Nút chữ Primary nhỏ `Điều chỉnh tồn` (mở modal §5) · icon `↗ Sửa ở Sản phẩm` kèm tooltip (điều hướng §7) | — |

- **Phân trang** (§B.1): `Trang X / Y · Tổng N biến thể`, chọn 10 / 20 / 50 mục/trang.
- Mobile: bảng cuộn ngang trong card; cột Sản phẩm tối thiểu 220px.

### 3.3 Dữ liệu mẫu demo (builder dùng đúng số này)

4 dòng đầu = đúng 4 variant cảnh báo của Dashboard §8 (SKU/giá/tồn khớp mock `adminApi.js` + mock đơn hàng); 3 dòng sau là biến thể đủ tồn để demo chip `Tất cả` **[dữ liệu demo bổ sung]**:

| Sản phẩm — Màu | SKU | Giá bán | Tồn | Ngưỡng | Trạng thái |
|---|---|---|---|---|---|
| Bàn trà gỗ sồi — Nâu óc chó | `BT-GS-NAU` | 3.650.000đ | 0 | 5 | Hết hàng |
| Sofa góc L Nordic — Be | `SF-NOR-BE` | 12.900.000đ | 2 | 5 | Sắp hết |
| Ghế ăn bọc vải — Đen | `GA-BV-DEN` | 1.450.000đ | 3 | 5 | Sắp hết *(đúng ví dụ US-015)* |
| Đèn bàn gốm — Trắng | `DB-GOM-TRANG` | 890.000đ | 4 | 5 | Sắp hết |
| Ghế ăn bọc vải — Be | `GA-BV-BE` | 1.450.000đ | 9 | 5 | Còn hàng |
| Sofa góc L Nordic — Xám | `SF-NOR-XAM` | 12.900.000đ | 14 | 5 | Còn hàng |
| Bàn trà gỗ sồi — Tự nhiên | `BT-GS-TN` | 3.450.000đ | 21 | 5 | Còn hàng |

Danh mục của các dòng trên: Bàn trà gỗ sồi + Sofa góc L Nordic → `Sofa` · Ghế ăn bọc vải → `Ghế` · Đèn bàn gốm → `Đèn & Decor` (khớp mock danh mục hiện có).

---

## §4. Đọc query param khi vào trang (từ Dashboard) → admin-dashboard §2, §8

Theo pattern `?trang-thai=` của màn 17 (slug không dấu, giá trị lạ → bỏ qua, đồng bộ URL bằng history.replace khi admin đổi lọc):

| Query | Hiệu ứng khi mở trang |
|---|---|
| `?trang-thai=sap-het` | Chip `Sắp hết` active — dùng cho KPI "Tồn kho sắp hết" (§2 Dashboard), link "Xem tất cả →" của khối §8 và badge Tồn kho trên sidebar |
| `?trang-thai=het-hang` | Chip `Hết hàng` active |
| `?sku=GA-BV-DEN` | Ô tìm kiếm điền sẵn SKU đó + chip `Tất cả` → bảng lọc đúng 1 variant; dòng đó được **highlight** (nền `#FBF3DC` trong 2 giây rồi mờ dần). Dùng cho click từng dòng ở khối cảnh báo Dashboard §8 ("lọc đúng variant đó") |
| `?q=…` | Ô tìm kiếm điền sẵn từ khóa (dự phòng chung) |

- **[Ghi chú cho khâu code]** Code Dashboard hiện tại đang điều hướng `/admin/ton-kho` **trần** ở cả 3 điểm (KPI, "Xem tất cả", click dòng khối §8). Khi code màn 18, cập nhật 3 điểm đó gắn param theo bảng trên (việc nhỏ, nằm trong cùng đợt code).

---

## §5. Điều chỉnh tồn kho → FR-023, F-017 (+ FR-011 liên quan)

### 5.1 Cách mở & hình thức

- Nút `Điều chỉnh tồn` ở cột Hành động (hoặc menu của dòng) → **modal nhỏ 520px** theo §B.2. Không sửa trực tiếp trên ô bảng: điều chỉnh tồn bắt buộc kèm lý do (§5.3) và cần xem trước số sau điều chỉnh — inline trên bảng không chứa được 2 việc đó. (Ô `Ngưỡng cảnh báo` thì sửa inline được vì không cần lý do — §6.)
- Không tách nút `Nhập kho` riêng: chỉ 1 nút `Điều chỉnh tồn` duy nhất, chế độ nhập/xuất/đặt số mới chọn bên trong modal. Builder không dựng 2 nút.

### 5.2 Nội dung modal

- Tiêu đề: `Điều chỉnh tồn kho`. Đầu modal: ảnh 40px + tên sản phẩm — màu (600) + SKU 12px `--text-muted`.
- Dòng số hiện tại: `Tồn hiện tại: {stock}` (số lớn 20px/700) + badge trạng thái hiện tại (§2.1).
- **Chế độ điều chỉnh** — segmented control 3 lựa chọn:
  1. `Nhập thêm` — ô `Số lượng nhập *`: số nguyên `> 0`. Xem trước: `{stock} + {qty} = {kết quả}`.
  2. `Xuất / giảm` — ô `Số lượng giảm *`: số nguyên `> 0` và `≤ stock hiện tại` (chặn âm kho). Xem trước: `{stock} − {qty} = {kết quả}`.
  3. `Đặt số mới` (kiểm kê) — ô `Tồn thực tế *`: số nguyên `≥ 0`. Xem trước kèm chênh lệch: `Chênh lệch: +5` / `−2` / `0 — không thay đổi` (chênh lệch = 0 → nút Lưu disabled).
- Xem trước luôn kèm badge trạng thái **sẽ thành** (VD tồn 3 → nhập 5 = 8 → badge đổi `Sắp hết` → `Còn hàng` ngay trong modal).

### 5.3 Lý do điều chỉnh — [Giả định — Đề xuất của spec, chờ duyệt tại demo]

> Docs KHÔNG quy định lý do bắt buộc: F-017 chỉ ghi "lịch sử biến động **[Giả định: log nhập/xuất kho]**", ERD chưa có entity log biến động. Spec đề xuất nâng thành quy tắc sau (nếu không được duyệt, hạ xuống: ghi chú tùy chọn như bản rút gọn trước của spec này):

- Trường `Lý do điều chỉnh *` — select bắt buộc: `Nhập hàng mới` · `Kiểm kê điều chỉnh` · `Hàng hư hỏng` · `Khách trả hàng` · `Xuất hủy` · `Khác`.
- Ô `Ghi chú` (textarea 2 dòng, tối đa 200 ký tự): tùy chọn, **riêng chọn `Khác` thì bắt buộc**.
- Gợi ý khớp chế độ (chỉ gợi ý, đổi tay được): `Nhập thêm` → mặc định `Nhập hàng mới`; `Xuất / giảm` → `Hàng hư hỏng`; `Đặt số mới` → `Kiểm kê điều chỉnh`.

### 5.4 Validate & xác nhận

- Validate inline khi rời trường (§B.2): số phải là số nguyên; `Nhập thêm`/`Xuất / giảm`: `> 0`; `Xuất / giảm` vượt tồn → lỗi dưới ô "Số lượng giảm không được lớn hơn tồn hiện tại ({stock})."; thiếu lý do → lỗi "Vui lòng chọn lý do điều chỉnh."
- **Bước xác nhận phụ** (trong modal, thay cho confirm dialog §B.3): với `Xuất / giảm` và `Đặt số mới` có chênh lệch âm, bấm `Lưu điều chỉnh` → modal chuyển sang trạng thái xác nhận: tóm tắt "Tồn của **{tên SP} — {màu}** sẽ giảm từ {cũ} xuống {mới} (lý do: {lý do})." + nút `Xác nhận` (Primary) / `Quay lại`. `Nhập thêm` và tăng tồn → lưu thẳng, không hỏi thêm.
- Khi đang lưu: nút loading + khóa form (§B.2). Đóng modal bằng ×/Esc/overlay; đã nhập dở → confirm bỏ thay đổi theo §B.2.

### 5.5 Chống ghi đè & kết quả

- Modal gửi kèm `expectedStock` = tồn tại thời điểm mở modal. Backend đã bị trừ/ cộng tồn bởi đơn hàng trong lúc admin đang mở modal → trả `409 STOCK_CHANGED` → modal KHÔNG đóng: hiện banner lỗi trong modal "Tồn kho vừa thay đổi (hiện còn {currentStock}) do giao dịch khác. Số liệu đã được tải lại — kiểm tra và lưu lại.", cập nhật `Tồn hiện tại` + xem trước theo số mới. (Cùng nguyên tắc nguyên tử FR-011/NFR-002: FE không ghi đè tồn tuyệt đối một cách mù quáng; chế độ `Đặt số mới` cũng đi qua kiểm tra này.)
- **Lưu thành công:** đóng modal + toast xanh (§B.3): "Đã cập nhật tồn kho: {tên SP} — {màu} còn {stock mới}." → bảng **tải lại đúng trang + bộ lọc hiện tại** (§B.3), thẻ tổng quan §2.2 và badge sắp hết trên sidebar tính lại theo số mới. Hệ quả hiển nhiên phải đúng: nếu đang ở chip `Sắp hết` mà nhập thêm tới khi `stock > ngưỡng` thì dòng biến mất khỏi danh sách sau khi tải lại (toast đã nêu số mới nên admin không ngỡ ngàng); badge trạng thái mọi dòng đổi ngay theo §2.1.

---

## §6. Sửa ngưỡng cảnh báo từng biến thể → F-017, FR-023

- Tại ô `Ngưỡng cảnh báo`: click icon bút chì (hoặc click vào số) → ô chuyển thành input số (rộng ~72px) + nút `✓` / `✕` ngay trong ô. `Enter` = lưu như `✓`; `Esc` = hủy như `✕`.
- Validate: số nguyên `≥ 0` (ngưỡng `0` hợp lệ = chỉ cảnh báo khi hết hàng). Sai → viền `--error` + tooltip/message 12px "Ngưỡng phải là số nguyên ≥ 0.", không gọi API.
- Lưu: input disabled + spinner nhỏ trong lúc gọi `PATCH`; thành công → toast "Đã cập nhật ngưỡng cảnh báo." + **badge trạng thái của dòng tính lại ngay** (VD: tồn 4, ngưỡng 5 → `Sắp hết`; sửa ngưỡng xuống 3 → ngay lập tức thành `Còn hàng`) + thẻ tổng quan/sidebar badge tính lại nếu dòng rời/vào nhóm sắp hết. Lỗi API → khôi phục số cũ + toast đỏ lý do cụ thể (§B.3).
- Ngưỡng mặc định khi tạo biến thể = **5** (F-017) — việc đó thuộc form màn 15; màn này chỉ sửa trên biến thể đã có. Cùng 1 field `lowStockThreshold`: sửa ở màn 18, màn 15 hay ngược lại đều đọc/ghi cùng API, không cache riêng phía FE quá 1 lần tải trang (nhất quán Dashboard §8).

---

## §7. Liên kết sang Quản lý Sản phẩm → FR-020, F-014

- Click vào dòng (trừ cột Hành động, ô Ngưỡng đang sửa và SKU) hoặc icon `↗` ở cột Hành động → điều hướng `/admin/san-pham?q={sku}`: màn 15 tìm kiếm khớp cả SKU (§2.1 spec admin-san-pham) nên admin thấy đúng sản phẩm chứa biến thể này, bấm `Sửa` ở đó để mở slide-over sửa biến thể (giá/SKU/kích thước… — những field KHÔNG sửa ở màn tồn kho).
- **[Đề xuất — chờ màn 15 hỗ trợ]** Deep-link mở sẵn form: `/admin/san-pham?san-pham={productId}&mau={variantId}` → màn 15 tự mở slide-over Sửa và cuộn/highlight đúng khối màu. Hiện code màn 15 mới đọc `q`/`categoryId`, chưa hỗ trợ 2 param này — builder màn 18 cứ dùng phương án `?q={sku}` ở trên; khi màn 15 bổ sung param thì đổi link, không đổi spec này.

---

## §8. Lịch sử biến động kho — [Giả định trong F-017]

- F-017 nêu output có "lịch sử biến động" nhưng tự ghi **[Giả định: log nhập/xuất kho]** và ERD chưa có entity log. **Quyết định cho builder: KHÔNG bịa tab/khối lịch sử trong bản này.** Mọi lần điều chỉnh ở §5 đã bắt buộc kèm lý do (§5.3) để sẵn sàng ghi log.
- Khi backend có log biến động (đề xuất field: `variantId`, `delta`, `stockBefore`, `stockAfter`, `reason`, `note`, `adminId`, `createdAt` — cần bổ sung vào ERD khi code): bổ sung nút `Lịch sử` ở cột Hành động → slide-over (§B.2) liệt kê biến động của variant đó, mới nhất trước. Chỉ làm khi có API thật.

---

## §9. Contract backend (builder/code dùng mock khớp shape này)

- `GET /admin/inventory?status=all|low|out&q=&categoryId=&sort=stock_asc|stock_desc|price_asc|price_desc|name_asc|name_desc&page=&size=` → `{ content: [{ variantId, productId, productName, productActive, categoryId, categoryName, image, color, colorHex, sku, price, stock, lowStockThreshold }], totalElements, totalPages, page, size, counts: { all, low, out } }` (`status=low` = `stock ≤ lowStockThreshold` gồm cả `out`; `counts` tính theo các lọc còn lại — tìm kiếm + danh mục — bỏ qua chính `status`, phục vụ §2.2/§3.1; mặc định `sort=stock_asc`)
- `POST /admin/inventory/{variantId}/adjust` — `{ mode: "RECEIVE" | "REMOVE" | "SET", qty?, newStock?, expectedStock, reason: "RESTOCK" | "STOCKTAKE" | "DAMAGED" | "RETURN" | "DISPOSAL" | "OTHER", note? }` → `200 { variantId, stock, lowStockThreshold }` · `409 { code: "STOCK_CHANGED", currentStock }` · `422` khi vi phạm validate §5.4
- `PATCH /admin/inventory/{variantId}/threshold` — `{ lowStockThreshold }` → `200 { variantId, lowStockThreshold, stock }` · `422` khi ngưỡng `< 0`
- Tái dùng nguyên xi, không sửa: `GET /admin/inventory/low-stock?limit=` (Dashboard §8/§10) và `GET /admin/categories` (dropdown danh mục, màn 16).
- Mọi endpoint `/admin/**`: 401 chưa đăng nhập, 403 khi role != ADMIN (§A.4); entry `/admin` trong vite proxy đã có từ màn 14.
- **Thay thế bản rút gọn trước của spec này:** endpoint `POST /admin/inventory/{variantId}/receive` trong bản cũ được gộp thành `adjust` với `mode: "RECEIVE"` (cộng dồn phía backend, không ghi đè tuyệt đối — giữ nguyên quyết định cũ).

---

## §10. Trạng thái toàn trang → §B.1, §A.4

- **Loading lần đầu:** thẻ tổng quan hiện skeleton 3 thẻ + bảng 5 hàng skeleton (§B.1) — 2 khối tải độc lập, khối xong trước hiện trước.
- **Lỗi bảng:** "Không tải được dữ liệu tồn kho." + nút "Thử lại" (chỉ tải lại bảng). **Lỗi thẻ tổng quan:** thẻ hiện "—" + nút thử lại nhỏ trong thẻ, không chặn bảng.
- **Rỗng — chưa có biến thể nào (chip `Tất cả`, không lọc/tìm):** icon + "Chưa có biến thể nào. Biến thể được tạo khi thêm sản phẩm." + nút Primary `Đến Quản lý sản phẩm` (→ `/admin/san-pham`).
- **Rỗng — chip `Sắp hết` trống:** trạng thái tốt: icon ✓ `--success` + "Tất cả biến thể đều đủ tồn kho." (nhất quán trạng thái tốt ở Dashboard §8). Chip `Hết hàng` trống: "Không có biến thể nào hết hàng."
- **Rỗng — đang tìm/lọc không khớp:** "Không tìm thấy biến thể phù hợp." + nút "Xóa bộ lọc" (§B.1).
- **Modal điều chỉnh lỗi:** 422 → lỗi inline đúng trường; 409 → banner trong modal theo §5.5; lỗi mạng → toast đỏ, giữ modal mở với dữ liệu đã nhập.
- **Guard:** theo §A.4 (chưa login → `/dang-nhap?returnTo=/admin/ton-kho`; không phải ADMIN → trang 403).

---

## §11. Traceability

| Mục spec | Nguồn |
|---|---|
| Route `/admin/ton-kho`, sidebar mục Tồn kho + badge sắp hết, guard ADMIN | admin-dashboard §A · FR-023 |
| Bảng theo BIẾN THỂ (1 dòng = 1 màu): ảnh + tên + màu, SKU, giá, tồn, ngưỡng | FR-023 (tồn kho theo màu sắc) · ERD ProductVariant · QĐ 2026-10-10 |
| Admin thấy/tìm được SKU ở màn tồn kho | US-015 ("tôi thấy được số lượng và SKU") |
| Badge Còn hàng / Sắp hết / Hết hàng theo `stock` vs `lowStockThreshold`; ngưỡng mặc định 5 | F-017 · FR-023 · §B.4 admin-dashboard |
| Nhóm "sắp hết" `stock ≤ lowStockThreshold` gồm hết hàng — khớp KPI + khối cảnh báo Dashboard | admin-dashboard §2, §8 · F-017 |
| Chips Tất cả / Sắp hết / Hết hàng; lọc danh mục; tìm tên/màu/SKU; sort tồn tăng dần mặc định; phân trang 10/20/50 | admin-dashboard §B.1 · FR-023 (Dashboard §8 chốt sort tồn tăng dần) |
| Đọc `?trang-thai=sap-het` / `?sku=` từ Dashboard (KPI, "Xem tất cả", click dòng cảnh báo) | admin-dashboard §2, §8 · pattern §2.5 admin-don-hang |
| Điều chỉnh tồn 3 chế độ (nhập thêm / xuất giảm / đặt số mới), validate tồn không âm, xem trước + badge sẽ thành | FR-023 · F-017 · ràng buộc `stock ≥ 0` F-014 · chống âm kho FR-011/NFR-002 |
| `expectedStock` + 409 khi tồn vừa bị giao dịch khác thay đổi | FR-011 · NFR-002 (kiểm tra nguyên tử lúc trừ kho) |
| Lý do điều chỉnh bắt buộc + danh sách lý do (nhập hàng/kiểm kê/hư hỏng/trả hàng/xuất hủy/khác) | **[Giả định — Đề xuất của spec, chờ duyệt tại demo]** (docs không quy định; F-017 chỉ giả định log biến động) |
| Sửa `lowStockThreshold` từng biến thể, lưu xong trạng thái tính lại ngay | F-017 ("cấu hình được từng variant") · FR-023 |
| Click dòng → QL Sản phẩm sửa đúng biến thể qua `?q={sku}` | FR-020 · F-014 · §2.1 admin-san-pham (tìm kiếm khớp SKU) |
| Deep-link mở sẵn slide-over `?san-pham=&mau=` | **[Đề xuất — chờ màn 15 hỗ trợ param]** |
| Lịch sử biến động: không dựng UI khi chưa có entity/API log | F-017 [Giả định trong docs] · ERD (chưa có entity log) |
| Modal 520px / confirm / toast / skeleton / empty / error từng khối | admin-dashboard §B.1–§B.3 |
| Text tiếng Việt, giá `vi-VN` + `đ`; SKU chỉ hiện trong khu vực admin | copy-ux-linter · US-015 |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Quản lý tồn kho`, `Tồn hiện tại`, `Ngưỡng cảnh báo`, `Sắp hết`, `Hết hàng`, `Còn hàng`, `Điều chỉnh tồn kho`, `Nhập thêm`, `Xuất / giảm`, `Đặt số mới`, `Tồn thực tế`, `Lý do điều chỉnh`, `Tổng số biến thể`.
