# Spec giao diện — Quản lý Danh mục (admin-danh-muc)

- **Dự án:** noi-that-shop · **Màn:** Quản lý Danh mục (màn 16, wave 4 — admin)
- **Nguồn:** FR-021 · F-015 · hỗ trợ US-002 (khách duyệt catalog theo danh mục), F-001/F-002 · Entity: Category
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** §0 của `trang-chu.md` + **layout admin §A** và **quy ước §B (DataTable / modal / confirm / toast / badge)** của `admin-dashboard.md` — tuân thủ nguyên xi, spec này KHÔNG định nghĩa lại. Form danh mục ngắn (6 trường) → **modal 520px** theo §B.2 (không dùng slide-over). Mọi xóa qua confirm §B.3.
- **Quy tắc nghiệp vụ nền (F-015):** cây danh mục đúng **2 cấp** (cha/con qua `parentId`, `null` = danh mục gốc); **không xóa danh mục còn sản phẩm**; `slug` unique toàn hệ thống (ERD §3).
- **Ảnh hưởng phía khách hàng (builder phải biết):** danh mục ở màn này chính là dữ liệu khách hàng thấy — khối "Danh mục nổi bật" trang chủ (F-001: tối đa 8 danh mục **gốc**, `active = true`, xếp theo `sortOrder`) và trang duyệt `/danh-muc/{slug}` (màn 2). Đổi `sortOrder`/`active`/ảnh ở đây là đổi ngay thứ tự + hiển thị ngoài cửa hàng.
- **Không có user story admin riêng cho danh mục** trong docs (nhóm ADMIN chỉ có US-013→US-017, không story nào cho F-015) — spec trace chính về FR-021 + F-015, ghi rõ để không bịa US.

---

## §1. Bố cục trang `/admin/danh-muc`

Theo khung §A: sidebar mục "Danh mục" active · topbar tiêu đề "Quản lý danh mục", breadcrumb `Quản trị / Danh mục`. Vùng nội dung 1 khối duy nhất:

1. **Thanh tiêu đề khối:** H1 "Danh mục" 20px/700 + dòng đếm nhỏ `--text-muted` ("{N} danh mục · {M} danh mục gốc") — bên phải: nút Primary `+ Thêm danh mục` (mở modal §3 ở chế độ thêm mới, mặc định danh mục gốc).
2. **Card bảng cây** (§B.1 tùy biến cho cây — §2): thanh công cụ (tìm kiếm) → bảng cây → phân trang.
3. Dưới bảng, dòng chú thích nhỏ `--text-muted`: "Thứ tự hiển thị áp dụng cho danh mục nổi bật ở trang chủ và menu cửa hàng. Chỉ danh mục đang hiển thị mới xuất hiện phía khách hàng." (giải thích hệ quả của `sortOrder` + `active` — không để admin phải đoán).

Không có khối phụ nào khác trên trang này.

---

## §2. Bảng cây danh mục → FR-021, F-015

### 2.1 Cách hiển thị: 1 bảng phẳng, thụt lề theo cấp

- Một bảng duy nhất liệt kê **cả cây**: danh mục gốc xếp theo `sortOrder` tăng dần; ngay dưới mỗi danh mục gốc là các danh mục con của nó (cũng theo `sortOrder` tăng dần), thụt lề trái **28px** + ký hiệu nhánh `└` 12px `--text-muted` trước ảnh.
- Tên danh mục con 500 (gốc 600). Cấp tối đa 2 — không có thụt lề cấp 3 (F-015).
- Không sắp xếp theo cột khác: thứ tự hiển thị **chính là** `sortOrder` (đây là màn sắp xếp, khác màn Sản phẩm có sort đa cột). Header cột vẫn theo §B.1 nhưng không có mũi tên sort.

### 2.2 Thanh công cụ

