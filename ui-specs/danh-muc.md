# Spec giao diện — Danh mục + Lọc/Sắp xếp (danh-muc)

- **Dự án:** noi-that-shop · **Màn:** Danh mục + lọc/sắp xếp (màn 2/22)
- **Nguồn:** US-002 · FR-002, FR-003 · F-002 · Entities: Product, ProductVariant, Category
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Ghi chú:** Màn Tìm kiếm (màn 3) sẽ **tái dùng layout này** (khác nguồn dữ liệu F-003).

---

## §0. Design system — TÁI DÙNG NGUYÊN XI từ spec Trang chủ

Không phát minh style mới. Áp dụng toàn bộ `~/workspace/noi-that-shop/ui-specs/trang-chu.md` §0:
tokens màu (`--brand-700` primary, `--accent`, `--bg #FAF7F2`...), font Be Vietnam Pro,
components **Button** (Primary/Secondary/Text), **Badge**, **ProductCard** (§3 trang-chu:
ảnh 4/3, "Giá từ", chấm màu, overlay "Hết hàng"), **Skeleton**, Section header,
container 1200px, tone tiếng Việt (§0.3), định dạng giá `vi-VN + đ`.

**Component mới của màn này (định nghĩa 1 lần, màn Tìm kiếm tái dùng):**
- **Filter group:** card trắng bo `16px`, viền `--border`, padding `16px`; tiêu đề 15px/700
  + nút "Xóa" (text link 13px, hiện khi group có chọn); các option 14px, checkbox/filter
  tùy loại (xem §3).
- **Filter chip (đang áp dụng):** nền `#F5EFE6`, viền `--border`, bo `999px`,
  chữ 13px/600 `--text`, icon ✕ 12px; hover: viền `--brand-700`.
- **Sort dropdown:** select native style theo nút Secondary nhỏ (bo `10px`, padding `8px 12px`,
  14px/600); options: `Bán chạy nhất` · `Giá: Thấp đến cao` · `Giá: Cao đến thấp` · `Mới nhất`.
- **Pagination:** nút số bo `10px` 36px, trang hiện tại nền `--brand-700` chữ trắng;
  prev/next dạng icon ‹ ›; `...` khi nhiều trang.

---

## §1. Bố cục tổng thể

### Desktop (≥1024px)
```
[Header sticky — tái dùng từ trang-chu: top strip, header, nav danh mục]
Breadcrumb: Trang chủ / Sofa
┌─────────────────────────────────────────────────────┐
│ Tiêu đề danh mục (H1 28px/800) + "24 sản phẩm" muted │
├──────────────┬──────────────────────────────────────┤
│ SIDEBAR      │ TOOLBAR: [chips filter] [sort dropdown]│
│ filter       ├──────────────────────────────────────┤
│ (sticky,     │                                      │
│  rộng 260px, │   GRID sản phẩm 3 cột, gap 20px       │
│  scroll độc  │   (ProductCard tái dùng)              │
│  lập)        │                                      │
│              ├──────────────────────────────────────┤
│              │ PAGINATION (giữa)                     │
└──────────────┴──────────────────────────────────────┘
[Footer — tái dùng]
```

### Mobile (<1024px)
- Sidebar ẩn → thanh công cụ sticky dưới header: nút **"Bộ lọc"** (icon phễu + badge
  đếm số filter đang chọn, màu `--error`) · dropdown **Sắp xếp** · (tìm kiếm đã có ở header).
- Nút "Bộ lọc" mở **drawer bottom-sheet**: trượt từ dưới lên, cao 85vh, bo trên `20px`,
  header "Bộ lọc" + nút ✕ đóng; các filter group xếp dọc scroll; footer drawer sticky:
  nút Secondary "Xóa tất cả" + nút Primary "Xem N sản phẩm" (N = số kết quả ước tính).
- Grid 2 cột, gap 12px; pagination gọn (prev/next + "Trang 1/5").

---

## §2. Chi tiết từng khối

### 2.1 Breadcrumb → FR-002
- `Trang chủ / Sofa` — 13px, muted; "Trang chủ" là link; mục hiện tại 600 `--text`.
- Danh mục con (2 cấp — FR-021): `Trang chủ / Tủ & Kệ / Tủ quần áo`.

