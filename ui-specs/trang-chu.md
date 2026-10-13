# Spec giao diện — Trang chủ (trang-chu)

- **Dự án:** noi-that-shop · **Màn:** Trang chủ (màn đầu tiên)
- **Nguồn:** US-001 · FR-001 · F-001 · (header: FR-004, FR-007, FR-014, FR-018) · Entities: Banner, Category, Product, ProductVariant
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Ghi chú:** Đây là màn đầu tiên nên spec này đồng thời đóng vai trò **design system nền móng** (§0) — mọi màn sau tái dùng nguyên xi.

---

## §0. Design system nền móng

### 0.1 Bảng màu (design tokens)

Tông ấm, sang trọng, gợi chất liệu gỗ — hợp ngành nội thất.

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--brand-900` | `#3E2A1E` | Nền footer, top strip, chữ trên nền sáng? không — chỉ nền tối |
| `--brand-700` | `#5D3A29` | **Primary:** nút chính, link active, giá tiền |
| `--brand-600` | `#71472F` | Hover nút chính |
| `--accent` | `#C9A227` | Vàng đồng: sao đánh giá, badge "Bán chạy", điểm nhấn |
| `--bg` | `#FAF7F2` | Nền trang (kem ấm) |
| `--surface` | `#FFFFFF` | Nền card, header |
| `--border` | `#E9DFD2` | Viền card, divider |
| `--text` | `#2B2118` | Chữ chính |
| `--text-muted` | `#8A7A6B` | Chữ phụ, placeholder |
| `--success` | `#2E7D32` | Badge "Mới", trạng thái tốt |
| `--error` | `#C62828` | Badge giảm giá, lỗi |
| `--warning` | `#B7791F` | Cảnh báo |

### 0.2 Typography

- **Font:** `"Be Vietnam Pro"`, fallback `system-ui, sans-serif` (hỗ trợ đầy đủ dấu tiếng Việt, không vỡ chữ).
- **Scale:** Display 32–40px/700 (hero) · H2 section 24px/700 · H3 18px/600 · Body 15px/400 · Small 13px/400 · Giá: 18px/700 màu `--brand-700`.
- **Line-height:** 1.5 body, 1.25 heading.

### 0.3 Tone chữ tiếng Việt

Thân thiện, ấm, xưng "bạn" ngầm định; CTA động từ hành động: "Mua ngay", "Khám phá", "Xem tất cả", "Săn ngay". Không dùng từ kỹ thuật, không mã nội bộ. Giá định dạng `vi-VN` + `đ` (VD: `12.900.000đ`).

### 0.4 Components dùng chung (định nghĩa 1 lần, dùng mọi màn)

- **Nút Primary:** nền `--brand-700`, chữ trắng, bo `10px`, padding `12px 20px`, font 15px/600; hover: nền `--brand-600` + nhấc `translateY(-1px)`; disabled: nền `#C9BBA9`, cursor not-allowed.
- **Nút Secondary (outline):** viền `1px --brand-700`, chữ `--brand-700`, nền trắng; hover: nền `#F5EFE6`.
- **Nút Text/link:** chữ `--brand-700`, 600, kèm `→`; hover gạch chân.
- **Product Card:** nền trắng, bo `16px`, viền `1px --border`; hover: `translateY(-4px)` + shadow `0 12px 28px rgba(62,42,30,.12)`; ảnh tỉ lệ `4/3`, `object-fit: cover`, bo trên `16px`; hover ảnh scale `1.05` (transition 300ms).
- **Badge:** chữ 12px/700, uppercase, bo `999px`, padding `4px 10px`. Loại: `MỚI` (nền `#E8F5E9`, chữ `--success`) · `BÁN CHẠY` (nền `#FBF3DC`, chữ `#8A6D1A`) · `-20%` (nền `--error`, chữ trắng) · `Hết hàng` (overlay ảnh đen 55% + chữ trắng 14px/600 giữa ảnh).
- **Section header:** H2 24px/700 + link "Xem tất cả →" bên phải; khoảng cách khối `56px` desktop / `40px` mobile.
- **Container:** max-width `1200px`, padding ngang `16px`.

---

## §1. Bố cục tổng thể (top → bottom)

