# Spec giao diện — Viết / Sửa đánh giá (viet-danh-gia)

- **Dự án:** noi-that-shop · **Màn:** Viết / Sửa đánh giá (màn 9, wave 3: Tương tác)
- **Nguồn:** US-011 · FR-017 · F-012 · Entities: Review, Product, Order
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Phạm vi:** chỉ luồng VIẾT/SỬA/XÓA đánh giá. Phần hiển thị (ReviewSummary, ReviewCard, list phân trang, tab "Đánh giá (N)") đã có ở màn 4 — không làm lại, chỉ định nghĩa điểm tích hợp (§5).
- **Design system:** tái dùng nguyên xi §0 của `trang-chu.md` (tokens warm wood, Be Vietnam Pro, Nút Primary/Secondary, Badge). Pattern modal tái dùng từ `QuickViewModal` (màn 4): overlay 40%, đóng bằng ×/click ngoài/Esc, mobile thành bottom-sheet.

---

## §1. Bố cục & entry points

### 1.1 Quyết định: modal trên trang chi tiết (không trang riêng)
- Form viết/sửa là **modal** mở ngay trên `/san-pham/:slug` (tab Đánh giá) — giữ context sản phẩm, user không mất vị trí scroll.
- Modal: desktop căn giữa, rộng `520px`; mobile bottom-sheet full-width, bo trên `20px`.
- Header modal: tiêu đề + nút ×. Nội dung scroll nếu dài (mobile).

### 1.2 Entry points
1. **Nút "Viết đánh giá" / "Sửa đánh giá"** ở `ReviewSummary` (màn 4) — behavior theo case điều kiện §2.
2. **Màn Theo dõi đơn (màn sau):** với mỗi dòng hàng trong đơn ở trạng thái HOÀN THÀNH mà user chưa đánh giá → nút Text "Đánh giá" → link `/san-pham/:slug?review=open`.
3. **Deep-link `?review=open`:** `ProductDetailPage` khi mount, nếu có param này → tự kiểm tra eligibility (§2) → đủ điều kiện thì tự mở modal (viết mới hoặc sửa), không đủ thì bỏ qua param + hiện tooltip lý do như §2. Sau khi mở, xóa param khỏi URL (replace) để F5 không mở lại.

---

## §2. Điều kiện được đánh giá — F-012 (5 case)

Nút ở `ReviewSummary` **luôn hiển thị** (không giấu — nhất quán màn 4). Click xử lý theo case, lấy từ eligibility:

| # | Case | Nút hiển thị | Click → |
|---|---|---|---|
| 1 | Chưa đăng nhập | `Viết đánh giá` (Secondary) | Chuyển `/dang-nhap?returnTo=/san-pham/:slug?review=open` — giữ ý định, sau login tự mở modal |
| 2 | Đã login, chưa từng mua SP | `Viết đánh giá` | Tooltip/popover: `Chỉ khách hàng đã mua và nhận hàng mới có thể đánh giá sản phẩm này.` |
| 3 | Đã mua nhưng đơn chưa HOÀN THÀNH | `Viết đánh giá` | Tooltip: `Bạn có thể đánh giá sau khi nhận hàng.` + link `Theo dõi đơn hàng →` |
| 4 | Đã đánh giá rồi | `Sửa đánh giá` | Mở modal chế độ sửa, prefill đầy đủ (§4) |
| 5 | Đủ điều kiện (có đơn HOÀN THÀNH chứa SP, chưa đánh giá) | `Viết đánh giá` | Mở modal viết mới (§3) |

- Tooltip: popover nhỏ dưới nút, nền `--text`, chữ trắng 13px, tự đóng sau 4s hoặc khi click ra ngoài.
- **Contract eligibility:** `GET /products/{slug}/reviews/eligibility` (auth optional) → `{ canReview, hasReviewed, reason: "OK" | "NOT_LOGGED_IN" | "NOT_PURCHASED" | "NOT_COMPLETED" | "ALREADY_REVIEWED", purchasedColors: ["Xám","Be"], reviewId?, orderId? }`. Màn 4 đã có `canReview`/`hasReviewed` — mở rộng thêm `reason` + `purchasedColors`.

---

## §3. Form viết đánh giá (modal, case 5)

Tiêu đề modal: `Đánh giá sản phẩm` + tên SP nhỏ muted 1 dòng dưới.

### 3.1 Chọn sao (bắt buộc)
- 5 sao lớn 36px, màu `--accent` khi chọn/hover, xám `#DDD` khi chưa.
- Hover/preview: sao sáng dần theo vị trí chuột + label cảm xúc hiện bên cạnh: `1 Rất tệ · 2 Tệ · 3 Bình thường · 4 Tốt · 5 Rất tốt`.
- Click/touch chọn; click lại sao đang chọn → giữ nguyên (không bỏ chọn).
- Chưa chọn sao mà bấm Gửi → message đỏ dưới hàng sao: `Vui lòng chọn số sao đánh giá.`

