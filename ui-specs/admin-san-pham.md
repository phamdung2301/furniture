# Spec giao diện — Quản lý Sản phẩm (admin-san-pham)

- **Dự án:** noi-that-shop · **Màn:** Quản lý Sản phẩm (màn 15, wave 4 — admin)
- **Nguồn:** FR-020 · F-014, F-017 · US-013 · Entities: Product, ProductVariant, Category
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** §0 của `trang-chu.md` + **layout admin §A** và **quy ước §B (DataTable / slide-over / confirm / toast / badge)** của `admin-dashboard.md` — tuân thủ nguyên xi, spec này KHÔNG định nghĩa lại. Mọi form dài dùng slide-over (§B.2), mọi xóa/ngừng bán qua confirm (§B.3).
- **Quy tắc nghiệp vụ nền (F-014):** mỗi **màu** bắt buộc có `sku` unique, `price > 0`, `stock ≥ 0`, `lengthM/widthM > 0` (phục vụ tính phí ship FR-029); tối thiểu 1 màu/sản phẩm; upload tối đa 10 ảnh/sản phẩm **[Giả định trong F-014]**; sản phẩm đã có đơn liên quan → **ngừng bán** (`active=false`) thay vì xóa cứng.

---

## §1. Bố cục trang `/admin/san-pham`

Theo khung §A: sidebar mục "Sản phẩm" active · topbar tiêu đề "Quản lý sản phẩm", breadcrumb `Quản trị / Sản phẩm`. Vùng nội dung 1 khối duy nhất:

1. **Thanh tiêu đề khối:** H1 "Sản phẩm" 20px/700 + dòng đếm nhỏ `--text-muted` ("{N} sản phẩm") — bên phải: nút Primary `+ Thêm sản phẩm` (mở slide-over §3 ở chế độ thêm mới).
2. **Card DataTable** (§B.1): thanh công cụ (tìm kiếm + lọc) → bảng → phân trang.

Không có khối phụ nào khác trên trang này.

---

## §2. DataTable sản phẩm → FR-020, F-014, US-013

### 2.1 Thanh công cụ

- Ô tìm kiếm (debounce 300ms, §B.1): placeholder `Tìm theo tên sản phẩm, SKU…` — khớp tên sản phẩm **hoặc** SKU của bất kỳ màu nào của sản phẩm đó.
- Lọc **Danh mục**: select `Tất cả danh mục` + 8 danh mục (danh mục con thụt lề 1 cấp nếu có `parentId` — FR-021 cây 2 cấp).
- Lọc **Trạng thái**: select `Tất cả trạng thái` / `Đang bán` / `Ngừng bán`.
- Đổi tìm kiếm/lọc → về trang 1, tải lại bảng.

### 2.2 Cột bảng (header theo §B.1: 13px/700 uppercase `--text-muted`)

| Cột | Nội dung | Sắp xếp |
|---|---|---|
| Sản phẩm | Ảnh chính 48px bo 8px + tên 600 (1 dòng cắt `…`) + `slug` 12px `--text-muted` dưới tên | Tên A–Z / Z–A |
| Danh mục | Tên danh mục | — |
| Số màu | Số lượng biến thể + hàng chấm màu mini (`colorHex`, tối đa 5 chấm, thừa hiện `+N`) | — |
| Giá từ | Giá variant rẻ nhất, `vi-VN` + `đ` (đúng US-013: "giá từ" = giá variant rẻ nhất) | Tăng / giảm |
| Tổng tồn | Tổng `stock` mọi màu. `= 0` → Badge `Hết hàng` (`--error`). Có màu `stock ≤ lowStockThreshold` → thêm icon `⚠` `--warning` + chữ nhỏ "{k} màu sắp hết" (F-017) | Tăng / giảm |
| Trạng thái | Badge: `Đang bán` (`--success`) / `Ngừng bán` (`--text-muted`) | — |
| Nổi bật | `★` `--accent` nếu `featured`, `—` nếu không. Click ★ → bật/tắt nhanh `featured` (PATCH) + toast "Đã bật nổi bật." / "Đã tắt nổi bật." | — |
| Hành động | Icon kèm tooltip (§B.1): `Xem` (mở `/san-pham/{slug}` tab mới) · `Sửa` (mở slide-over §3) · `Xóa` hoặc `Ngừng bán` (theo §5, dựa trên cờ `hasOrders`) | — |

- Mặc định sắp xếp: **Mới nhất trước** (`createdAt` giảm dần).
- Click cả hàng (trừ cột Hành động và ★) → mở slide-over Sửa.

### 2.3 Phân trang

