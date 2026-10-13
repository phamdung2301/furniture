# Spec giao diện — Chi tiết sản phẩm (chi-tiet-san-pham)

- **Dự án:** noi-that-shop · **Màn:** Chi tiết sản phẩm (màn 4)
- **Nguồn:** US-004 · FR-005 · FR-006 · F-004 · F-012 (+ FR-017, FR-018 cho đánh giá/wishlist)
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Ghi chú:** Tái dùng nguyên design system spec Trang chủ §0 (tokens, typography, Button/Badge/ProductCard/SectionHeader/Skeleton). Không phát minh style mới. Component mới của màn này: Gallery, ColorSelector, QtySelector, Tabs, ReviewCard, QuickViewModal (modal dùng chung cho homepage/category sau này).

---

## §1. Bố cục tổng thể (top → bottom)

1. Breadcrumb: `Trang chủ / {Tên danh mục} / {Tên sản phẩm}` (link 2 mục đầu)
2. Khối mua hàng — 2 cột desktop (trái: gallery 7/12 · phải: thông tin mua 5/12)
3. Tabs: `Mô tả` | `Thông số kỹ thuật` | `Đánh giá (N)`
4. Khối "Sản phẩm liên quan" (≤8, ProductCard có sẵn)
5. (Mobile) Sticky bottom bar: giá + nút "Thêm vào giỏ" — hiện khi scroll qua khối mua hàng

Route: `/san-pham/:slug` · deep-link màu: `?mau=<colorSlug>` (VD: `?mau=xam`).

---

## §2. Gallery (cột trái)

- Ảnh chính tỉ lệ `4/3`, bo `16px`, `object-fit: cover`.
- Thumbnails: hàng ngang dưới ảnh chính (desktop) / dots (mobile); thumb active viền `--brand-700` 2px.
- Hover ảnh chính (desktop): zoom `scale(1.6)` theo vị trí chuột (transform-origin theo cursor).
- Arrows prev/next 2 bên (hiện khi hover desktop, luôn hiện mobile nếu >1 ảnh); vuốt ngang mobile; phím ←/→.
- Badge góc trái trên ảnh chính: `BÁN CHẠY` / `MỚI` / `-%` (tái dùng Badge spec).
- **Ảnh theo màu:** variant có thể có `images[]` riêng → chọn màu đổi gallery sang ảnh của màu đó; không có → fallback ảnh chung của sản phẩm (F-004/US-004: "ảnh hiển thị theo màu").
- 1 ảnh duy nhất → ẩn arrows/thumbnails.

## §3. Panel thông tin mua (cột phải)

1. **Tên sản phẩm:** H1 24px/700.
2. **Rating tóm tắt:** `★★★★★ 4.8` (sao `--accent`) + link `(126 đánh giá)` muted → click scroll tới tab Đánh giá và active tab (FR-006).
3. **Đã bán:** `Đã bán 340` muted, cạnh rating.
4. **Giá:** 28px/800 màu `--brand-700` = giá của **màu đang chọn** (không phải "Giá từ" — trang chi tiết hiện giá chính xác theo màu). Giá gốc gạch ngang + badge `-%` nếu có giảm.
5. **Chọn màu sắc** (US-004, F-004):
   - Label: `Màu sắc: **Xám**` (tên màu đang chọn).
   - Chấm màu 28px (dùng `colorHex`), viền; màu đang chọn: viền `--brand-700` 2px + ring ngoài.
   - Màu hết hàng (`stock = 0`): chấm mờ 40% + gạch chéo, **không click được** (F-004: disable).
   - **Mặc định:** màu còn hàng **rẻ nhất** (bằng giá → màu đầu tiên theo sortOrder).
   - `?mau=` hợp lệ → chọn màu đó; không hợp lệ → fallback mặc định.
   - Đổi màu → cập nhật đồng thời: giá, tồn kho, gallery ảnh, URL `?mau=`.
6. **Tồn kho** (dùng `lowStockThreshold` của variant):
   - `stock > threshold` → `Còn hàng` (chữ `--success`, kèm icon ✓).
   - `0 < stock ≤ threshold` → `Chỉ còn X sản phẩm` (chữ `--warning`).
   - `stock = 0` → `Hết hàng` (chữ `--error`); **disable cả 2 nút mua** (F-004).
7. **Số lượng:** stepper −/+ , `1 ≤ qty ≤ stock` của màu đang chọn; nhập tay clamp vào khoảng; đổi màu → reset qty = 1 nếu qty cũ > stock mới.
8. **CTA:**
   - Nút Primary full-width: `Thêm vào giỏ hàng`.
   - Nút Secondary full-width: `Mua ngay` → thêm vào giỏ + chuyển sang checkout (màn sau).
   - Icon tim (wishlist) cạnh nút: FR-018/F-013 — click toggle, tooltip `Thêm vào yêu thích`.
   - Cả 2 nút disabled khi màu hết hàng.
