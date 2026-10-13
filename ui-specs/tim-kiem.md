# Spec giao diện — Tìm kiếm (tim-kiem)

- **Dự án:** noi-that-shop · **Màn:** Tìm kiếm (màn 3/22)
- **Nguồn:** US-003 · FR-004 · F-003 · Entities: Product, Category
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Ghi chú:** Trang kết quả **tái dùng toàn bộ layout + filter của màn Danh mục**
  (danh-muc.md) — chỉ khác nguồn dữ liệu (F-003 thay vì F-002) và thêm các khối
  đặc thù tìm kiếm (§2–§3).

---

## §0. Design system — TÁI DÙNG NGUYÊN XI

Áp dụng toàn bộ `trang-chu.md` §0 (tokens, Be Vietnam Pro, Button/Badge/ProductCard/
Skeleton, tone tiếng Việt, giá `vi-VN + đ`) và toàn bộ component của `danh-muc.md` §0
(FilterSidebar, FilterDrawer, SortDropdown, Pagination, ActiveFilterChips, Filter group).
Không phát minh style mới.

**Component mới của màn này (định nghĩa 1 lần):**
- **Search dropdown (ô tìm kiếm header):** panel trắng bo `16px`, shadow
  `0 12px 28px rgba(62,42,30,.12)`, rộng bằng ô search (min 320px); section title
  13px/700 muted uppercase; item 14px, padding `10px 12px`, hover nền `#F5EFE6`.
- **Highlight từ khóa:** `<mark>` nền `#FBF3DC` (vàng nhạt), chữ `--text` giữ nguyên,
  bo `3px` — dùng trong tên sản phẩm ở kết quả.
- **Tag tìm kiếm phổ biến:** chip bo `999px`, nền `#F5EFE6`, chữ 13px/600; hover:
  viền `--brand-700`.

---

## §1. Bố cục tổng thể

### 1.1 Ô tìm kiếm ở header (nâng cấp từ trang-chu §2.2)
Giữ nguyên vị trí/style ô search hiện tại trong `Header.jsx`. Thêm dropdown gợi ý:

```
┌──────────────────────────────────────────┐
│ 🔍 Tìm kiếm sofa, bàn ăn, giường ngủ…  ✕ │  ← focus → mở dropdown
├──────────────────────────────────────────┤
│ TÌM KIẾM GẦN ĐÂY              Xóa tất cả │
│ 🕘 sofa góc L                              │  ← click → tìm lại
│ 🕘 bàn trà gỗ                              │
│ TÌM KIẾM PHỔ BIẾN                        │
│ [sofa] [bàn ăn] [giường ngủ] [tủ quần áo] │
│ [đèn trang trí]                           │
└──────────────────────────────────────────┘
```

Khi đang gõ (≥2 ký tự, debounce 300ms) → dropdown chuyển sang **gợi ý trực tiếp**:
```
│ 🔍 ghế…                                  │
├──────────────────────────────────────────┤
│ SẢN PHẨM GỢI Ý                           │
│ [ảnh 40px] Ghế ăn bọc vải — từ 1.250.000đ │
│ [ảnh 40px] Ghế xoay văn phòng — từ 2.200.000đ │
│ [ảnh 40px] Ghế lười hạt xốp — từ 650.000đ │
│ DANH MỤC                                 │
│ Ghế (3 sản phẩm) →                       │
│ Xem tất cả kết quả cho "ghế" →           │  ← = Enter
└──────────────────────────────────────────┘
```
- Tối đa 6 sản phẩm + 3 danh mục trong gợi ý trực tiếp.
- Click sản phẩm → trang chi tiết (FR-005, màn sau); click "Xem tất cả" / Enter →
  `/tim-kiem?q=ghế`.
- Phím ↑/↓ di chuyển giữa các gợi ý, Enter chọn, Esc đóng dropdown.
- Click ngoài / blur (delay 150ms cho kịp click) → đóng dropdown.

### 1.2 Trang kết quả `/tim-kiem?q=...`
Tái dùng layout `danh-muc.md` §1 nguyên xi (breadcrumb → sidebar/drawer → toolbar →
grid → pagination → footer), thay 2 điểm:

```
Breadcrumb: Trang chủ / Tìm kiếm
┌─────────────────────────────────────────────────────┐
│ Kết quả cho "bàn trà gỗ"              │  ← H1 28px/800, từ khóa trong ngoặc kép
│ 3 sản phẩm                           │  ← 14px muted
├─────────────────────────────────────────────────────┤
│ ... (sidebar / toolbar / grid / pagination y hệt    │
│      danh mục; ProductCard có highlight từ khóa)     │
└─────────────────────────────────────────────────────┘
```
- Breadcrumb: `Trang chủ / Tìm kiếm` (không có cấp danh mục).
- H1: `Kết quả cho "<q>"` — q hiển thị nguyên văn user gõ (có dấu hay không).
- Toolbar/sort/filter/pagination: **giống hệt danh mục**, sort mặc định = `Liên quan nhất`
  (thay vì `Bán chạy nhất`) — xem §3.2.

