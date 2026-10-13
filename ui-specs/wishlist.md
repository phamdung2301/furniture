# Spec giao diện — Wishlist / Sản phẩm yêu thích (wishlist)

- **Dự án:** noi-that-shop · **Màn:** Wishlist (màn 10, wave 3: Tương tác)
- **Nguồn:** FR-018 · F-013 · Entities: WishlistItem, Product, ProductVariant
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Phạm vi:** trang `/yeu-thich` + nút tim toàn site + đồng bộ guest/login. Không làm lại layout ProductCard (chỉ thêm nút tim). Nút toggle local ở màn 4 (`ProductDetailPage`) được nâng cấp thành đồng bộ thật (§2).
- **Design system:** tái dùng nguyên xi §0 của `trang-chu.md` (tokens warm wood, Be Vietnam Pro, Nút Primary/Secondary, Badge, Product Card). Pattern toast + event realtime tái dùng từ giỏ hàng (màn 5): event `mocan:wishlist-changed`, hook `useWishlistCount` (song song `useCartCount`).
- **Ghi chú traceability:** `04-user-stories.md` hiện không có US riêng cho wishlist — mọi mục trong spec map về FR-018 / F-013, không bịa US.

---

## §1. Trang `/yeu-thich` — danh sách yêu thích

### 1.1 Bố cục
- Breadcrumb: `Trang chủ → Sản phẩm yêu thích`.
- Page header: H1 `Sản phẩm yêu thích` + đếm `({N} sản phẩm)` 15px `--text-muted` cạnh tiêu đề.
- Toolbar: trái là đếm (đã gộp vào H1), phải là **SortDropdown** tái dùng từ màn 2 với 3 option: `Mới nhất` (mặc định, theo `addedAt` giảm dần) · `Giá tăng dần` · `Giá giảm dần`. Giá dùng để sort = giá hiển thị trên card (giá variant mặc định theo F-004).
- Grid sản phẩm: **tái dùng nguyên ProductCard**, 4 cột desktop · 3 tablet · 2 mobile, gap `20px` (đúng §2.6 trang-chu).
- Hiển thị toàn bộ danh sách (không phân trang ở bản này).

### 1.2 Nút xóa khỏi wishlist trên mỗi card
- Nút tim ở **góc trên-phải của ảnh card** (định nghĩa ở §2) — trạng thái filled = đang trong wishlist. Click = xóa khỏi wishlist → card fade-out 200ms rồi biến mất khỏi grid + toast `Đã bỏ khỏi danh sách yêu thích.` + cập nhật đếm H1 và badge header ngay (optimistic, rollback khi lỗi).
- Không confirm dialog, không "Hoàn tác" (khác giỏ hàng — thao tác nhẹ, thêm lại chỉ cần 1 click tim).

### 1.3 Thứ tự ưu tiên hiển thị
Danh sách (mới nhất trước) > badge "Đã giảm giá" (§3) > sort > empty/error states.

---

## §2. Nút tim toàn site — toggle realtime + đồng bộ

### 2.1 Vị trí và hình thức
- **ProductCard (mọi nơi: trang chủ, danh mục, tìm kiếm, trang chi tiết phần "Sản phẩm liên quan", `/yeu-thich`):** nút tim tròn 36px, nền trắng mờ 90%, **góc trên-phải của ảnh**, icon tim outline 18px `--text-muted`.
  - Desktop: hiện khi hover card (giữ card sạch); Mobile: luôn hiện (không có hover).
  - Trạng thái active (đã lưu): tim đầy màu `--error`, nút viền `--error` nhạt.
  - Click: `stopPropagation` (không navigate vào trang chi tiết) + animation pop `scale(1 → 1.3 → 1)` 200ms.
- **Trang chi tiết sản phẩm:** nâng cấp nút `.pd-info__wish` hiện có (màn 4, toggle local tạm) thành toggle thật theo §2.2 — giữ nguyên vị trí cạnh "Mua ngay", giữ copy toast hiện tại.
- **QuickViewModal:** wire `onToggleWishlist` hiện có vào toggle thật (§2.2).
- Accessibility: `aria-label="Thêm vào yêu thích"` / `"Bỏ khỏi yêu thích"`, `aria-pressed` theo trạng thái.

