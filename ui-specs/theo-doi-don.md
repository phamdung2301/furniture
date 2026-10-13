# Spec giao diện — Theo dõi đơn (theo-doi-don)

- **Dự án:** noi-that-shop · **Màn:** Theo dõi đơn (màn 11 — thuộc wave 2 nhưng bị sót, nay làm bù)
- **Nguồn:** US-009, US-010, US-011 · FR-010, FR-012, FR-013, FR-016, FR-017 · F-008, F-009 · Entities: Order, OrderItem, Payment, Review
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** tái dùng nguyên xi §0 của `trang-chu.md` (tokens warm wood, Be Vietnam Pro, components Nút Primary/Secondary, Badge, Card). Không định nghĩa lại.
- **Liên quan:** kế thừa CTA "Theo dõi đơn hàng" ở trang thành công màn 7 (§6 dat-hang); tái dùng pattern polling màn 8 (thanh-toan §3); là entry point cho nút "Đánh giá" của màn 9 (viet-danh-gia §1.2).

---

## §1. Bố cục tổng thể

Hai route:

1. **`/don-hang`** — danh sách đơn của user: card đơn gọn (mã đơn, ngày đặt, tổng tiền, badge trạng thái, thumbnail 2–3 món) + filter theo trạng thái. Click card → chi tiết.
2. **`/don-hang/:orderNumber`** — chi tiết đơn: timeline trạng thái, hành động theo trạng thái, thông tin nhận hàng, danh sách món, tóm tắt tiền, khối thanh toán.

**Thứ tự ưu tiên hiển thị:** trạng thái đơn (timeline/badge) > hành động cần làm (thanh toán/hủy/đánh giá) > tiền > món > địa chỉ.

Breadcrumb: Trang chủ → Đơn hàng của tôi (list); Đơn hàng của tôi → `NT-...` (detail).

---

## §2. Trang danh sách `/don-hang` → FR-016, US-009

### 2.1 Header + filter
- H1 `Đơn hàng của tôi` + đếm `({N} đơn)`.
- Filter chips (segmented, tái dùng pattern tab): `Tất cả` · `Mới` · `Đang giao` · `Hoàn thành` · `Đã hủy`. Map trạng thái:
  - `Mới` = MỚI + ĐÃ XÁC NHẬN (đơn chưa giao)
  - `Đang giao` = ĐANG GIAO
  - `Hoàn thành` = HOÀN THÀNH (+ HOÀN TRẢ nếu có)
  - `Đã hủy` = ĐÃ HỦY
- Đổi filter: lọc client-side nếu đã load hết, hoặc gọi lại API với `?status=`; giữ filter trong query param `?trang-thai=...` để F5 không mất.

### 2.2 Card đơn (1 đơn = 1 card)
- Dòng 1: mã đơn `NT-20261011-0001` (bold, click icon copy) · badge trạng thái (§4.3) · ngày đặt `11/10/2026 20:15` (định dạng `dd/MM/yyyy HH:mm`).
- Dòng 2: thumbnails 3 món đầu (56px, bo 8px) + text `+2 món nữa` nếu > 3 · bên phải: `Tổng: 15.600.000đ` (18px/700 `--brand-700`).
- Dòng 3 (chỉ khi cần hành động): nút hành động nhanh theo trạng thái (§5): đơn MỚI MoMo chưa thanh toán → nút Primary nhỏ `Thanh toán ngay`; đơn HOÀN THÀNH có món chưa đánh giá → link `Đánh giá sản phẩm →`.
- Hover card: shadow nhẹ; click (trừ vùng nút) → `/don-hang/:orderNumber`.
- Sắp xếp: mới nhất trước (`createdAt` giảm dần).

### 2.3 Trạng thái trang (3 trạng thái bắt buộc)
- **Loading:** skeleton 3 card (dòng mã đơn + thumbnails + tổng tiền dạng shimmer).
- **Empty:** illustration + `Chưa có đơn hàng nào.` + text phụ `Đơn hàng của bạn sẽ hiện ở đây sau khi đặt mua.` + nút Primary `Mua sắm ngay` → `/`.
- **Error:** `Có lỗi xảy ra khi tải đơn hàng.` + nút `Thử lại`.