- Ô tìm kiếm (debounce 300ms, §B.1): placeholder `Tìm theo tên danh mục, slug…` — khớp `name` hoặc `slug`.
- Khi **đang tìm kiếm**: bảng chuyển sang dạng **phẳng** (bỏ thụt lề cây) gồm mọi danh mục khớp, thêm cột "Danh mục cha" hiện tên cha (hoặc "—" nếu là gốc) để giữ ngữ cảnh; nút ↑↓ thứ tự bị ẩn (không đổi thứ tự khi đang lọc). Xóa từ khóa → trở lại dạng cây.
- Lọc **Trạng thái**: select `Tất cả trạng thái` / `Đang hiển thị` / `Đã ẩn`. Đổi lọc → về trang 1.
- Không có lọc nào khác trên màn này.

### 2.3 Cột bảng

| Cột | Nội dung |
|---|---|
| Danh mục | Ảnh 48px bo 8px + tên + `slug` 12px `--text-muted` dưới tên. Danh mục con thụt lề như §2.1 |
| Danh mục cha | Chỉ hiện ở chế độ tìm kiếm phẳng (§2.2): tên cha / "—" |
| Số sản phẩm | Số Product có `categoryId` = danh mục này (đếm **trực thuộc**, không gộp của danh mục con). `> 0` → dạng link `--brand-700`, click → `/admin/san-pham?categoryId={id}` (màn 15 lọc sẵn danh mục này **[màn 15 bổ sung đọc param `categoryId` nếu chưa có]**). `= 0` → chữ thường "0" |
| Thứ tự | Số `sortOrder` + 2 nút icon nhỏ `↑` `↓` (kèm tooltip "Lên" / "Xuống") — đổi thứ tự **trong cùng nhóm anh em** (cùng `parentId`): §4. Nút ở biên (đầu/cuối nhóm) bị disabled mờ |
| Trạng thái | Badge: `Đang hiển thị` (`--success`) / `Đã ẩn` (`--text-muted`) — theo `active`. Danh mục gốc `Đã ẩn` mà có con đang hiển thị → thêm icon `⚠` `--warning` + chữ nhỏ "con cũng bị ẩn phía khách hàng" **[Giả định: cha ẩn → toàn bộ nhánh ẩn phía khách hàng]** |
| Hành động | Icon kèm tooltip (§B.1): `Thêm danh mục con` (chỉ ở dòng danh mục **gốc** — mở modal §3 với cha đã chọn sẵn; dòng con không có nút này vì không tạo được cấp 3) · `Xem` (mở `/danh-muc/{slug}` tab mới; danh mục `Đã ẩn` vẫn mở được để admin kiểm tra **[Giả định]**) · `Sửa` (mở modal §3) · `Xóa` (theo §5) |

- Click cả hàng (trừ cột Hành động và Thứ tự) → mở modal Sửa.

### 2.4 Phân trang

Theo §B.1 (`Trang X / Y · Tổng N danh mục`, chọn 10 / 20 / 50 mục/trang) nhưng **đơn vị trang là danh mục gốc** — cha và các con của nó luôn đi cùng nhau, không bao giờ tách cụm sang 2 trang. "Tổng N" đếm toàn bộ danh mục (gốc + con).

### 2.5 Dữ liệu mẫu demo (mock hiện có + danh mục con mẫu)

8 danh mục gốc lấy đúng `mockCategories` (`frontend/src/mocks/homeMock.js`), `productCount` đếm từ `mockAllProducts` hiện có (tổng 23 sản phẩm):

| Thứ tự | Danh mục | Slug | Số sản phẩm | Trạng thái |
|---|---|---|---|---|
| 1 | Sofa | `sofa` | 5 | Đang hiển thị |
| 2 | Bàn ăn | `ban-an` | 2 | Đang hiển thị |
| 3 | Giường ngủ | `giuong-ngu` | 2 | Đang hiển thị |
| 4 | Tủ quần áo | `tu-quan-ao` | 3 | Đang hiển thị |
| 5 | Kệ tivi | `ke-tivi` | 2 | Đang hiển thị |
| 6 | Bàn làm việc | `ban-lam-viec` | 2 | Đang hiển thị |
| 7 | Ghế | `ghe` | 3 | Đang hiển thị |
| 8 | Đèn & Decor | `den-decor` | 4 | Đang hiển thị |

Cộng: 5+2+2+3+2+2+3+4 = **23** ✓ khớp tổng sản phẩm mock.