### 1.3 Trang `q` rỗng → trang gợi ý (F-003 edge case)
Mở `/tim-kiem` không có `q` (hoặc `q` toàn khoảng trắng) → **KHÔNG trả toàn bộ catalog**
(đúng F-003: `q` rỗng → trả về rỗng). Hiện trang gợi ý:
- H1: `Bạn đang tìm gì?` 28px/800.
- Khối `Tìm kiếm phổ biến`: 8–10 tag (§0).
- Khối `Danh mục nổi bật`: tái dùng CategoryGrid trang chủ (8 ô).
- Khối `Sản phẩm nổi bật`: 4 ProductCard (tái dùng khối trang chủ).
- Không có sidebar filter / sort / pagination ở trạng thái này.

---

## §2. Chi tiết khối đặc thù tìm kiếm

### 2.1 "Ý bạn là...?" — gợi ý chính tả
- Khi kết quả = 0 **và** tìm được từ gần đúng (khoảng cách Levenshtein ≤ 2 so với từ
  trong từ điển: tên sản phẩm + tên danh mục + từ khóa phổ biến):
- Hiện ngay dưới H1, 15px: `Ý bạn là: `**`sofa`**`?` (từ gợi ý là link `--brand-700` 700,
  click → tìm lại với từ đúng).
- VD: `soffa` → `sofa`; `ghe an` → `ghế ăn`; `tu ao` → `tủ áo`.
- Không tìm được từ gần đúng → bỏ qua khối này (xuống empty state §5.1).

### 2.2 Highlight từ khóa trong kết quả
- Trong **tên sản phẩm** của mỗi ProductCard: bọc phần khớp từ khóa bằng `<mark>` (§0).
- Khớp không phân biệt dấu/hoa-thường: tìm `ban tra go` → highlight `Bàn trà gỗ` trong
  `Bàn trà gỗ sồi`.
- Từ khóa nhiều từ: highlight từng từ khớp (VD `sofa xám` → highlight cả `Sofa` và `xám`
  nếu tên chứa cả hai).
- Không highlight trong giá/badge/mô tả rút gọn (giữ card gọn như danh mục).

### 2.3 Lịch sử tìm kiếm gần đây
- Lưu `localStorage` key `nts_recent_searches`: mảng chuỗi, tối đa 8, mới nhất đầu;
  lưu khi user **submit** tìm kiếm (Enter / click "Xem tất cả"), không lưu khi chỉ click
  gợi ý sản phẩm.
- Item có icon 🕘 + nút ✕ xóa từng mục; link `Xóa tất cả` xóa cả danh sách.
- Trùng từ khóa (chuẩn hóa không dấu để so) → đưa lên đầu, không trùng lặp.
- Ẩn section khi danh sách rỗng.

### 2.4 Tìm kiếm phổ biến
- Danh sách cố định (admin cấu hình được ở phase sau — hiện tại hardcode theo spec):
  `sofa`, `bàn ăn`, `giường ngủ`, `tủ quần áo`, `kệ tivi`, `bàn làm việc`,
  `ghế ăn`, `đèn trang trí`.
- Click tag → tìm ngay với từ đó.

---

## §3. Logic tìm kiếm (client demo — mirror backend F-003)

### 3.1 Chuẩn hóa không dấu
- Hàm `normalizeVi(s)`: lowercase → NFD → bỏ dấu tổ hợp → `đ`→`d`, `Đ`→`D`.
- Mọi so khớp đều chạy trên chuỗi đã chuẩn hóa (VD `ban tra go` khớp `Bàn trà gỗ sồi`).

### 3.2 Xếp hạng liên quan (sort mặc định `Liên quan nhất`)
Điểm tính trên chuỗi chuẩn hóa, từ cao xuống thấp:
1. **Tên sản phẩm chứa nguyên cụm** `q` (VD `ban tra go` trong `ban tra go soi`): +100.
2. **Tên danh mục chứa** `q`: +60.
3. **Tên sản phẩm chứa tất cả các từ** của `q` (không cần liền nhau): +40.
4. **Mô tả chứa** `q`: +20.
5. **Tên sản phẩm chứa một phần số từ** của `q`: +10 × số từ khớp.
- Hòa điểm → `soldCount` 30 ngày cao hơn xếp trước (nhất quán F-001).
- Sort dropdown thêm option đầu: `Liên quan nhất` (chỉ hiện ở màn tìm kiếm;
  chọn sort khác → bỏ xếp hạng liên quan, dùng sort đã chọn như danh mục).

### 3.3 Quy tắc khác (đúng F-003)
- `q` rỗng → trả rỗng + trang gợi ý §1.3 (không trả catalog).
- Tìm trên 3 trường: `name`, `description`, tên category (FR-004).
- Kết quả vẫn đi qua **đủ 5 nhóm filter + sort + phân trang** của danh mục
  (filter áp sau khi có tập kết quả tìm kiếm).
- Sản phẩm hết hàng: hiện + overlay như danh mục (F-002 business rule tái dùng).

---

## §4. URL query contract