---

## §3. Trang chi tiết `/don-hang/:orderNumber` → FR-012, FR-016, F-009

Layout 2 cột desktop (trái 8/12: timeline + món + địa chỉ; phải 4/12 sticky: tóm tắt tiền + thanh toán + hành động). Mobile xếp chồng: tóm tắt tiền thành card sau timeline, nút hành động sticky bottom.

### 3.1 Header đơn
- Mã đơn lớn (20px/700) + icon copy (toast `Đã sao chép mã đơn.`) · ngày đặt `Đặt lúc 20:15, 11/10/2026` · badge trạng thái lớn (§4.3).
- Banner cảnh báo theo trạng thái (chỉ hiện khi có):
  - MỚI + MoMo + CHƯA THANH TOÁN: banner vàng `Đơn hàng đang chờ thanh toán — sẽ tự hủy sau {mm:ss}.` + countdown (tái dùng logic màn 8).
  - ĐÃ HỦY + lý do quá hạn: banner đỏ nhạt `Đơn đã hủy do quá thời gian thanh toán.` (đúng copy màn 7/8 đã duyệt).

### 3.2 Timeline trạng thái → US-009, F-009
Dựng từ `statusHistory[]` (`{status, at, note}`), dạng dọc, mỗi mốc: dot + tên mốc + thời gian + ghi chú nhỏ.

Các mốc chuẩn (đủ cho vòng đời FR-012):
1. `Đặt hàng` (MỚI) — `Đã đặt lúc HH:MM, dd/MM`
2. `Thanh toán` — theo `paymentMethod`:
   - MoMo: `Đã thanh toán qua Ví MoMo lúc HH:MM` (khi payment ĐÃ THANH TOÁN) / `Đang chờ thanh toán` (khi chưa)
   - COD: `Thanh toán khi nhận hàng`
   - Chuyển khoản: `Đã chuyển khoản — shop đang xác nhận` / `Chờ xác nhận chuyển khoản`
3. `Đóng gói` (ĐÃ XÁC NHẬN) — `Shop đã xác nhận đơn`
4. `Đang giao` (ĐANG GIAO) — `Đang giao đến bạn` (+ mã vận đơn nếu có — [Giả định] hiển thị khi backend trả `trackingCode`)
5. `Hoàn thành` (HOÀN THÀNH) — `Đã giao thành công lúc HH:MM, dd/MM`

- Mốc đã qua: dot đầy màu `--success` + chữ `--text`; mốc hiện tại: dot `--brand-700` to hơn + chữ bold; mốc chưa tới: dot xám + chữ `--text-muted`.
- Đơn ĐÃ HỦY: timeline chỉ hiện các mốc đã đạt được, kết thúc bằng mốc đỏ `Đã hủy lúc HH:MM, dd/MM` + lý do (`note`: "Quá thời gian thanh toán" / "Bạn đã hủy đơn").
- Đơn HOÀN TRẢ: thêm mốc tím/đỏ `Hoàn trả` sau Hoàn thành (hiếm — chỉ render khi có trong `statusHistory`).

### 3.3 Khối hành động (theo trạng thái — chi tiết §5)
Đặt ngay dưới header (desktop: card phải sticky; mobile: sticky bottom bar). Mỗi trạng thái chỉ hiện đúng các nút được phép — không hiện nút disabled gây nhầm.

### 3.4 Thông tin nhận hàng
Card: tên người nhận (bold), SĐT, địa chỉ đầy đủ 1 dòng (`detail, ward, district, province`), ghi chú giao hàng (nếu có, italic muted). Snapshot từ `receiver` — hiển thị đúng lúc đặt, không đổi theo sổ địa chỉ hiện tại.

### 3.5 Danh sách món
Mỗi dòng: ảnh 64px (bo 8px) · tên sản phẩm · chấm màu + tên màu (`color`) · `×{qty}` · đơn giá snapshot · thành tiền dòng (bold). Không cho sửa số lượng (đơn đã tạo là bất biến — đúng ERD snapshot).