### 3.2 Màu đã mua (chọn 1)
- Nếu `purchasedColors.length > 1`: label `Màu bạn đã mua` + chips radio (`Xám` `Be`) — chọn màu mà nhận xét này nói về. Mặc định chọn màu đầu tiên.
- Nếu chỉ mua 1 màu: hiện chip read-only `Màu: Xám` (không cho đổi).
- Giá trị lưu vào `Review.color` **[Giả định]** (mở rộng entity Review — phục vụ hiển thị "Màu: Xám" trên ReviewCard, §5).

### 3.3 Bình luận (không bắt buộc, có giới hạn)
- Textarea 4 dòng, placeholder: `Chia sẻ cảm nhận của bạn về chất lượng, màu sắc, trải nghiệm giao hàng…`
- Counter góc dưới `0/1000`; nếu nhập thì tối thiểu 10 ký tự, tối đa 1000. Dưới 10 ký tự → message đỏ: `Bình luận cần ít nhất 10 ký tự.`
- Được phép gửi chỉ sao, không bình luận.

### 3.4 Ảnh minh họa (không bắt buộc)
- Khối upload: khung dashed bo `12px`, icon ảnh + text `Thêm ảnh (tối đa 5)`; click mở file picker, hỗ trợ kéo-thả (desktop).
- Quy tắc: tối đa **5 ảnh** [Giả định], định dạng JPG/PNG/WebP, mỗi ảnh ≤ 5MB.
- Upload **ngay khi chọn** → `POST /reviews/images` (multipart) → preview thumbnail 72px từ URL trả về, mỗi thumb có nút × xóa (xóa trước khi gửi, không gọi API).
- Lỗi từng file hiện inline đỏ dưới khối upload: `Ảnh {tên} vượt quá 5MB.` / `Định dạng không hỗ trợ, vui lòng chọn JPG/PNG/WebP.` File lỗi không thêm vào preview.
- Đang upload: thumb hiện skeleton + spinner; nút Gửi disabled đến khi upload xong hết.

### 3.5 Nút hành động
- Footer modal: `Hủy` (Text) + `Gửi đánh giá` (Primary, full-width mobile).
- `Gửi đánh giá` disabled khi: chưa chọn sao, hoặc đang upload ảnh, hoặc đang gửi.

---

## §4. Chế độ sửa & xóa (case 4)

- Tiêu đề modal: `Sửa đánh giá của bạn`. Prefill: sao đã chọn, bình luận, chips màu (giữ màu cũ, cho đổi nếu mua nhiều màu), ảnh cũ hiện thumb kèm ×.
- Xóa ảnh cũ: đánh dấu loại khỏi payload (không xóa ngay trên server).
- Nút submit: `Lưu thay đổi` (Primary).
- **Xóa đánh giá** [Giả định — F-012 chỉ nêu "được sửa", task yêu cầu thêm xóa]: link đỏ `Xóa đánh giá` ở footer trái → chuyển sang confirm inline trong modal: `Bạn chắc chắn muốn xóa đánh giá này?` + 2 nút `Xóa` (Error) / `Giữ lại` (Secondary). Xác nhận → `DELETE /reviews/{id}` → đóng modal, gỡ review khỏi list (§5).
- Sau sửa: review cập nhật tại chỗ, không nhảy vị trí.

---

## §5. Sau khi gửi — optimistic UI & tích hợp hiển thị

- **Viết mới:** `POST /products/{slug}/reviews` → review mới **prepend ngay đầu list** tab Đánh giá (kèm badge `Đã mua hàng`), `total` +1, điểm TB + phân bố cập nhật optimistic; rollback toàn bộ + toast đỏ `Gửi đánh giá thất bại, vui lòng thử lại.` nếu API lỗi.
- **Sửa:** cập nhật review tại chỗ trong list + cập nhật lại điểm TB.
- **Xóa:** gỡ review khỏi list, `total` −1, cập nhật điểm TB; nút ở ReviewSummary quay về `Viết đánh giá` (user được đánh giá lại — eligibility chuyển về OK).
- Toast xanh khi thành công: `Cảm ơn bạn đã chia sẻ đánh giá!` (viết mới) / `Đã lưu thay đổi.` (sửa) / `Đã xóa đánh giá.` (xóa). Đóng modal sau toast 600ms (viết/sửa).
- **Tích hợp hiển thị tối thiểu** (không làm lại list): `ReviewCard` thêm dòng nhỏ muted `Màu: {color}` dưới hàng sao khi review có `color`; review mới/sửa có thêm nhãn `Mới` 5 phút đầu [Giả định] — giúp user nhận ra bài của mình.

---

## §6. Trạng thái loading / error

### Loading
- Đang gửi: nút `Gửi đánh giá`/`Lưu thay đổi` hiện spinner + text `Đang gửi…`, disable toàn form; không cho đóng modal bằng click ngoài (× vẫn cho, hỏi confirm nếu đã nhập nội dung: `Bỏ qua đánh giá đang viết?`).
- Đang xóa: nút `Xóa` spinner.