```
/tim-kiem?q=b%C3%A0n+tr%C3%A0+g%E1%BB%97&sort=relevance&page=1&colors=Xám&inStock=true
```

| Param | Nguồn | Ghi chú |
|---|---|---|
| `q` | F-003 input | bắt buộc để hiện kết quả; rỗng/thiếu → trang gợi ý §1.3 |
| `sort` | mở rộng F-002 | thêm `relevance` (mặc định ở màn này) |
| `page`, `priceMin`, `priceMax`, `colors`, `materials`, `sizes`, `inStock` | danh-muc §4 | tái dùng nguyên xi |

- Đổi `q` (tìm mới) → reset page=1, **giữ nguyên filter** đang chọn **[Quyết định UX]**.
- Deep-link `/tim-kiem?q=sofa&sort=price_asc` → restore đầy đủ.

---

## §5. Trạng thái loading / empty / error

| Khối | Loading | Empty | Error |
|---|---|---|---|
| Dropdown gợi ý header | 3 skeleton dòng shimmer | Ẩn dropdown | Ẩn dropdown (gõ Enter vẫn tìm được) |
| Grid kết quả | 8 skeleton card (tái dùng) | **Empty state §5.1** | Inline ⚠️ + `Thử lại` (tái dùng) |
| Trang gợi ý (q rỗng) | skeleton 3 khối | — (luôn có nội dung) | như grid |

### 5.1 Empty state — "không tìm thấy"
- Icon kính lúp 64px (tái dùng style danh-muc §5.1).
- Tiêu đề 18px/700: `Không tìm thấy kết quả cho "<q>"`
- Khối `Ý bạn là...?` (§2.1) nếu có — đặt ngay dưới tiêu đề.
- Mô tả 14px muted: `Thử kiểm tra chính tả hoặc dùng từ khóa khác nhé.`
- Tag tìm kiếm phổ biến (§2.4) để user bấm tiếp.
- Khối `Có thể bạn thích`: 4 ProductCard bán chạy (tái dùng).
- Nút Secondary: `Xóa tìm kiếm` → về trang gợi ý §1.3.

---

## §6. Dữ liệu mẫu & kịch bản demo

Dùng 23 sản phẩm trong `mocks/homeMock.js` (đã có từ màn 2).

**Kịch bản demo (builder dựng sẵn để user bấm thử):**
1. **US-003:** gõ `ban tra go` ở ô search header → Enter → `Bàn trà gỗ sồi` đứng đầu
   kết quả, từ `Bàn trà gỗ` được highlight.
2. **Chính tả:** gõ `soffa` → 0 kết quả + `Ý bạn là: sofa?` → click → ra kết quả sofa.
3. **Dropdown:** focus ô search khi trống → hiện "Tìm kiếm gần đây" + "Tìm kiếm phổ biến";
   gõ `ghế` → gợi ý trực tiếp hiện 3 ghế + danh mục `Ghế`.
4. **q rỗng:** mở `/tim-kiem` (không q) → trang gợi ý, không hiện catalog.
5. **Filter sau tìm:** tìm `bàn` → chọn filter màu `Trắng` → kết quả thu hẹp, URL cập nhật.
6. **Sort:** tìm `sofa` → sort `Giá: Thấp đến cao` → Sofa vải 3 chỗ (7.5tr) lên đầu.

---

## §7. Tương tác & animation

- Dropdown: fade + trượt xuống 150ms; đóng khi Esc/click ngoài.
- Gõ ô search: debounce 300ms mới gọi gợi ý (không debounce khi Enter).
- Đổi filter/sort/page: giữ nguyên hành vi danh-muc §7 (fade grid 200ms, scroll về đầu grid).
- Highlight `<mark>`: không animation (tránh rối mắt).
- Tôn trọng `prefers-reduced-motion` như trang-chu §4.

---

## §8. Mapping traceability (spec → docs)

| Spec item | Nguồn |
|---|---|
| Tìm theo từ khóa trên tên/mô tả/danh mục | FR-004, F-003 |
| Xếp theo độ liên quan | F-003 output |
| Không dấu vẫn ra có dấu | F-003 business rule, US-003 |
| `q` rỗng → trả rỗng + trang gợi ý (không trả catalog) | F-003 edge case |
| Route `/tim-kiem?q=`, Enter từ ô search header | FR-004, Header.jsx hiện có |
| `ban tra go` → `Bàn trà gỗ sồi` đứng đầu | US-003 acceptance |
| Layout/filter/sort/phân trang/3 trạng thái tái dùng | danh-muc.md (F-002, FR-002, FR-003) |
| Highlight từ khóa | **[Mở rộng UX từ F-003 — không trái docs]** |
| "Ý bạn là...?" | **[Mở rộng UX — suy ra từ US-003 "gõ sai vẫn ra đúng"]** |
| Lịch sử tìm kiếm (local) | **[Mở rộng UX — dữ liệu local, không chạm BE]** |
| Tìm kiếm phổ biến | **[Mở rộng UX — admin cấu hình được phase sau]** |
| Design system, ProductCard, tone TV | trang-chu.md §0 (tái dùng) |