### 2.2 Hành vi toggle
- Click → **optimistic toggle ngay** (đổi icon + toast) → gọi lưu/xóa async → lỗi thì rollback + toast đỏ `Có lỗi xảy ra, vui lòng thử lại.`
- Toast đúng copy đã duyệt ở màn 4: `Đã thêm vào danh sách yêu thích.` / `Đã bỏ khỏi danh sách yêu thích.`
- **Khách vãng lai (chưa login):** lưu vào localStorage, key `mocan_wishlist_v1` (song song `mocan_cart_v1`), shape mỗi item: `{ productId, slug, name, image, priceAtSave, addedAt }`. Bắn event `mocan:wishlist-changed` để header + mọi nơi cập nhật realtime.
- **Đã login:** gọi API (§5): `POST /wishlist` khi thêm, `DELETE /wishlist/{productId}` khi xóa. Unique 1 cặp (user, product) — thêm trùng → 409, FE coi như đã lưu (idempotent).
- **`priceAtSave`:** giá variant mặc định (F-004) tại thời điểm bấm tim — dùng cho badge "Đã giảm giá" (§3). **[Giả định mở rộng ERD]** — field chưa có trong `WISHLIST_ITEM` (02-ERD), cần doc-writer cập nhật docs theo operating rule 1.

### 2.3 Đồng bộ khi login (song song F-006 của giỏ hàng)
- Sau login thành công: gọi `mergeWishlistAfterLogin()` — gửi items local lên `POST /wishlist/merge` → server **union** theo `productId` (không trùng, không cộng dồn vì wishlist không có số lượng), giữ `addedAt` sớm nhất và `priceAtSave` của bản local.
- Xóa local sau merge thành công. Toast xanh: `Đã đồng bộ {N} sản phẩm yêu thích từ trước khi đăng nhập của bạn.` (N > 0 mới hiện; copy theo mẫu màn 6 "Đã gộp {N} sản phẩm...").

### 2.4 Header
- Icon tim ở header (đã có ở §2.2 trang-chu) → click vào `/yeu-thich`.
- Badge số lượng: wire thật qua `useWishlistCount()` (hook mới, realtime qua `mocan:wishlist-changed`) — thay cho `wishlistCount={0}` hardcode hiện tại ở các page. Badge ẩn khi = 0 (đúng pattern badge giỏ).

---

## §3. Badge "Đã giảm giá" + món ngừng bán / hết hàng

### 3.1 Badge "Đã giảm giá" (giá trị cốt lõi của wishlist)
- Điều kiện: `currentPrice < priceAtSave` (currentPrice = giá variant mặc định F-004 hiện tại).
- Hiển thị: Badge `Đã giảm giá` (nền `--error`, chữ trắng, 12px/700 uppercase — đúng hệ Badge §0) ở **góc trên-trái ảnh card** (trái tim ở góc phải, không chồng lấn).
- Dưới giá trên card: dòng nhỏ 13px màu `--error`: `Đã giảm từ {priceAtSave}đ` (giá cũ gạch ngang).
- Click vào badge không làm gì (không phải link).
- Giá tăng so với lúc lưu: không hiển thị gì thêm (không bịa trạng thái ngoài task).

### 3.2 Sản phẩm ngừng bán — F-013
- Rule docs: "sản phẩm ngừng bán → giữ trong wishlist kèm nhãn."
- Card: ảnh mờ 60% + overlay nhãn `Ngừng kinh doanh` (Badge trắng/chữ `--text`, giữa ảnh — theo pattern badge `Hết hàng` ở §0 nhưng chữ khác để phân biệt "ngừng bán" vs "hết hàng").
- Vẫn giữ trong danh sách (không tự xóa), nút tim vẫn xóa được. Click card → vào trang chi tiết (hiển thị 404 thân thiện đã có ở màn 4).

### 3.3 Sản phẩm hết hàng (còn bán, mọi variant stock = 0)
- Card mờ nhẹ + Badge `Hết hàng` đúng pattern §0 (overlay ảnh đen 55% + chữ trắng).
- Không hiện nút "Thêm vào giỏ" trên card (nếu card có). Nút tim/xóa vẫn hoạt động bình thường.

---

## §4. Trạng thái loading / empty / error