**Danh mục con mẫu cho demo [Giả định — mock hiện tại cả 8 đều là cấp 1, chưa có con]:** để builder demo được cây 2 cấp + 2 lớp chặn xóa, spec thêm 3 danh mục con (chỉ ở dữ liệu demo/seed, `productCount = 0`):

| Cha | Danh mục con | Slug | Thứ tự trong nhóm | Ảnh |
|---|---|---|---|---|
| Sofa | Sofa góc L | `sofa-goc-l` | 1 | dùng lại ảnh Sofa |
| Sofa | Sofa giường | `sofa-giuong` | 2 | dùng lại ảnh Sofa |
| Ghế | Ghế ăn | `ghe-an` | 1 | dùng lại ảnh Ghế |

Với dữ liệu này: **Sofa** vừa có sản phẩm (5) vừa có con (2) → demo được cả 2 lớp chặn xóa §5; **Sofa giường** rỗng cả hai → demo được xóa thành công; **Bàn ăn** chỉ có sản phẩm → demo được chặn `HAS_PRODUCTS`.

---

## §3. Form thêm / sửa — modal 520px → FR-021, F-015

Modal giữa màn hình theo §B.2 (mobile thành bottom-sheet). Tiêu đề: `Thêm danh mục` / `Sửa danh mục` (+ tên danh mục nhỏ ở chế độ sửa). Footer: `Hủy` (Secondary) + `Lưu danh mục` (Primary). Đóng khi đã sửa chưa lưu → confirm theo §B.2. 6 trường:

| Trường | Kiểu | Validate / ghi chú |
|---|---|---|
| Tên danh mục * | text | Bắt buộc, tối đa 60 ký tự **[Giả định — docs không ghi giới hạn]** |
| Slug | text | Tự sinh từ tên (bỏ dấu, gạch ngang) khi gõ tên — cùng thuật toán màn 15; sửa tay được; dưới trường hiện preview `mocan.vn/danh-muc/{slug}`; trùng → lỗi tại trường "Slug đã được dùng bởi danh mục khác." (`Category.slug` unique — ERD §3) |
| Danh mục cha | select | `Không có (danh mục gốc)` + danh sách **chỉ các danh mục gốc** (`parentId = null`), thụt/không thụt không áp dụng. Không liệt kê danh mục con → không tạo được cấp 3 (F-015). Chế độ Sửa: loại trừ chính danh mục đang sửa khỏi danh sách. **Chặn đổi cấp:** danh mục đang có danh mục con thì trường này bị disabled + chú thích "Danh mục đang có danh mục con nên không thể chuyển thành danh mục con." (nếu cho làm con sẽ sinh cấp 3) |
| Ảnh danh mục | bộ chọn ảnh (xem §3.1) | Không bắt buộc; chưa có ảnh → card phía khách dùng ảnh placeholder §0 |
| Thứ tự hiển thị | số nguyên | `≥ 0`. Gợi ý sẵn khi thêm mới = `sortOrder` lớn nhất trong nhóm anh em + 1. Chú thích dưới trường: "Số nhỏ hiện trước. Chỉ so sánh trong cùng cấp (cùng danh mục cha)." Trùng số trong nhóm → khi hiển thị xếp tiếp theo tên A–Z **[Giả định xử lý trùng]**; đổi thứ tự nhanh bằng nút ↑↓ ở bảng (§4) thay vì sửa số tay |
| Đang hiển thị | toggle | Nhãn "Đang hiển thị" + chú thích "Tắt = ẩn khỏi trang chủ và menu cửa hàng; sản phẩm trong danh mục không bị ảnh hưởng." (`active`). Thêm mới: mặc định BẬT. Tắt 1 danh mục **gốc** đang có con → chú thích bổ sung trong form: "Các danh mục con cũng sẽ bị ẩn phía khách hàng." **[Giả định cha ẩn → con ẩn]** |

### 3.1 Bộ chọn ảnh (1 ảnh duy nhất — `imageUrl`)