Theo §B.1: `Trang X / Y · Tổng N sản phẩm`, chọn 10 / 20 / 50 mục/trang.

### 2.4 Dữ liệu mẫu demo (lấy từ mock hiện có — builder dùng đúng số này)

| Sản phẩm | Danh mục | Số màu | Giá từ | Tổng tồn | Trạng thái | Nổi bật |
|---|---|---|---|---|---|---|
| Sofa góc L Nordic | Sofa | 3 (Xám/Be/Nâu) | 12.900.000đ | 25 | Đang bán | ★ |
| Giường ngủ gỗ óc chó 1m8 | Giường ngủ | 2 | 14.900.000đ | 11 | Đang bán | |
| Bàn trà gỗ sồi | Sofa | 2 | 3.450.000đ | 35 | Đang bán | ★ |
| Ghế ăn bọc vải | Ghế | 3 | 1.450.000đ | — (màu Đen còn 3 ≤ ngưỡng 5 → `⚠ 1 màu sắp hết`, khớp US-015) | Đang bán | |
| Sofa da bò Ý | Sofa | 1 | 18.500.000đ | 0 → Badge `Hết hàng` | Đang bán | |
| Kệ tivi gỗ công nghiệp | Kệ tivi | 2 | 2.900.000đ | 14 | Ngừng bán (đã có đơn → chỉ có nút `Ngừng bán`/đang tắt) | |

(Tổng số sản phẩm demo = toàn bộ `mockAllProducts` hiện có; 6 dòng trên là dòng tiêu biểu phải khớp số. Trang 1 mặc định 10 dòng.)

---

## §3. Form thêm / sửa — slide-over → FR-020, F-014, US-013

Slide-over từ phải 560px (mobile full-screen) theo §B.2. Tiêu đề: `Thêm sản phẩm` / `Sửa sản phẩm` (+ tên sản phẩm nhỏ ở chế độ sửa). Footer sticky: `Hủy` (Secondary) + `Lưu sản phẩm` (Primary). Đóng khi đã sửa chưa lưu → confirm theo §B.2. Nội dung cuộn gồm 4 mục:

### 3.1 Mục 1 — Thông tin chung

| Trường | Kiểu | Validate / ghi chú |
|---|---|---|
| Tên sản phẩm * | text | Bắt buộc, tối đa 120 ký tự |
| Slug | text | Tự sinh từ tên (bỏ dấu, gạch ngang) khi gõ tên; sửa tay được; dưới trường hiện preview `mocan.vn/san-pham/{slug}`; trùng → lỗi "Slug đã được dùng bởi sản phẩm khác." (Product.slug unique — ERD §3) |
| Danh mục * | select | Bắt buộc; danh mục con thụt lề 1 cấp |
| Mô tả | textarea (6 dòng) | Hiển thị ở tab Mô tả trang chi tiết |
| Giá niêm yết | số (đ) | Tùy chọn, `≥ 0`. Ghi chú dưới trường: "Giá tham khảo. Giá bán thực tế lấy theo từng màu; khách hàng thấy "giá từ" = giá màu rẻ nhất." (ERD: `basePrice` "giá niêm yết") |
| Badge hiển thị | select | `Không gắn` / `MỚI` / `BÁN CHẠY` / `Giảm giá` — chọn `Giảm giá` hiện thêm ô nhãn (mặc định gợi ý `-15%`). Đúng 3 loại badge §0.4 trang-chu + field `badge{type,label}` FE đang dùng |
| Nổi bật | toggle | Nhãn "Sản phẩm nổi bật" + chú thích "Hiện trong mục Sản phẩm nổi bật ở trang chủ." (`featured`) |
| Đang bán | toggle | Nhãn "Đang bán" + chú thích "Tắt = ngừng bán, sản phẩm ẩn khỏi cửa hàng nhưng đơn cũ không bị ảnh hưởng." (`active`). Chế độ Thêm mới: mặc định BẬT |

### 3.2 Mục 2 — Ảnh sản phẩm