- **Loading:** skeleton grid ProductCard (tái dùng Skeleton màn 1), 8 ô.
- **Empty:** illustration tim outline lớn màu `--border` + H2 `Chưa có sản phẩm yêu thích` + text phụ `Lưu lại những món bạn thích để xem lại sau nhé.` + nút Primary `Khám phá sản phẩm` → `/`.
- **Error:** banner đỏ + nút `Thử lại` (pattern màn 5).
- Guest chưa có item nào trong local → empty state như trên (không yêu cầu login để xem wishlist — xem lại sau là nhu cầu trước login).

---

## §5. Tương tác & animation tóm tắt

| Tương tác | Hiệu ứng |
|---|---|
| Bấm tim | Pop `scale(1→1.3→1)` 200ms + toast |
| Xóa khỏi `/yeu-thich` | Card fade-out 200ms → grid co lại mượt |
| Đổi sort | Grid re-render, không animation đặc biệt |
| Badge "Đã giảm giá" | Hiện tĩnh (không nhấp nháy) |

---

## §6. Contract backend + dữ liệu mẫu (builder implement)

**Endpoints:**
- `POST /wishlist` — body `{ productId, priceAtSave }` → `201 { item }` (trùng → 409, FE coi như đã lưu)
- `DELETE /wishlist/{productId}` → `204`
- `GET /wishlist` — auth → `[{ productId, addedAt, priceAtSave, product: { slug, name, image, active, defaultPrice, defaultStock, badge } }]` (product kèm đủ field để render card + §3; sort ở FE)
- `POST /wishlist/merge` — auth, body `{ items: [{ productId, priceAtSave, addedAt }] }` → `{ merged: N }` (union theo productId)
- Thêm entry `/wishlist` vào vite proxy (bài học /claims — verify trong file).

**Models (khớp 02-ERD + [Giả định]):** `WishlistItem { _id, userId FK, productId FK, priceAtSave [Giả định], createdAt }`, index `{userId}` đã có + compound unique `{userId, productId}`.

**Dữ liệu mẫu demo** (5 món):
1. Sofa góc L Nordic (Xám) — lưu lúc 13.500.000đ, hiện 12.900.000đ → **hiện badge "Đã giảm giá"** + dòng "Đã giảm từ 13.500.000đ"
2. Ghế ăn bọc vải (Be) × — giá không đổi
3. Bàn trà gỗ Sồi — giá không đổi
4. Kệ tivi Gỗ Óc Chó — `active=false` → **card mờ + nhãn "Ngừng kinh doanh"**
5. Giường ngủ Gỗ Tự Nhiên — hết hàng toàn bộ màu → **card mờ + badge "Hết hàng"**
- Toggle demo: "Chưa đăng nhập" (wishlist local) / "Lỗi tải danh sách" (error + Thử lại) / "Danh sách trống" (empty state).

---

## §7. Traceability

| Mục spec | Nguồn |
|---|---|
| Trang `/yeu-thich`, grid ProductCard, nút xóa mỗi card | FR-018 |
| Nút tim mọi nơi, toggle realtime + toast | FR-018 |
| Guest lưu local, đồng bộ khi login (union) | FR-018 · pattern F-006 (giỏ hàng) |
| 1 cặp (user, product) duy nhất, 409 idempotent | F-013 |
| Ngừng bán → giữ + nhãn "Ngừng kinh doanh" | F-013 |
| Badge "Đã giảm giá" khi giá hiện tại < lúc lưu | FR-018 (giá trị "xem lại sau") · `priceAtSave` [Giả định] |
| Sort Mới nhất / Giá tăng-giảm (giá F-004) | FR-018 [Giả định UI] |
| Header icon tim + badge số → `/yeu-thich` | FR-018 · §2.2 trang-chu |
| Loading skeleton / empty / error + Thử lại | Operating rule 2 |
| Text tiếng Việt, không mã nội bộ | copy-ux-linter |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Sản phẩm yêu thích`, `Đã giảm giá`, `Ngừng kinh doanh`, `Đã đồng bộ {N} sản phẩm yêu thích từ trước khi đăng nhập của bạn.`

**Divergence docs cần doc-writer cập nhật** (operating rule 1): `WISHLIST_ITEM` thêm field `priceAtSave` + compound unique `{userId, productId}` trong `02-ERD.md`.