### 3.6 Tóm tắt tiền (card sticky phải)
- Dòng: `Tạm tính` → `Giảm giá` (xanh lá `-200.000đ`, kèm mã `NOITHAT50` nếu có) → `Phí vận chuyển` (`Miễn phí` xanh lá khi `freeShipping`, ngược lại số tiền) → divider → `Tổng cộng` (20px/700 `--brand-700`).
- Số liệu lấy từ snapshot đơn (`subtotal/discount/shippingFee/total`) — không tính lại.

### 3.7 Khối thanh toán
- Dòng 1: phương thức (`Ví MoMo` / `Thanh toán khi nhận hàng (COD)` / `Chuyển khoản ngân hàng`) + icon.
- Dòng 2: badge trạng thái thanh toán: `Đã thanh toán` (success) · `Chưa thanh toán` (warning) · `Thất bại` (error) — màu nhất quán với màn 8.
- Nếu MoMo + ĐÃ THANH TOÁN: dòng nhỏ `Đã thanh toán {số tiền}đ qua Ví MoMo lúc {HH:MM}` (đúng copy màn 8).

### 3.8 Guard + 3 trạng thái
- **Chưa login** → redirect `/dang-nhap?returnTo=/don-hang` (giữ nguyên deep-link chi tiết nếu có).
- **Đơn không thuộc user** → trang lỗi 403: `Bạn không có quyền xem đơn hàng này.` + nút `Về trang đơn hàng`.
- **Đơn không tồn tại** → 404: `Không tìm thấy đơn hàng.` + nút `Về trang đơn hàng`.
- **Loading:** skeleton (header + timeline 5 mốc + 2 card).
- **Error:** `Có lỗi xảy ra, vui lòng thử lại.` + nút `Thử lại`.

---

## §4. Badge trạng thái — màu sắc nhất quán toàn site

| Trạng thái | Nền | Chữ | Ghi chú |
|---|---|---|---|
| MỚI | `#FDF3E0` | `--warning` | Đơn vừa tạo |
| ĐÃ XÁC NHẬN | `#F5EFE6` | `--brand-700` | Shop đã nhận đơn |
| ĐANG GIAO | `#FBF3DC` | `#8A6D1A` | Tái dùng kiểu badge BÁN CHẠY |
| HOÀN THÀNH | `#E8F5E9` | `--success` | Tái dùng kiểu badge MỚI |
| ĐÃ HỦY | `#F5F2EE` | `--text-muted` | |
| HOÀN TRẢ | `#FCE4EC` | `--error` | Nhánh FR-012 [Giả định] |

- Dùng component Badge có sẵn (12px/700, uppercase, bo 999px) — chỉ thêm 6 variant màu trên, không định nghĩa component mới.
- Đơn MoMo MỚI + CHƯA THANH TOÁN: badge trạng thái đơn vẫn `MỚI`; trạng thái thanh toán thể hiện riêng ở khối §3.7 + banner §3.1 (tránh 2 badge chồng nghĩa).

---

## §5. Hành động theo trạng thái → F-009, FR-013, US-010

| Trạng thái đơn | Nút hiển thị | Hành vi |
|---|---|---|
| MỚI + MoMo + CHƯA THANH TOÁN | Primary `Thanh toán ngay` | → `/thanh-toan?order={orderNumber}` (màn 8) |
| MỚI (mọi phương thức) | Secondary/Text danger `Hủy đơn` | Mở confirm inline (modal nhỏ): lý do hủy optional (textarea, placeholder `Lý do hủy (không bắt buộc)`) → `Xác nhận hủy` → gọi API → đơn → ĐÃ HỦY, timeline cập nhật ngay, toast `Đã hủy đơn hàng.` (đúng F-009: hoàn stock + hoàn lượt voucher ở backend) |
| MỚI (sau khi đã ĐÃ XÁC NHẬN trở đi) | — | Không hiện nút hủy (F-009: chỉ hủy khi MỚI). Nếu user cố gọi API → backend từ chối, FE hiện `Đơn hàng đang được xử lý, vui lòng liên hệ hotline 1900 6868 để được hỗ trợ.` |
| ĐÃ HỦY | Secondary `Đặt lại đơn hàng` | Thêm lại các món trong đơn vào giỏ (theo snapshot, kiểm tra tồn hiện tại — món hết hàng thì bỏ qua + toast liệt kê) → chuyển `/gio-hang`. **[Giả định UX]** — đúng CTA đã duyệt ở màn 7/8 |
| HOÀN THÀNH | (theo món — xem §6) | Không có hành động cấp đơn; mỗi món có nút đánh giá riêng |
| ĐANG GIAO / ĐÃ XÁC NHẬN | Link `Liên hệ shop` | Mở hotline `1900 6868` (tel:) — không cho hủy (F-009 edge case) |