### Error (tiếng Việt, từng case)
- Chưa login lúc gửi (401) → redirect `/dang-nhap?returnTo=/san-pham/:slug?review=open`, giữ draft trong memory (quay lại vẫn còn).
- Không đủ điều kiện (403): message theo reason — `Bạn cần mua và nhận hàng trước khi đánh giá.` / `Sản phẩm này đã ngừng kinh doanh.` (review vẫn giữ theo F-012 edge case nhưng form không mở).
- Đã đánh giá rồi (409 — race 2 tab): tự chuyển modal sang chế độ sửa với dữ liệu server.
- Bình luận vi phạm (422 — filter từ khóa thô tục [Giả định] theo F-012): `Bình luận chứa từ ngữ không phù hợp. Vui lòng chỉnh sửa lại.` + highlight textarea.
- Ảnh lỗi: như §3.4 (inline từng file).
- Lỗi mạng: toast đỏ + **giữ nguyên form** (không mất dữ liệu), cho gửi lại.

---

## §7. Contract backend + dữ liệu mẫu (builder implement)

**Endpoints:**
- `GET /products/{slug}/reviews/eligibility` (auth optional) → `{ canReview, hasReviewed, reason, purchasedColors[], reviewId?, orderId? }` (§2)
- `POST /reviews/images` (auth, multipart) → `{ urls: ["https://…"] }` — upload trước khi submit
- `POST /products/{slug}/reviews` (auth) body `{ rating 1-5, comment?, imageUrls[]?, color?, orderId }` → `201 { review, summary: {average, total, distribution} }`
  - Validate: có Order HOÀN THÀNH chứa product của user (403 nếu không); unique `{productId, userId}` (409 nếu trùng); rating 1–5; comment ≤ 1000 ký tự; filter từ khóa (422).
  - Sau tạo: cập nhật `Product.ratingAvg`/`ratingCount`; `Review.orderId` = đơn HOÀN THÀNH mới nhất chứa SP.
- `PUT /reviews/{id}` (auth, chính chủ) → `{ review, summary }`
- `DELETE /reviews/{id}` (auth, chính chủ) → `204`; cập nhật lại `ratingAvg`/`ratingCount`
- Security: `GET /products/**/reviews/**` public; các endpoint viết/sửa/xóa yêu cầu auth; user chỉ sửa/xóa review của mình (403 nếu không phải chủ).
- vite proxy: `/reviews` (bài học /claims — verify trong file).

**Dữ liệu mẫu demo:** user demo đã login, có 1 đơn HOÀN THÀNH chứa Sofa góc L Nordic (màu Xám + Be) → case 5: mở modal viết mới. Toggle demo thêm 4 case còn lại (§2): chưa login / chưa mua / chưa nhận hàng / đã đánh giá (prefill 5 sao + ảnh cũ).

---

## §8. Traceability

| Mục spec | Nguồn |
|---|---|
| Modal viết/sửa trên trang chi tiết; entry từ ReviewSummary + deep-link `?review=open` từ Theo dõi đơn | FR-017 · task (không làm lại hiển thị màn 4) |
| 5 case điều kiện: chưa login → redirect login giữ returnTo; chưa mua → tooltip; chưa nhận hàng → tooltip + link theo dõi; đã đánh giá → nút "Sửa đánh giá" | F-012 (chỉ đơn HOÀN THÀNH mới được đánh giá) · FR-030 (returnTo pattern màn 6) |
| Form: sao 1–5 bắt buộc + label cảm xúc; màu đã mua (nhiều màu → chọn); bình luận ≤1000 (nhập thì ≥10); ảnh tối đa 5, ≤5MB, JPG/PNG/WebP, upload trước + preview + xóa | F-012 (input productId/rating/comment?/images[]?) · FR-017 (sao + bình luận + ảnh) |
| Sửa prefill; xóa có confirm inline [Giả định] | F-012 (1 user 1 review/SP, được sửa) · US-011 (không đánh giá lần 2) |
| Gửi xong: prepend đầu list + cập nhật TB optimistic, rollback khi lỗi; toast xác nhận | US-011 (review được lưu, ratingAvg/ratingCount cập nhật) |
| Lỗi từng case: 401/403/409/422 (filter từ khóa)/ảnh/mạng giữ form | F-012 (filter từ khóa [Giả định], edge case SP bị ẩn) |
| Contract: eligibility + CRUD review + upload ảnh; unique {productId, userId}; orderId bắt buộc trỏ đơn HOÀN THÀNH | 02-ERD §Review + index (Review{productId, userId} unique, orderId HOÀN THÀNH) |
| Text tiếng Việt, không mã nội bộ | copy-ux-linter |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Viết đánh giá`, `Sửa đánh giá`, `Xóa đánh giá`, `Gửi đánh giá`, `Lưu thay đổi`, `Chia sẻ cảm nhận`, `Màu bạn đã mua`.