1. Top strip (thông báo)
2. Header chính (sticky): logo · ô tìm kiếm · tài khoản · wishlist · giỏ hàng
3. Thanh điều hướng danh mục
4. Hero banner carousel
5. Danh mục nổi bật (≤8)
6. Khối "Sản phẩm nổi bật" (≤10)
7. Khối "Bán chạy nhất" (≤10)
8. Khối "Mới nhất" (≤10)
9. Footer

---

## §2. Chi tiết từng khối

### 2.1 Top strip → FR-001 (bổ trợ)

- Nền `--brand-900`, chữ trắng 13px, 1 dòng, căn giữa.
- Text: `🚚 Miễn phí vận chuyển cho đơn hàng từ 10.000.000đ`
- Phải (desktop): `Hotline: 1900 6868` · `Hệ thống cửa hàng`
- Ẩn trên mobile (giữ lại text promo).

### 2.2 Header chính (sticky) → FR-004, FR-007, FR-014, FR-018

- Nền trắng, sticky top, khi scroll > 8px thêm shadow nhẹ.
- **Logo** trái: chữ "Mộc An" 24px/800 màu `--brand-700` + tagline nhỏ "NỘI THẤT" 11px tracking rộng màu `--text-muted`. *(Đề xuất tên thương hiệu — chờ chủ dự án chốt.)*
- **Ô tìm kiếm** giữa (flex-1, max 480px): bo `999px`, viền `--border`, icon kính lúp trái, placeholder `Tìm kiếm sofa, bàn ăn, giường ngủ…`; Enter → trang tìm kiếm với `q` (F-003).
- **Cụm icon** phải: Tài khoản (icon người + chữ "Tài khoản" 13px; đã login → hiện tên) · Yêu thích (icon tim + badge số) · Giỏ hàng (icon giỏ + badge số lượng, màu `--error`).
- **Mobile:** logo + icon tìm kiếm/giỏ/hamburger; ô search thu gọn thành icon mở rộng.

### 2.3 Thanh điều hướng danh mục

- 1 hàng ngang, chữ 15px/600, item cách nhau 28px: `Trang chủ` · `Sofa` · `Bàn ăn` · `Giường ngủ` · `Tủ & Kệ` · `Bàn làm việc` · `Đèn & Decor` · `Flash sale` (màu `--error`, kèm icon ⚡) · `Khuyến mãi`.
- Hover: chữ `--brand-700` + gạch dưới accent 2px. Click → catalog lọc theo danh mục (F-002).
- Mobile: scroll ngang, ẩn scrollbar.

### 2.4 Hero banner carousel → F-001, US-001

- Tỉ lệ `21/8` desktop, `16/10` mobile; bo `20px`; margin top 24px.
- Banner lấy theo `sortOrder`, chỉ `active=true`; mỗi banner: ảnh nền full + overlay gradient trái (đen 45% → trong suốt) + text block trái: tiêu đề 36px/800 trắng, mô tả 16px trắng 85%, nút Primary theo `linkUrl`.
- Điều khiển: dots dưới giữa (active = thanh dài accent), nút prev/next tròn trắng mờ 2 bên (hiện khi hover desktop), vuốt ngang mobile, phím ←/→.
- **Tương tác:** autoplay 5s, pause khi hover/focus/touch; chuyển slide: crossfade + trượt nhẹ 500ms ease.
- Dữ liệu mẫu 3 banner:
  1. `Khai trương — Giảm đến 20% sofa phòng khách` / `Từ 12/10 đến 31/10 · Áp dụng cho 50+ mẫu sofa` / CTA `Mua ngay` → `/danh-muc/sofa`
  2. `Bộ sưu tập Gỗ Óc Chó 2026` / `Vân gỗ tự nhiên · Bảo hành 5 năm` / CTA `Khám phá` → `/danh-muc/tu-quan-ao`
  3. `⚡ Flash sale cuối tuần` / `Giảm sâu giờ vàng 20h – 22h mỗi tối` / CTA `Săn ngay` → `/flash-sale`

### 2.5 Danh mục nổi bật → F-001 (≤8 danh mục)

- Section header: `Danh mục nổi bật`.
- Grid 8 ô desktop (4 mobile, 2 hàng scroll hoặc wrap): mỗi ô = ảnh tròn/bo `20px` (tỉ lệ 1/1, 120px) + tên danh mục 15px/600 dưới ảnh.
- Hover: ảnh scale 1.06, tên chuyển `--brand-700`. Click → catalog danh mục.
- 8 danh mục mẫu: Sofa · Bàn ăn · Giường ngủ · Tủ quần áo · Kệ tivi · Bàn làm việc · Ghế · Đèn & Decor.