- Hủy đơn: sau khi hủy thành công, nút `Hủy đơn` biến mất, hiện `Đặt lại đơn hàng`; banner đỏ nhạt `Bạn đã hủy đơn hàng lúc {HH:MM}.`
- Không bao giờ hiện đồng thời `Thanh toán ngay` và `Hủy đơn` gây rối — xếp dọc: Primary trước, Text-danger sau.

---

## §6. Entry "Đánh giá sản phẩm" → FR-017, US-011, viet-danh-gia §1.2

- Với đơn ở trạng thái **HOÀN THÀNH**: mỗi dòng món trong §3.5 có thêm nút Text `Đánh giá` (bên phải dòng, màu `--brand-700`) **nếu user chưa đánh giá sản phẩm đó**.
- Click → `/san-pham/:slug?review=open` (deep-link màn 9 — tự mở modal viết/sửa, xử lý eligibility ở đó).
- Đã đánh giá rồi → nút thành Text muted `Đã đánh giá` (không click) hoặc ẩn — chọn: hiện chữ muted `Đã đánh giá ✓` để user biết trạng thái.
- Để biết "chưa đánh giá", mỗi item cần `productSlug` — **mở rộng snapshot OrderItem thêm field `productSlug`** ([Giả định] cần thiết cho deep-link; doc-writer cập nhật 02-ERD).
- Ở trang danh sách (§2.2): đơn HOÀN THÀNH có ≥1 món chưa đánh giá → dòng hành động nhanh: link `Đánh giá sản phẩm →` → vào chi tiết đơn (user chọn món cụ thể ở đó).

---

## §7. Realtime cho đơn MoMo đang chờ → F-008 (tái dùng pattern màn 8)

- Ở trang chi tiết, khi `paymentMethod=MOMO && payment.status=CHƯA THANH TOÁN && status=MỚI`: FE poll `GET /orders/{orderNumber}` **mỗi 4s** (giảm còn 15s khi tab ẩn, quay lại tab poll ngay — đúng thanh-toan §3).
- Khi IPN về (payment → ĐÃ THANH TOÁN): tự cập nhật badge + timeline + khối thanh toán + ẩn nút `Thanh toán ngay`, toast xanh `Thanh toán thành công!` — không reload trang.
- Khi đơn tự hủy (hết 30 phút): cập nhật sang ĐÃ HỦY + banner `Đơn đã hủy do quá thời gian thanh toán.` + nút `Đặt lại đơn hàng`.
- Dòng trạng thái poll tinh tế dưới banner: `Đang chờ xác nhận từ MoMo...` + spinner nhỏ (không overlay chặn).
- Trang danh sách: không poll (chỉ refresh khi user quay lại trang hoặc pull); badge đơn MỚI-MoMo có thể hơi trễ — chấp nhận được, chi tiết mới là nơi realtime.

---

## §8. Contract backend + dữ liệu mẫu (builder implement)