9. **Cam kết** (list icon, 14px):
   - `🚚 Miễn phí vận chuyển cho đơn từ 10.000.000đ`
   - `🛡️ Bảo hành {X} tháng` (lấy từ specs)
   - `↩️ Đổi trả trong 7 ngày`
10. **Thông tin thêm:** `Danh mục: {tên}` (link) · `Chất liệu: {…}` (từ specs). **Không hiển thị SKU** (mã nội bộ — copy-ux-linter).

---

## §4. Tabs

Tab header: chữ 16px/600, tab active chữ `--brand-700` + gạch dưới `--accent` 3px; nội dung padding 24px 0.

### 4.1 Tab "Mô tả"
- Đoạn văn mô tả sản phẩm (giữ định dạng dòng, 15px/1.6). Có thể chứa ảnh minh họa xen kẽ (tối đa 3, full-width bo 12px).

### 4.2 Tab "Thông số kỹ thuật"
- Bảng 2 cột: `Thuộc tính | Giá trị` — lấy từ `Product.specs` (Kích thước, Chất liệu, Bảo hành, Xuất xứ, Trọng lượng...) + hàng `Kích thước chiếm chỗ: {lengthM} × {widthM} m` (phục vụ hiểu phí ship FR-029 — hiển thị, không tính ở đây).
- Hàng xen kẽ nền `#F7F1E8`.

### 4.3 Tab "Đánh giá (N)" (FR-006, FR-017, F-012)
- **Tóm tắt:** điểm TB lớn (36px/800) + sao + `dựa trên N đánh giá`; thanh phân bố 5→1 sao (tỉ lệ %).
- **Nút "Viết đánh giá"** (Secondary):
  - Đủ điều kiện (đã login + có đơn HOÀN THÀNH chứa SP + chưa đánh giá) → mở form (sao + bình luận + ảnh).
  - Chưa đủ → nút vẫn hiện nhưng click mở tooltip/popover giải thích: `Chỉ khách hàng đã mua và nhận hàng mới có thể đánh giá sản phẩm này.` (F-012 business rule — không giấu nút để user hiểu vì sao).
  - Đã đánh giá → nút thành `Sửa đánh giá`.
- **List review:** mỗi item: avatar (chữ cái đầu trong vòng tròn `--brand-700`), tên, sao, ngày (`dd/mm/yyyy`), badge `Đã mua hàng` (xanh lá), bình luận, ảnh review (thumbnail click → lightbox).
- Sắp xếp: mới nhất trước; phân trang 5/trang (client demo) — production phân trang server (Review collection riêng, 02-ERD).
- Empty: `Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ cảm nhận!`

---

## §5. Sản phẩm liên quan

- Section header `Sản phẩm liên quan` (không link "Xem tất cả" — hoặc link tới danh mục).
- Nguồn: cùng `categoryId`, loại trừ SP hiện tại, ≤8 (F-004), ưu tiên `soldCount` cao.
- Dùng nguyên ProductCard (§3 spec trang chủ): click card → chuyển sang `/san-pham/:slug` mới (scroll top, reset màu về mặc định).
- Grid 4 cột desktop / 2 mobile; mobile có thể scroll ngang.

---

## §6. Quick view modal (component dùng chung)

*(Đã hứa ở demo trang chủ — định nghĩa tại đây, homepage/category tái dùng sau.)*
- Trigger: nút `Xem nhanh` hiện khi hover ProductCard (desktop); icon mắt trên card (mobile).
- Modal: 2 cột (trái ảnh 1:1 · phải: tên, rating mini, giá theo màu, chọn màu nhanh (chấm màu), nút `Xem chi tiết` (Primary → sang trang detail) + nút `Thêm vào giỏ` (Secondary, dùng màu đang chọn)).
- Đóng: nút ×, click ngoài, Esc. Không có tabs mô tả/thông số/review trong quick view.

---

## §7. Trạng thái loading / 404 / error

| Trường hợp | Hiển thị |
|---|---|
| Loading | Skeleton: gallery (khối 4/3) + panel (dòng tên, giá, nút) shimmer |
| 404 (slug sai / `active=false` — F-004 edge case) | Trang riêng: icon 🔍 + `Không tìm thấy sản phẩm` + `Sản phẩm có thể đã ngừng bán hoặc đường link không đúng.` + nút Primary `Về trang chủ` + khối "Có thể bạn thích" (4 ProductCard bán chạy) |
| Error tải dữ liệu | Inline trong khối mua hàng: ⚠️ `Không tải được thông tin sản phẩm` + nút `Thử lại` |
| Đổi màu khi ảnh lỗi | Fallback ảnh chung; ảnh chung lỗi → placeholder gradient ấm + icon ghế |