### 2.6 Ba khối sản phẩm → F-001, US-001 (mỗi khối ≤10, chỉ `active=true`)

| Khối | Tiêu đề | Nguồn dữ liệu (F-001) | Link "Xem tất cả" |
|---|---|---|---|
| 1 | `Sản phẩm nổi bật` | `featured=true`, mới cập nhật trước | `/danh-muc?sort=noi-bat` |
| 2 | `Bán chạy nhất` | sắp theo `soldCount` 30 ngày gần nhất | `/danh-muc?sort=ban-chay` |
| 3 | `Mới nhất` | sắp theo `createdAt` giảm dần | `/danh-muc?sort=moi-nhat` |

- Layout: grid 4 cột desktop · 3 tablet · 2 mobile; gap 20px; hiển thị tối đa 8 card desktop (2 hàng) + link xem tất cả (đủ ≤10 theo F-001, giữ trang gọn).
- Mỗi card xem §3.

### 2.7 Footer

- Nền `--brand-900`, chữ `#EDE4D6` 14px; 4 cột desktop / xếp chồng mobile:
  1. Logo "Mộc An" + `Nội thất cho tổ ấm Việt — thiết kế hiện đại, giá xưởng.` + icon mạng xã hội (tròn viền).
  2. `Hỗ trợ khách hàng`: Hướng dẫn mua hàng · Chính sách vận chuyển · Đổi trả & bảo hành · Câu hỏi thường gặp.
  3. `Về chúng tôi`: Giới thiệu · Hệ thống cửa hàng · Tuyển dụng · Liên hệ.
  4. `Liên hệ`: `123 Nguyễn Trãi, Q.5, TP.HCM` · `Hotline: 1900 6868 (8h–21h)` · `hello@mocan.vn`.
- Dòng cuối: `© 2026 Nội Thất Mộc An` + cụm `Thanh toán: COD · Chuyển khoản · MoMo`.

---

## §3. Component: Product Card (chi tiết)

```
┌─────────────────────┐
│ [ảnh 4:3]  [badge]  │  ← badge góc trái trên; "Hết hàng" overlay giữa ảnh
│                     │
│ Sofa góc L Nordic   │  ← tên 15px/600, clamp 2 dòng
│ ★★★★★ 4.8 (126)     │  ← sao accent 14px + số muted 13px
│ Giá từ              │  ← 12px muted (chỉ hiện khi >1 màu)
│ 12.900.000đ         │  ← 18px/700 brand-700
│ ● ● ●  +2 màu       │  ← chấm màu 16px viền (biến thể cấp màu)
└─────────────────────┘
```

- **"Giá từ"** = giá thấp nhất trong các màu còn hàng (F-002 business rule).
- Chấm màu: tối đa 4 chấm + text `+N`; màu hết hàng: chấm mờ 40%.
- Card hết hàng: badge overlay "Hết hàng", toàn card opacity giữ nguyên nhưng không click mua (click vẫn vào chi tiết xem — FR-005 cho xem).
- Hover (desktop): nhấc card + zoom ảnh; hiện nút nhanh `Xem nhanh` (mở modal tóm tắt — thuộc màn chi tiết, không làm ở đây).
- Click card → `/san-pham/:slug` (FR-005).

---

## §4. Tương tác & animation (chung)

- **Scroll reveal:** các khối fade-up `translateY(24px) → 0`, 450ms ease-out, stagger 70ms/card; chạy 1 lần qua IntersectionObserver.
- **Carousel:** như §2.4.
- **Hover:** mọi tương tác hover transition `200–300ms ease`; không animation lòe loẹt — sang, vừa phải.
- **Sticky header:** thêm shadow khi scroll.
- **Back-to-top:** nút tròn `--brand-700` góc phải dưới, hiện sau 600px scroll, smooth scroll về đầu.
- **Giảm chuyển động:** tôn trọng `prefers-reduced-motion` (tắt autoplay/reveal).

---

## §5. Trạng thái loading / empty / error (bắt buộc đủ 3)