- Lưới thumbnail 4 cột (ô ~112px): mỗi ô ảnh + nút `×` xóa ở góc + tay nắm kéo sắp xếp (drag để đổi thứ tự = `sortOrder` embedded ERD).
- Ô đầu tiên gắn nhãn `Ảnh chính` (nền `--brand-700` chữ trắng) — ảnh chính hiện ở bảng §2, card và gallery khách hàng. Muốn đổi ảnh chính: kéo ảnh đó lên đầu.
- Ô cuối là nút tải lên đứt nét `+ Thêm ảnh`: chọn nhiều file cùng lúc + kéo-thả file vào lưới. Tối đa **10 ảnh** (F-014 [Giả định]) — đủ 10 thì ẩn nút, hiện hint "Đã đủ tối đa 10 ảnh."
- Mỗi ảnh tải lên có trạng thái riêng: đang tải (spinner trên ô) → xong / lỗi (ô viền `--error` + nút "Thử lại"). Định dạng JPG/PNG/WebP, ≤ 5MB/ảnh (nhất quán upload ảnh đánh giá màn 9) — file sai → toast đỏ nêu tên file + lý do, không chặn các file còn lại.
- Chế độ Thêm mới chưa có ảnh: vẫn lưu được (bảng/card dùng ảnh placeholder §0) — nhưng hiện hint vàng nhẹ "Sản phẩm chưa có ảnh sẽ khó bán hơn." (chỉ gợi ý, không chặn).

### 3.3 Mục 3 — Thông số kỹ thuật (`specs` — map key-value, ERD Product.specs)

- Danh sách dòng động: mỗi dòng = ô `Tên thông số` + ô `Giá trị` + nút `×` xóa dòng. Nút `+ Thêm thông số` ở cuối.
- Gợi ý tên thông số (datalist, khớp specs mock hiện có): `Kích thước`, `Kích thước chiếm chỗ`, `Chất liệu`, `Bảo hành`, `Xuất xứ`. Gõ tự do được.
- Tên thông số trùng nhau → lỗi inline ở dòng trùng "Tên thông số bị trùng."
- Dòng trống cả 2 ô → tự bỏ qua khi lưu. Đây là thông số **hiển thị** ở tab Thông số trang chi tiết (FR-020: kích thước/chất liệu hiển thị) — kích thước tính phí ship nằm ở biến thể (§3.4), không nhập ở đây.

### 3.4 Mục 4 — Biến thể màu * (bảng dòng biến thể)

Mỗi màu = 1 khối dòng: header gồm chấm màu preview + tên màu (hoặc "Màu mới") + nút `×` xóa màu ở góc phải; thân khối là lưới field 2 cột:

| Trường | Kiểu | Validate / ghi chú (theo F-014) |
|---|---|---|
| Tên màu * | text | VD: Xám, Be, Nâu óc chó |
| Mã màu * | color picker + ô hex | Đồng bộ 2 chiều; hex phải đúng dạng `#RRGGBB` (`colorHex` — chấm màu phía khách hàng) |
| SKU * | text | **Tự gợi ý** khi nhập tên sản phẩm + màu (VD: Sofa góc L Nordic + Xám → `SF-NRD-XAM`, đúng mẫu SKU mock) — sửa tay được. Trùng SKU (trong cùng form hoặc đã tồn tại) → lỗi tại trường "SKU đã tồn tại." (US-013: SKU trùng bị từ chối; `ProductVariant.sku` unique ERD §3) |
| Giá bán * | số (đ) | `> 0` |
| Tồn kho * | số nguyên | `≥ 0` |
| Ngưỡng cảnh báo | số nguyên | `≥ 0`, mặc định **5** (F-017); chú thích "Cảnh báo sắp hết khi tồn ≤ ngưỡng này." |
| Dài (m) * × Rộng (m) * | 2 ô số thập phân | Đều `> 0` — dùng tính **diện tích chiếm chỗ → phí ship** (FR-029, ERD §4 lấy từ ProductVariant). Bên phải hiện diện tích tính sẵn: "= 3,80 m²" (cập nhật khi gõ) |
| Nhãn kích thước | text | VD `2.0m x 1.9m` — chỉ hiển thị (QĐ biến thể theo màu: kích thước là thuộc tính hiển thị) |
| Ghi chú chất liệu | text | VD `Vải bố cao cấp` — chỉ hiển thị, không tách kho |

- Nút `+ Thêm màu` ở cuối mục: dòng mới **tự copy Dài/Rộng + Ngưỡng** từ dòng đầu tiên (các màu của 1 sản phẩm thường cùng kích thước — giảm nhập liệu), SKU gợi ý theo màu mới.
- Xóa màu: xóa dòng khỏi form (chưa lưu thì không hỏi); sửa sản phẩm mà xóa màu đã có trong đơn → khi Lưu, backend từ chối và toast đỏ nêu màu ("Màu Xám đã có trong đơn hàng, không thể xóa. Hãy đặt tồn kho = 0 hoặc ngừng bán sản phẩm.") **[Suy ra từ F-014 rule ngừng bán thay vì xóa cứng]**.
- Bắt buộc **≥ 1 màu** — xóa hết → lỗi ở mục "Sản phẩm cần ít nhất 1 màu." và chặn Lưu.
- Thanh tổng kết dính cuối mục (cập nhật realtime khi gõ): `Số màu: {n} · Tổng tồn: {Σ stock} · Giá từ: {min price}` — chính là 3 con số sẽ hiện ở bảng §2.