### 2.2 Tiêu đề + số lượng
- H1: tên danh mục 28px/800 (mobile 22px).
- Dưới H1: `{total} sản phẩm` 14px muted — cập nhật theo filter (VD: `18 sản phẩm`).
- Mô tả ngắn danh mục (nếu có, từ `Category.description`): 14px muted, clamp 2 dòng. **[Tùy chọn]**

### 2.3 Toolbar (trên grid)
- Trái: chips các filter đang áp dụng (mỗi chip: `Giá: 5–10 triệu ✕`); cuối hàng link
  "Xóa tất cả" khi có ≥1 filter.
- Phải: Sort dropdown (§0). Mặc định: `Bán chạy nhất` (popular).
- Không có filter nào → hàng chips ẩn, toolbar chỉ còn sort (canh phải).

### 2.4 Grid sản phẩm → F-002 output
- ProductCard tái dùng nguyên xi (§3 trang-chu): "Giá từ" = min giá **màu còn hàng**;
  sản phẩm hết toàn bộ màu **vẫn hiện** với overlay "Hết hàng" (F-002 business rule),
  click vẫn vào chi tiết.
- Desktop 3 cột / tablet 3 cột / mobile 2 cột; gap 20px (mobile 12px).
- Mỗi card hiện badge như trang chủ (MỚI/BÁN CHẠY/-%/Hết hàng).

### 2.5 Phân trang → FR-002 (`size` mặc định 24)
- 24 sản phẩm/trang; numbered pages + prev/next; trang hiện tại highlight.
- Đổi trang → scroll mượt về đầu grid + cập nhật `page` trong URL (§4).
- 1 trang duy nhất → ẩn pagination.
- **Demo:** dùng page size 8 để duyệt được phân trang (ghi rõ "demo-only", production = 24).

### 2.6 Toggle "Chỉ hiện hàng còn sẵn"
- Đặt trên cùng sidebar (desktop) / đầu drawer (mobile): switch + nhãn
  `Chỉ hiện sản phẩm còn hàng` 14px/600.