| Khối | Loading | Empty | Error |
|---|---|---|---|
| Hero banner | Skeleton khối bo 20px shimmer | **Ẩn cả khối** (F-001 edge case — không vỡ layout) | Ẩn khối, log lỗi |
| Danh mục | 8 skeleton tròn shimmer | Ẩn khối | Inline: `Không tải được danh mục` + nút `Thử lại` |
| Mỗi khối sản phẩm | 4 skeleton card shimmer | **Ẩn khối** (trang chủ không show "trống") | Inline card: icon ⚠️ + `Không tải được sản phẩm` + nút `Thử lại` (gọi lại API khối đó) |
| Header (giỏ/user) | Badge ẩn tạm | — | Giữ icon, không badge |

- Skeleton: nền `#EFE7DA`, shimmer gradient chạy 1.2s.
- Nút `Thử lại`: style Secondary nhỏ.

---

## §6. Dữ liệu mẫu (tiếng Việt, VND, biến thể cấp màu)

**Khối 1 — Sản phẩm nổi bật:**
1. Sofa góc L Nordic — từ `12.900.000đ` — ★4.8 (126) — màu: Xám/Be/Nâu — badge `BÁN CHẠY`
2. Giường ngủ gỗ óc chó 1m8 — từ `15.500.000đ` — ★4.9 (89) — màu: Nâu óc chó/Vàng sồi
3. Bàn trà gỗ sồi — từ `3.450.000đ` — ★4.7 (203) — màu: Tự nhiên/Trắng
4. Tủ quần áo 3 cánh — từ `8.900.000đ` — ★4.6 (77) — màu: Trắng/Nâu/Xám

**Khối 2 — Bán chạy nhất:**
1. Ghế ăn bọc vải — từ `1.250.000đ` — ★4.8 (412) — màu: Xám/Xanh rêu/Be — badge `BÁN CHẠY`
2. Kệ tivi gỗ tự nhiên — từ `4.200.000đ` — ★4.7 (356) — màu: Tự nhiên/Nâu đậm
3. Bàn làm việc chân sắt — từ `2.750.000đ` — ★4.6 (289) — màu: Trắng/Đen/Gỗ
4. Sofa băng 2 chỗ — từ `9.800.000đ` — ★4.7 (264) — màu: Be/Xám — badge `-15%`

**Khối 3 — Mới nhất:**
1. Đèn sàn trang trí — từ `890.000đ` — ★5.0 (12) — màu: Đen/Vàng đồng — badge `MỚI`
2. Tủ giày thông minh — từ `2.300.000đ` — ★4.9 (8) — màu: Trắng/Nâu — badge `MỚI`
3. Bàn console hành lang — từ `3.100.000đ` — ★5.0 (5) — màu: Tự nhiên — badge `MỚI`
4. Ghế lười hạt xốp — từ `650.000đ` — ★4.8 (31) — màu: Xám/Hồng pastel/Xanh — badge `MỚI`

**VD trạng thái Hết hàng (để builder demo badge):** Sofa da bò Ý — `18.500.000đ` — overlay `Hết hàng`.

**Ảnh:** dùng ảnh nội thất thật (image-search skill); fallback: gradient ấm `--bg → --border` + icon ghế. Tỉ lệ 4/3.

---

## §7. Mapping traceability (spec → docs)

| Spec item | Nguồn |
|---|---|
| Hero carousel (sortOrder, active, ẩn khi trống) | F-001, US-001 |
| ≤8 danh mục nổi bật | F-001 |
| 3 khối sản phẩm, mỗi khối ≤10, chỉ active=true | F-001, FR-001, US-001 |
| "Bán chạy" theo soldCount 30 ngày | F-001 business rule |
| "Giá từ" = min giá màu còn hàng | F-002 business rule |
| Chấm màu / biến thể cấp màu | QĐ 2026-10-10 (02-ERD ProductVariant) |
| Ô tìm kiếm header | FR-004, F-003 |
| Icon giỏ hàng + badge | FR-007, F-005 |
| Icon tài khoản | FR-014, F-010 |
| Icon yêu thích | FR-018, F-013 |
| Link Flash sale (nav + banner 3) | FR-028, F-022 |
| Click card → chi tiết sản phẩm | FR-005, F-004 |
| Tên thương hiệu "Mộc An" | **[Đề xuất — chờ chủ dự án chốt]** |
| Hotline/địa chỉ/footer text | **Dữ liệu mẫu — chờ thay bằng thông tin thật** |