### 3.5 Lưu & lỗi

- Bấm `Lưu sản phẩm`: validate toàn form — trường lỗi đầu tiên được cuộn tới + focus; nút chuyển loading + khóa form (§B.2).
- Lỗi từ API (409 slug/SKU trùng, 422 vi phạm rule F-014) → gắn lỗi đúng trường nếu xác định được field, còn lại toast đỏ với message cụ thể từ API (§B.3).
- Lưu thành công: đóng slide-over + toast xanh "Đã lưu sản phẩm." (§B.3) + bảng tải lại giữ nguyên trang/lọc hiện tại; ở chế độ Thêm mới, sản phẩm mới xuất hiện khi bảng sắp xếp Mới nhất (mặc định) ở đầu trang 1.

---

## §4. Trạng thái của trang & form

- **Bảng loading:** 5 hàng skeleton (§B.1). **Bảng lỗi:** "Không tải được dữ liệu." + nút "Thử lại" (chỉ tải lại bảng).
- **Bảng rỗng — chưa có sản phẩm nào (không lọc):** icon + chữ **"Chưa có sản phẩm nào"** + nút Primary `+ Thêm sản phẩm` ngay trong vùng trống.
- **Bảng rỗng — đang lọc/tìm mà không khớp:** "Không tìm thấy sản phẩm phù hợp." + nút "Xóa bộ lọc" (§B.1).
- **Slide-over loading (chế độ Sửa):** skeleton các mục trong slide-over trong lúc tải chi tiết sản phẩm; lỗi tải chi tiết → nội dung slide-over hiện "Không tải được thông tin sản phẩm." + "Thử lại", không mở form trống.
- **Guard:** theo §A.4 (chưa login → `/dang-nhap?returnTo=/admin/san-pham`; không phải ADMIN → trang 403).

---

## §5. Xóa sản phẩm / Ngừng bán → F-014, §B.3

Cột Hành động hiện nút tùy theo cờ `hasOrders` từ API:

- **Chưa có đơn liên quan (`hasOrders = false`)** → nút `Xóa`: mở confirm dialog §B.3 — tiêu đề "Xóa sản phẩm?", nội dung: "Bạn sắp xóa **{tên sản phẩm}** cùng {n} màu và toàn bộ ảnh. Thao tác này không thể hoàn tác.", nút nguy hiểm `Xóa`, nút `Hủy`. Xóa xong → toast "Đã xóa sản phẩm." + bảng tải lại đúng trang (trang rỗng sau xóa → lùi 1 trang, §B.3).
- **Đã có đơn liên quan (`hasOrders = true`)** → nút `Xóa` được thay bằng nút `Ngừng bán` (hoặc `Đang bán lại` nếu đang tắt): confirm — tiêu đề "Ngừng bán sản phẩm?", nội dung: "Sản phẩm **{tên sản phẩm}** đã có trong đơn hàng nên không thể xóa. Ngừng bán sẽ ẩn sản phẩm khỏi cửa hàng, đơn hàng cũ không bị ảnh hưởng.", nút chính `Ngừng bán` (nền `--error`), nút `Hủy`. Xong → toast "Đã ngừng bán sản phẩm." + badge trạng thái ở bảng đổi ngay.
- Nếu vẫn gọi DELETE với sản phẩm có đơn → API trả 409 `HAS_ORDERS`, FE hiển thị lại đúng confirm ngừng bán ở trên (phòng trường hợp dữ liệu đổi giữa chừng).

---

## §6. Contract backend (builder/code dùng mock khớp shape này)