- Ô preview 100% × 140px bo 12px: có ảnh → hiện ảnh + 2 nút `Đổi ảnh` / `Xóa ảnh`; chưa có → vùng đứt nét "Chưa có ảnh".
- `Đổi ảnh` / bấm vào ô → mở panel chọn ảnh 2 tab:
  - Tab **Tải ảnh lên**: kéo-thả file hoặc bấm chọn file. JPG/PNG/WebP, ≤ 5MB/ảnh (nhất quán upload màn 9/15) — file sai → toast đỏ nêu tên file + lý do. Đang tải: spinner trên preview → xong thì thay ảnh + đóng panel.
  - Tab **Thư viện có sẵn**: lưới 4 cột các ảnh nội thất đã có trong hệ thống (dùng lại bộ ảnh mock hiện có: sofa, phòng ăn, giường, kệ tivi, bàn làm việc, ghế, đèn…) — bấm 1 ảnh là chọn xong, đóng panel. (Tránh bắt admin tải lại ảnh đã có — đúng yêu cầu "upload hoặc chọn từ thư viện".)
- Ảnh chỉ được gắn khi bấm `Lưu danh mục` (upload trả về `url` trước, lưu cùng form — cùng pattern màn 15).

### 3.2 Lưu & lỗi

- Bấm `Lưu danh mục`: validate toàn form — trường lỗi đầu tiên được focus; nút chuyển loading + khóa form (§B.2).
- Lỗi API: `409` field `slug` → gắn lỗi tại ô slug; `422` vi phạm rule (VD chọn cha là danh mục con) → toast đỏ message cụ thể từ API (§B.3).
- Lưu thành công: đóng modal + toast xanh "Đã lưu danh mục." (§B.3) + bảng tải lại giữ nguyên trang hiện tại; thêm mới → danh mục xuất hiện đúng vị trí theo `sortOrder` trong nhóm của nó.

---

## §4. Đổi thứ tự hiển thị → FR-021 (`sortOrder`)

- Nút `↑` / `↓` ở cột Thứ tự: hoán đổi `sortOrder` với anh em **kề trên / kề dưới trong cùng nhóm** (cùng `parentId`). Không bao giờ đổi thứ tự xuyên cấp (con không nhảy sang nhóm cha khác).
- Bấm nút: gọi API move → bảng cập nhật ngay vị trí 2 dòng, **không toast** (thao tác nhẹ, kết quả thấy ngay — khác thao tác lưu/xóa §B.3). Lỗi API → toast đỏ "Không đổi được thứ tự. Thử lại." + bảng giữ nguyên.
- Sau mỗi lần move, backend chuẩn hoá lại `sortOrder` của cả nhóm thành dãy liên tục 1..n **[Giả định — chống số trùng/lỗ sau nhiều lần sửa tay]**; FE hiển thị lại đúng số mới.
- Đang tìm kiếm (bảng phẳng §2.2) hoặc đang tải → ẩn/disabled cụm nút này.

---

## §5. Xóa danh mục → F-015, §B.3

F-015 chỉ chốt 1 lớp chặn: **"không xóa danh mục còn sản phẩm"**. Lớp chặn thứ hai (còn danh mục con) docs không đề cập → spec ghi **[Giả định]** kèm hướng xử lý dưới đây. Thứ tự kiểm khi bấm `Xóa`: **danh mục con trước → sản phẩm sau** (con là vấn đề cấu trúc, phải xử lý trước).

### 5.1 Còn danh mục con (`hasChildren = true`) → chặn [Giả định]

- Mở dialog cảnh báo (kiểu §B.3 nhưng **không có nút Xóa**): tiêu đề "Chưa thể xóa danh mục", nội dung: "Danh mục **{tên}** đang có {k} danh mục con ({liệt kê tên các con}). Hãy xóa hoặc chuyển các danh mục con sang danh mục cha khác trước khi xóa danh mục này.", nút duy nhất `Đã hiểu`.
- API DELETE vẫn trả `409 { code: "HAS_CHILDREN", childCount }` làm lưới an toàn (phòng dữ liệu đổi giữa chừng) → FE hiển thị lại đúng dialog này.

### 5.2 Còn sản phẩm (`productCount > 0`) → chặn (F-015)