---

## §8. Mobile

- Gallery full-width (tràn container, bo 0), thumbnails → dots.
- Panel mua full-width dưới gallery.
- **Sticky bottom bar:** khi scroll qua khối CTA gốc → bar cố định đáy: `giá màu đang chọn` (trái) + nút Primary `Thêm vào giỏ` (phải); ẩn khi quay lại đầu khối mua hoặc tới footer.
- Tabs → accordion? **Không** — giữ tabs, cho scroll ngang tab header.
- Quick view modal → bottom-sheet full-width.

---

## §9. Tương tác & animation

- Đổi màu: fade giá/ảnh 200ms; chấm màu chọn có scale nhẹ.
- Gallery: crossfade 300ms khi đổi ảnh; zoom hover mượt theo cursor.
- Tabs: underline trượt 250ms ease.
- Scroll tới tab đánh giá: smooth scroll + active tab.
- Tôn trọng `prefers-reduced-motion`.

---

## §10. Dữ liệu mẫu (demo)

**Sản phẩm:** `Sofa góc L Nordic` (`/san-pham/sofa-goc-l-nordic`), danh mục Sofa, badge `BÁN CHẠY`, rating 4.8 (126), đã bán 340.
- Variants (3 màu):
  - Xám `#9AA0A6` — 12.900.000đ — stock 12 — SKU SF-NRD-XAM *(mặc định: rẻ nhất + còn hàng)*
  - Be `#E8DCC8` — 12.900.000đ — stock 8 — SKU SF-NRD-BE
  - Nâu `#7B5E42` — 13.400.000đ — stock 5 — SKU SF-NRD-NAU
- Specs: Kích thước 2.4m × 1.6m · Chất liệu Vải bố · Bảo hành 24 tháng · Xuất xứ Việt Nam.
- Mô tả: 2 đoạn ngắn về vải bố, đệm mút, chân gỗ.
- Reviews mẫu (5):
  1. Minh Anh ★5 `12/09/2026` "Sofa ngồi êm, vải bố dày dặn hơn mong đợi. Giao hàng cẩn thận." + 2 ảnh, badge Đã mua hàng
  2. Hoàng Nam ★5 `28/08/2026` "Màu xám đẹp, hợp phòng khách chung cư. Lắp đặt nhanh."
  3. Thu Hằng ★4 `15/08/2026` "Đệm hơi cứng tuần đầu, sau thì êm. Shop tư vấn nhiệt tình."
  4. Đức Huy ★5 `02/08/2026` "Đóng gói kỹ, không một vết xước. Sẽ ủng hộ tiếp."
  5. Lan Phương ★3 `20/07/2026` "Giao hơi chậm 2 ngày so với hẹn, nhưng sản phẩm ổn."
- Phân bố: 5★ 78% · 4★ 15% · 3★ 5% · 2★ 1% · 1★ 1%.
- Liên quan: 4–8 SP cùng danh mục Sofa từ mock (Sofa vải 3 chỗ, Sofa băng 2 chỗ, Sofa da bò Ý...).
- **Case demo thêm:** màu Nâu set stock = 0 trong 1 kịch bản để demo trạng thái hết hàng + disable nút mua.

## §11. Mapping traceability (spec → docs)

| Spec item | Nguồn |
|---|---|
| Gallery + thumbnails + zoom | FR-005 |
| Chọn màu → giá/tồn/ảnh đổi theo màu; mặc định màu còn hàng rẻ nhất; màu hết hàng disable nút mua | F-004, US-004 |
| Không hiển thị SKU | copy-ux-linter (mã nội bộ) |
| Tabs Mô tả / Thông số | FR-005 |
| Tab Đánh giá: điểm TB + list + chỉ khách đã mua đơn HOÀN THÀNH mới được đánh giá | FR-006, FR-017, F-012 |
| Sản phẩm liên quan ≤8 cùng danh mục | F-004, FR-005 |
| 404 khi slug sai / inactive | F-004 edge case |
| Quick view modal | đã hứa ở spec trang chủ §3 (hover "Xem nhanh") |
| Route /san-pham/:slug, ?mau= deep-link | F-004 input |
| Sticky bottom bar mobile | mở rộng UX (không trái docs) |
| Kích thước chiếm chỗ hiển thị ở tab thông số | FR-029 (minh bạch phí ship) |