- `GET /admin/products?q=&categoryId=&active=&sort=newest|name_asc|name_desc|price_asc|price_desc|stock_asc|stock_desc&page=&size=` → `{ content: [{ id, name, slug, image, categoryId, categoryName, variantCount, colorHexes: [], minPrice, totalStock, lowStockVariantCount, active, featured, hasOrders, createdAt }], totalElements, totalPages, page, size }`
- `GET /admin/products/{id}` → `{ id, name, slug, categoryId, description, specs: {}, basePrice, badge: { type, label } | null, images: [{ url, sortOrder }], featured, active, variants: [{ id, sku, color, colorHex, price, stock, lowStockThreshold, lengthM, widthM, sizeLabel, materialNote }] }` (nạp vào form §3)
- `POST /admin/products` — body như GET detail (bỏ `id`) → `201` sản phẩm đã tạo · `409 { field: "slug" | "sku", message }` khi trùng · `422` khi vi phạm rule F-014
- `PUT /admin/products/{id}` — cùng body → `200` · `409`/`422` như trên · `409 { field: "variant", message }` khi xóa màu đã có trong đơn
- `DELETE /admin/products/{id}` → `204` · `409 { code: "HAS_ORDERS" }` khi đã có đơn
- `PATCH /admin/products/{id}` — `{ active }` (ngừng bán / bán lại) hoặc `{ featured }` (toggle ★) → `200`
- `POST /admin/products/images` — multipart nhiều file → `[{ url }]` (tối đa 10 ảnh/SP khi lưu; ≤5MB/ảnh; JPG/PNG/WebP)
- Dropdown danh mục dùng `GET /admin/categories` (màn 16) — demo/spec này dùng tạm danh sách danh mục sẵn có của catalog.
- Mọi endpoint `/admin/**`: 401 chưa đăng nhập, 403 khi role != ADMIN (§A.4); entry `/admin` trong vite proxy đã có từ màn 14.

---

## §7. Traceability

| Mục spec | Nguồn |
|---|---|
| Route `/admin/san-pham`, khung sidebar/topbar, guard ADMIN | admin-dashboard §A · FR-020 |
| DataTable: tìm kiếm tên/SKU, lọc danh mục + trạng thái, sort, phân trang 10/20/50 | admin-dashboard §B.1 · FR-020 |
| Cột "Giá từ" = giá variant rẻ nhất; SKU trùng bị từ chối | US-013 · ERD §3 (sku unique) |
| Cột Tổng tồn + ⚠ sắp hết theo `lowStockThreshold` | F-017 · FR-023 |
| Form slide-over (form dài), validate inline, confirm đóng form chưa lưu | admin-dashboard §B.2 |
| Thông tin chung: tên, slug unique, danh mục, mô tả, specs hiển thị, basePrice, featured, active | ERD Product · FR-020 |
| Ảnh: nhiều ảnh, kéo sắp xếp, ảnh đầu = ảnh chính, tối đa 10 | ERD Product.images (embedded, sortOrder) · F-014 [Giả định 10 ảnh] |
| Specs dạng key-value động (kích thước/chất liệu hiển thị) | ERD Product.specs · FR-020 |
| Biến thể theo MÀU: sku/price/stock/lowStockThreshold/lengthM/widthM/sizeLabel/materialNote từng màu | ERD ProductVariant · F-014 · QĐ 2026-10-10 (theo dõi đến cấp màu) |
| `lengthM/widthM > 0` từng màu — tính diện tích → phí ship | F-014 · FR-029 · ERD §4 |
| Ngưỡng cảnh báo mặc định 5 | F-017 |
| Xóa cứng khi chưa có đơn; đã có đơn → ngừng bán (`active=false`) | F-014 · admin-dashboard §B.3 |
| Badge MỚI / BÁN CHẠY / -% trên sản phẩm | trang-chu §0.4 · field `badge` FE/mock đang dùng |
| Toast kết quả + confirm xóa nêu tên đối tượng | admin-dashboard §B.3 |
| Text tiếng Việt, giá `vi-VN` + `đ`; SKU chỉ hiện trong khu vực admin | copy-ux-linter · US-015 (admin được thấy SKU) |

**Ghi chú lệch tài liệu (builder/parent cần biết):**
1. **`lengthM/widthM` đặt ở biến thể** (theo ERD + F-014 + code hiện tại), không đặt ở thông tin chung — vì phí ship tính theo từng màu và backend validate `> 0` theo màu. Form giảm nhập liệu bằng cách copy kích thước sang màu mới (§3.4).
2. **Không có field "giá gốc" (compareAtPrice) từng màu** trong ERD/code — khái niệm tương ứng trong docs là `basePrice` "giá niêm yết" ở cấp sản phẩm (§3.1). Badge giảm giá (`-15%`) là nhãn hiển thị tĩnh theo §0.4, không tự tính từ giá gốc.
3. **`badge` chưa có trong ERD Product** nhưng FE/mock đã implement (`badge{type,label}`) và card khách hàng đang hiển thị — spec đưa vào form để admin quản lý được dữ liệu đang chạy.

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Quản lý sản phẩm`, `Thêm sản phẩm`, `Lưu sản phẩm`, `Biến thể màu`, `Thêm màu`, `Giá từ`, `Tổng tồn`, `Giá niêm yết`, `Đang bán`, `Ngừng bán`, `Ảnh chính`, `Thêm thông số`, `Ngưỡng cảnh báo`, `Nhãn kích thước`.