- Mở dialog cảnh báo (không có nút Xóa): tiêu đề "Chưa thể xóa danh mục", nội dung: "Danh mục **{tên}** đang có {n} sản phẩm nên không thể xóa. Hãy chuyển các sản phẩm sang danh mục khác ở màn Sản phẩm, hoặc tắt hiển thị danh mục này nếu chỉ muốn ẩn khỏi cửa hàng.", 2 nút: `Đã hiểu` (Secondary) + `Xem sản phẩm` (Primary → `/admin/san-pham?categoryId={id}` — đường thoát để admin xử lý tiếp, không để dialog cụt).
- API DELETE vẫn trả `409 { code: "HAS_PRODUCTS", productCount }` → FE hiển thị lại đúng dialog này.

### 5.3 Rỗng cả con lẫn sản phẩm → xóa cứng

- Confirm dialog §B.3: tiêu đề "Xóa danh mục?", nội dung: "Bạn sắp xóa danh mục **{tên}** (`{slug}`). Thao tác này không thể hoàn tác.", nút nguy hiểm `Xóa`, nút `Hủy`.
- Xóa xong → toast "Đã xóa danh mục." + bảng tải lại đúng trang (cụm cha rỗng sau xóa → lùi 1 trang, theo §B.3).
- Khác màn Sản phẩm: danh mục **không** có cơ chế "ngừng bán thay cho xóa" trong docs — cách ẩn khỏi cửa hàng là tắt `active` (§3), xóa chỉ dành cho danh mục rỗng. Ghi rõ để builder không tự thêm nhánh ngừng bán.

---

## §6. Trạng thái của trang & form

- **Bảng loading:** 5 hàng skeleton (§B.1). **Bảng lỗi:** "Không tải được dữ liệu." + nút "Thử lại" (chỉ tải lại bảng).
- **Bảng rỗng — chưa có danh mục nào (không lọc):** icon + chữ **"Chưa có danh mục nào"** + nút Primary `+ Thêm danh mục` ngay trong vùng trống.
- **Bảng rỗng — đang lọc/tìm không khớp:** "Không tìm thấy danh mục phù hợp." + nút "Xóa bộ lọc" (§B.1).
- **Modal loading (chế độ Sửa):** mở modal ngay với skeleton các trường trong lúc tải chi tiết; lỗi tải chi tiết → nội dung modal hiện "Không tải được thông tin danh mục." + "Thử lại", không mở form trống.
- **Guard:** theo §A.4 (chưa login → `/dang-nhap?returnTo=/admin/danh-muc`; không phải ADMIN → trang 403).

---

## §7. Contract backend (builder/code dùng mock khớp shape này)

- `GET /admin/categories` → trả **toàn bộ** danh sách phẳng (không phân trang phía API — FE tự dựng cây + phân trang theo cụm cha §2.4): `[{ id, name, slug, parentId, imageUrl, sortOrder, active, productCount, hasChildren, createdAt }]` sắp theo `sortOrder` tăng dần. *(Endpoint này màn 15 đang dùng tạm cho dropdown danh mục — màn 16 chính thức hoá shape này; dropdown màn 15 chỉ đọc `id, name, parentId`.)*
- `GET /admin/categories/{id}` → `{ id, name, slug, parentId, imageUrl, sortOrder, active }` (nạp vào form §3)
- `POST /admin/categories` — body như GET detail (bỏ `id`) → `201` danh mục đã tạo · `409 { field: "slug", message }` khi trùng slug · `422` khi vi phạm cây 2 cấp (cha là danh mục con / danh mục có con bị gán cha)
- `PUT /admin/categories/{id}` — cùng body → `200` · `409`/`422` như POST
- `DELETE /admin/categories/{id}` → `204` · `409 { code: "HAS_CHILDREN", childCount }` khi còn con [Giả định] · `409 { code: "HAS_PRODUCTS", productCount }` khi còn sản phẩm (F-015)
- `PATCH /admin/categories/{id}` — `{ active }` → `200`
- `PATCH /admin/categories/{id}/move` — `{ direction: "up" | "down" }` → `200` trả lại toàn bộ nhóm anh em sau chuẩn hoá `[{ id, sortOrder }]`
- `POST /admin/categories/images` — multipart 1 file → `{ url }` (≤5MB; JPG/PNG/WebP) — pattern upload dùng chung với màn 15
- Mọi endpoint `/admin/**`: 401 chưa đăng nhập, 403 khi role != ADMIN (§A.4); entry `/admin` trong vite proxy đã có từ màn 14.