**Endpoints (khớp F-009; một số đã có từ màn 7/8):**
- `GET /orders` → `[{ orderNumber, createdAt, total, status, paymentMethod, paymentStatus, itemCount, itemsPreview: [{ image, productName }] (3 món đầu) }]` — query `?status=MỚI|ĐÃ XÁC NHẬN|...` cho filter; phân trang `?page=&size=` (mặc định 10).
- `GET /orders/{orderNumber}` → chi tiết đầy đủ: toàn bộ field Order (ERD) + `statusHistory[]` + khối `payment { method, amount, status, paidAt? }` + `items[]` (mỗi item thêm `productSlug` — [Giả định] §6).
- `POST /orders/{orderNumber}/cancel` → `204` (đã có từ màn 8) — body `{ reason? }`; chỉ khi `status=MỚI`, ngược lại `400` + message hướng dẫn liên hệ.

**Dữ liệu mẫu demo** (5 đơn, đủ mọi trạng thái + đủ case hành động):
1. `NT-20261011-0005` — MỚI, MoMo, CHƯA THANH TOÁN, tổng 15.600.000đ (2 món) → demo `Thanh toán ngay` + realtime + countdown
2. `NT-20261011-0004` — ĐÃ XÁC NHẬN, COD, tổng 2.900.000đ (2 món: Ghế ăn ×2) → demo nút `Hủy đơn` (confirm + lý do)
3. `NT-20261010-0003` — ĐANG GIAO, MoMo ĐÃ THANH TOÁN lúc 14:32, tổng 8.450.000đ → demo timeline 4 mốc + `Liên hệ shop`
4. `NT-20261008-0002` — HOÀN THÀNH, tổng 5.200.000đ (3 món: 1 đã đánh giá, 2 chưa) → demo nút `Đánh giá` từng món
5. `NT-20261005-0001` — ĐÃ HỦY (lý do "Quá thời gian thanh toán"), tổng 15.600.000đ → demo banner đỏ + `Đặt lại đơn hàng`

- Toggle demo: `Chưa đăng nhập` (redirect login) · `Đơn không thuộc user` (403) · `Danh sách trống` (empty state) · `Lỗi tải` (error + Thử lại).

---

## §9. Traceability

| Mục spec | Nguồn |
|---|---|
| Trang `/don-hang`: card đơn (mã copy, ngày, tổng, badge, thumbnails), filter Tất cả/Mới/Đang giao/Hoàn thành/Đã hủy | FR-016 · US-009 |
| Trang `/don-hang/:orderNumber`: timeline từ `statusHistory`, thông tin nhận hàng snapshot, món snapshot, tóm tắt tiền, khối thanh toán | FR-012 · FR-016 · F-009 |
| Timeline 5 mốc (Đặt hàng → Thanh toán → Đóng gói → Đang giao → Hoàn thành) + mốc hủy đỏ | US-009 · F-009 · 02-ERD (Order.statusHistory) |
| `Thanh toán ngay` (MỚI + MoMo chưa thanh toán) → `/thanh-toan` | FR-010 · F-008 · dat-hang §6 |
| `Hủy đơn` chỉ khi MỚI + confirm + lý do optional; sau hủy hoàn stock/voucher (BE) | FR-013 · US-010 · F-009 |
| Đơn quá hạn → banner `Đơn đã hủy do quá thời gian thanh toán.` + `Đặt lại đơn hàng` | F-008 · US-012 · dat-hang §6/thanh-toan §5.2 |
| Nút `Đánh giá` từng món khi HOÀN THÀNH + chưa đánh giá → deep-link `?review=open` | FR-017 · US-011 · F-012 · viet-danh-gia §1.2 |
| Poll 4s realtime cho đơn MoMo chờ (badge/timeline/actions tự cập nhật) | F-008 · thanh-toan §3 |
| Badge 6 trạng thái màu nhất quán; badge thanh toán riêng | FR-012 · thanh-toan §4 |
| Loading skeleton / empty / error + Thử lại; 403 đơn người khác; guard login | Operating rule 2 · F-009 |
| Text tiếng Việt, không mã nội bộ (không hiện SKU/variantId) | copy-ux-linter |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Đơn hàng của tôi`, `Chi tiết đơn hàng`, `Thanh toán ngay`, `Hủy đơn`, `Đặt lại đơn hàng`, `Đánh giá sản phẩm`, `Đã sao chép mã đơn.`, `Đã hủy đơn hàng.`, `Đang giao đến bạn`, `Đã giao thành công`.