- Bật → ẩn các sản phẩm hết toàn bộ màu (phục vụ US-002: "không mất thời gian vào
  món không mua được"). Mặc định: TẮT (đúng F-002: hết hàng vẫn hiện + nhãn).

---

## §3. Các nhóm filter → FR-003, F-002 input

Thứ tự sidebar: Tình trạng → Khoảng giá → Màu sắc → Chất liệu → Kích thước.

### 3.1 Khoảng giá (`priceMin`, `priceMax`)
- 5 preset radio: `Dưới 1 triệu` · `1 – 5 triệu` · `5 – 10 triệu` · `10 – 20 triệu` · `Trên 20 triệu`.
- Dòng "Tùy chỉnh": 2 ô input số `Từ` / `Đến` (triệu đồng) + nút "Áp dụng" (Secondary nhỏ).
- Chọn preset → điền vào 2 ô; nhập tay → bỏ chọn preset. Debounce 500ms khi gõ.
- Giá so theo **"giá từ"** của sản phẩm (min giá màu còn hàng) — VD: sofa 12.900.000đ
  không lọt filter "5–10 triệu" (đúng US-002: sofa dưới 10 triệu).

### 3.2 Màu sắc (`colors[]`)
- Dạng **chấm màu** 28px (dùng `colorHex` từ variant) + tên màu 13px dưới chấm;
  wrap nhiều hàng, gap 10px.
- Chỉ liệt kê các màu **xuất hiện trong danh mục hiện tại** (dynamic từ API).
- Màu hết hàng ở mọi sản phẩm → chấm mờ 40% + disabled.
- Chọn nhiều màu (OR). Màu đang chọn: viền `--brand-700` 2px + tick.
- Danh sách màu mẫu: Xám, Be, Nâu, Trắng, Đen, Xanh rêu, Vàng sồi, Nâu óc chó,
  Tự nhiên, Hồng pastel, Xanh, Vàng đồng.

### 3.3 Chất liệu (`materials[]`)
- Checkbox list: `Vải bố` · `Gỗ sồi` · `Gỗ óc chó` · `Gỗ MDF` · `Gỗ tự nhiên` ·
  `Da bò Ý` · `Kim loại` · `Kính` · `Vải` (dynamic: chỉ hiện chất liệu có trong danh mục).
- Lấy từ `specs["Chất liệu"]` / `materialNote` của sản phẩm. Chọn nhiều (OR).

### 3.4 Kích thước (`sizes[]`)
- Radio theo chiều dài lớn nhất (`lengthM`): `Nhỏ (dưới 1m)` · `Vừa (1 – 2m)` · `Lớn (trên 2m)`.
- Hiển thị gợi ý: VD `Lớn (trên 2m)` kèm muted `(sofa góc, giường 1m8…)`.

### 3.5 Hành vi chung các filter
- Mỗi lần đổi filter: `page` reset về 1; cập nhật URL query (§4); refetch; skeleton
  ngắn (300ms) cho grid — không reload trang.
- Đếm số filter đang chọn → badge trên nút "Bộ lọc" (mobile) + text nút drawer
  "Xem N sản phẩm".

---

## §4. URL query contract (share link được) → F-002 input

```
/danh-muc/:slug?priceMin=5000000&priceMax=10000000&colors=Xám,Be&materials=Vải bố
            &sizes=vua&sort=price_asc&page=2&inStock=true
```

| Param | Map tới F-002 | Ghi chú |
|---|---|---|
| `priceMin`, `priceMax` | `filter.priceMin/priceMax` | VND, số nguyên |
| `colors` | `filter.colors[]` | cách nhau dấu phẩy, URL-encode |
| `materials` | `filter.materials[]` | cách nhau dấu phẩy |
| `sizes` | `filter.sizes[]` | `nho`/`vua`/`lon` |
| `sort` | `sort` | `popular`/`price_asc`/`price_desc`/`newest` |
| `page` | `page` | mặc định 1 |
| `inStock` | — | `true` = bật toggle §2.6 |

- Mở link có query → restore đầy đủ trạng thái filter/sort/page (deep-link).
- Back/forward trình duyệt → khôi phục đúng (dùng history API, không reload).

---

## §5. Trạng thái loading / empty / error (bắt buộc đủ 3)

| Khối | Loading | Empty | Error |
|---|---|---|---|
| Sidebar filter | 4 skeleton group shimmer | — (filter luôn có khi có danh mục) | Ẩn sidebar, hiện filter tối thiểu* |
| Grid sản phẩm | 8 skeleton card shimmer (tái dùng) | **Empty state §5.1** | Inline: ⚠️ `Không tải được sản phẩm` + nút `Thử lại` |
| Pagination | Ẩn tạm | Ẩn | Ẩn |

\* Nếu API filter lỗi: hiện 2 group cơ bản (Khoảng giá preset + Sắp xếp) để trang vẫn dùng được.

### 5.1 Empty state — "không có kết quả" (F-002 edge case)
- Icon kính lúp + ghế (SVG outline, màu `--border`, 64px), căn giữa, padding 48px.
- Tiêu đề 18px/700: `Không tìm thấy sản phẩm phù hợp`
- Mô tả 14px muted: `Thử nới khoảng giá hoặc bỏ bớt điều kiện lọc nhé.`
- Liệt kê chips filter đang dùng (để user thấy vì sao trống).
- Nút Primary: `Xóa tất cả bộ lọc` → reset về danh mục gốc.
- Gợi ý thêm (link): `Xem tất cả sofa` (bỏ filter giữ danh mục).

---

## §6. Dữ liệu mẫu

### 6.1 Dùng tiếp từ `homeMock.js` (12 sản phẩm — đúng tên/giá/màu đã có)
Sofa góc L Nordic (12.900.000đ) · Giường ngủ gỗ óc chó 1m8 (từ 14.900.000đ) ·
Bàn trà gỗ sồi (3.450.000đ) · Tủ quần áo 3 cánh (8.900.000đ) · Sofa da bò Ý — Hết hàng ·
Ghế ăn bọc vải (1.250.000đ) · Kệ tivi gỗ tự nhiên (4.200.000đ) · Bàn làm việc chân sắt (2.750.000đ) ·
Sofa băng 2 chỗ (9.800.000đ, -15%) · Đèn sàn trang trí (890.000đ) · Bàn console hành lang (3.100.000đ) ·
Ghế lười hạt xốp (650.000đ).

### 6.2 Bổ sung cho demo lọc/phân trang (builder thêm vào mock, shape y hệt ERD)
| # | Tên | Danh mục | Giá từ | Màu (còn hàng) | Chất liệu | Dài (m) |
|---|---|---|---|---|---|---|
| 13 | Sofa vải 3 chỗ | Sofa | 7.500.000đ | Xám, Be | Vải bố | 2.1 |
| 14 | Bàn ăn gỗ sồi 6 ghế | Bàn ăn | 12.400.000đ | Tự nhiên | Gỗ sồi | 1.8 |
| 15 | Bàn ăn mặt đá 4 ghế | Bàn ăn | 8.900.000đ | Trắng, Đen | Đá + kim loại | 1.4 |
| 16 | Giường 1m6 gỗ sồi | Giường ngủ | 11.200.000đ | Vàng sồi | Gỗ sồi | 2.0 |
| 17 | Tủ quần áo 2 cánh | Tủ quần áo | 6.500.000đ | Trắng, Nâu | Gỗ MDF | 1.2 |
| 18 | Kệ sách gỗ 5 tầng | Kệ tivi* | 3.200.000đ | Tự nhiên | Gỗ tự nhiên | 0.9 |
| 19 | Bàn làm việc chữ L | Bàn làm việc | 4.500.000đ | Trắng, Gỗ | Gỗ + sắt | 1.4 |
| 20 | Ghế xoay văn phòng | Ghế | 2.200.000đ | Đen, Xám | Vải + nhựa | 0.65 |
| 21 | Đèn bàn học | Đèn & Decor | 550.000đ | Trắng, Đen | Kim loại | 0.4 |
| 22 | Gương trang trí tròn | Đèn & Decor | 1.100.000đ | Vàng đồng | Kính + kim loại | 0.8 |
| 23 | Tủ giày thông minh | Tủ quần áo | 2.300.000đ | Trắng, Nâu | Gỗ MDF | 0.9 |

\* Kệ sách tạm xếp vào "Kệ tivi" (danh mục kệ chung) — chờ admin tạo danh mục "Kệ sách" ở màn admin.

**Kịch bản demo lọc (builder dựng sẵn để user bấm thử):**
1. Vào `/danh-muc/sofa` → chọn preset `5 – 10 triệu` + sort `Giá: Thấp đến cao` →
   ra: Sofa vải 3 chỗ (7.5tr), Sofa băng 2 chỗ (9.8tr) — đúng US-002 (dưới 10 triệu).
2. Thêm màu `Xám` → chỉ còn 2 sản phẩm trên (cả 2 đều có màu Xám còn hàng).
3. Bật `Chỉ hiện sản phẩm còn hàng` → Sofa da bò Ý (hết hàng) biến mất.
4. Filter vô nghiệm: Bàn ăn + `Dưới 1 triệu` → empty state §5.1 + nút xóa filter.

---

## §7. Tương tác & animation

- Đổi filter/sort: grid fade nhẹ 200ms rồi render kết quả mới (không giật layout —
  giữ chiều cao tối thiểu grid).
- Chips: thêm/xóa với scale-in 150ms.
- Drawer mobile: trượt 300ms ease-out; nền mờ đen 40%; vuốt xuống để đóng.
- Scroll lên đầu grid khi đổi trang/sort (smooth).
- Sticky: sidebar `top: 140px` (dưới header sticky); toolbar mobile sticky `top: 64px`.
- Tôn trọng `prefers-reduced-motion` như trang-chu §4.

---

## §8. Mapping traceability (spec → docs)

| Spec item | Nguồn |
|---|---|
| Danh sách theo danh mục + phân trang 24/trang | FR-002, F-002 |
| Filter khoảng giá / màu sắc / chất liệu / kích thước | FR-003, F-002 input |
| Sắp xếp: giá tăng/giảm, bán chạy, mới nhất | FR-003, F-002 `sort` |
| "Giá từ" = min giá màu còn hàng | F-002 business rule |
| Hết hàng vẫn hiện + nhãn (mặc định) | F-002 business rule |
| Filter rỗng → gợi ý nới điều kiện + xóa filter | F-002 edge case |
| Breadcrumb, tiêu đề + số lượng | FR-002 |
| Toggle "chỉ còn hàng" | US-002 (không mất thời gian vào món hết hàng) |
| URL query share được | F-002 input (suy ra từ contract API) |
| Màu sắc theo `colorHex`, biến thể cấp màu | 02-ERD ProductVariant, QĐ 2026-10-10 |
| Kích thước theo `lengthM` | 02-ERD ProductVariant |
| Design system, ProductCard, Skeleton, tone TV | trang-chu.md §0 (tái dùng) |
| Demo page size 8 | **[Demo-only — production giữ 24 theo F-002]** |