---

## §8. Traceability

| Mục spec | Nguồn |
|---|---|
| Route `/admin/danh-muc`, khung sidebar/topbar, guard ADMIN | admin-dashboard §A · FR-021 |
| CRUD danh mục (thêm/sửa/xóa/ẩn) | FR-021 · F-015 |
| Cây đúng 2 cấp: `parentId`, select cha chỉ liệt kê danh mục gốc, danh mục có con không bị gán cha | F-015 (cây 2 cấp) · FR-021 (cha/con 2 cấp **[Giả định]** trong SRE) · ERD CATEGORY.parentId |
| `slug` unique + tự sinh từ tên + preview URL | ERD §3 (`Category.slug` UK) · F-015 · pattern form màn 15 |
| Ảnh danh mục `imageUrl` (upload / thư viện có sẵn) | ERD CATEGORY.imageUrl · FR-021 (task brief: "tên, ảnh, thứ tự hiển thị") |
| `sortOrder` quyết định thứ tự trang chủ (≤8 danh mục gốc active) + nút ↑↓ trong cùng nhóm anh em | ERD CATEGORY.sortOrder · F-001 (output ≤8 danh mục theo sortOrder) |
| Cột Số sản phẩm = đếm Product theo `categoryId` trực thuộc; click → màn Sản phẩm lọc sẵn | ERD CATEGORY ||--o{ PRODUCT · F-015 (điều kiện chặn xóa) |
| Chặn xóa khi còn sản phẩm + dialog hướng dẫn chuyển sản phẩm / tắt hiển thị | F-015 ("không xóa danh mục còn sản phẩm") · §B.3 |
| Chặn xóa khi còn danh mục con [Giả định] + thứ tự kiểm con → sản phẩm | **[Giả định của spec]** — F-015 không đề cập; hướng xử lý: chặn + API 409 `HAS_CHILDREN` |
| Cha ẩn → con cũng ẩn phía khách hàng [Giả định] | **[Giả định của spec]** — suy ra từ hiển thị cây phía khách (màn 2); ERD không ghi rule này |
| Toggle `active` = ẩn/hiện phía khách, không ảnh hưởng sản phẩm | ERD CATEGORY.active · pattern `active` các entity khác |
| Form modal 520px (form ngắn), validate inline, confirm đóng form chưa lưu | admin-dashboard §B.2 |
| Confirm xóa nêu tên đối tượng + toast kết quả | admin-dashboard §B.3 |
| Tìm kiếm tên/slug; đếm "Tổng N" toàn cây | admin-dashboard §B.1 (tùy biến cây §2.2/§2.4) |
| Text tiếng Việt, không lộ mã nội bộ | copy-ux-linter · §0.3 trang-chu |

**Ghi chú lệch tài liệu (builder/parent cần biết):**
1. **Không có user story cho quản lý danh mục** — docs chỉ có FR-021 + F-015. Spec không tự chế US; acceptance suy trực tiếp từ business rules của F-015.
2. **Field ảnh trong ERD/mock là `imageUrl`** (không phải `image` như cách gọi tắt) — spec và contract dùng `imageUrl` cho khớp code hiện có.
3. **Mock hiện tại chưa có danh mục con nào** (8/8 đều `parentId = null`) — 3 danh mục con ở §2.5 là dữ liệu demo/seed [Giả định] để thể hiện cây 2 cấp; khi code thật, seed bổ sung tương tự hoặc admin tự tạo qua form.
4. **Phân trang theo cụm cha** (§2.4) là tùy biến của §B.1 cho dữ liệu cây — các màn admin khác vẫn phân trang phẳng bình thường.

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Quản lý danh mục`, `Thêm danh mục`, `Lưu danh mục`, `Danh mục cha`, `Danh mục con`, `Danh mục gốc`, `Thêm danh mục con`, `Số sản phẩm`, `Thứ tự hiển thị`, `Đang hiển thị`, `Đã ẩn`, `Chưa thể xóa danh mục`, `Thư viện có sẵn`.
