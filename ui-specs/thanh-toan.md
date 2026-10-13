# Spec giao diện — Thanh toán (thanh-toan)

- **Dự án:** noi-that-shop · **Màn:** Thanh toán (màn 8, wave 2: Mua hàng — khép lại wave 2)
- **Nguồn:** FR-010 · F-008 · US-012 · Entities: Order, Payment
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** tái dùng nguyên xi §0 của `trang-chu.md` (tokens warm wood, Be Vietnam Pro, components Nút Primary/Secondary, Badge). Không định nghĩa lại.
- **Luồng vào:** màn 7 (Đặt hàng) — user chọn **Ví MoMo** ở bước 3 → tạo đơn (`POST /orders`, status `MỚI`) → redirect `/thanh-toan?order=<orderNumber>`. (Trước màn này route rơi vào catch-all — màn này wire tiếp.)

---

## §1. Bố cục tổng thể

Route `/thanh-toan?order=<orderNumber>`.

Layout **1 cột căn giữa**, container hẹp `max-width 560px` — trang thanh toán cần focus, không phân tâm 2 cột:
1. **Header nhỏ:** "Thanh toán đơn hàng" (H2 24px/700) + mã đơn `NT-20261011-0001` (copy được, icon copy nhỏ).
2. **Card số tiền:** dòng "Số tiền cần thanh toán" (muted) + số tiền lớn 28px/800 màu `--brand-700` (VD `15.600.000đ`) + dòng nhỏ "Ví MoMo · Đơn hàng của Mộc An". **Số tiền hiển thị read-only — tuyệt đối không cho sửa** (F-008: amount do backend chốt).
3. **Card thanh toán** (thay đổi theo trạng thái — §2→§6).
4. Link nhỏ dưới cùng: "← Quay về giỏ hàng" (chỉ hiện khi chưa thanh toán).

**Thứ tự ưu tiên hiển thị:** số tiền > QR/hành động thanh toán > đếm ngược > thông tin đơn.

Breadcrumb: Giỏ hàng → Đặt hàng → Thanh toán. Header/footer dùng chung toàn site.

---

## §2. Trạng thái "Đang chờ thanh toán" → F-008, US-012

Trạng thái mặc định khi vào trang (payment vừa được tạo).

### 2.1 QR MoMo
- Ảnh QR **240×240px** (desktop) / **200×200px** (mobile), căn giữa, viền `--border` bo `16px`, padding trắng 12px quanh QR.
- QR render từ `qrCodeUrl` do backend trả về ( MoMo API ) — **FE không tự sinh QR từ dữ liệu nhạy cảm, không nhúng secret/key vào QR** (§8).
- Dưới QR: caption "Quét mã bằng app MoMo để thanh toán" (13px, `--text-muted`).

### 2.2 Nút "Mở app MoMo" (deeplink)
- Nút Primary full-width, icon MoMo, label "Mở app MoMo".
- Dùng `deeplink` do backend trả về trong response tạo payment (mở app MoMo đúng giao dịch).
- **Mobile:** nút hiển thị prominent ngay dưới QR (user đang cầm điện thoại → 1 chạm mở app).
- **Desktop:** hiển thị secondary nhỏ hơn dưới QR (kèm hint "hoặc quét mã QR ở trên bằng điện thoại").

### 2.3 Hướng dẫn 3 bước (numbered list, icon số tròn)
1. Mở app MoMo trên điện thoại (hoặc bấm nút bên trên).
2. Quét mã QR của đơn hàng.
3. Kiểm tra số tiền `15.600.000đ` và xác nhận thanh toán.

### 2.4 Đếm ngược giữ đơn — 30 phút → F-008 [Giả định: 30 phút]
- Thanh/pill đếm ngược: icon ⏱ + "Giao dịch hết hạn sau **29:47**" (MM:SS, 15px/600).
- > 5 phút còn lại: màu `--text-muted`; ≤ 5 phút: chuyển `--error` + nhấp nháy nhẹ (animation pulse 1s).
- Hết giờ mà chưa thanh toán → chuyển trạng thái §5.2 (đơn tự hủy + hoàn kho + hoàn lượt voucher theo F-008).
- Tooltip ⓘ cạnh countdown: "Đơn hàng được giữ 30 phút chờ thanh toán. Quá thời gian, đơn sẽ tự hủy và tồn kho được hoàn lại."

### 2.5 Nút "Tôi đã thanh toán xong"
- Nút Secondary full-width dưới deeplink: "Tôi đã thanh toán xong — kiểm tra ngay".
- Dùng khi user đã quét/xác nhận trên app MoMo nhưng polling chưa kịp cập nhật → gọi `GET /payments/momo/status?order=...` (backend query trực tiếp MoMo) → cập nhật trạng thái ngay, không bắt user chờ vòng poll.
- Disable + spinner "Đang kiểm tra..." trong lúc gọi.

### 2.6 Hủy bởi user → F-009
- Link text đỏ nhạt dưới cùng card: "Hủy thanh toán".
- Click → confirm inline (không modal): "Hủy thanh toán đơn này? Tồn kho sẽ được hoàn lại." + 2 nút "Giữ lại" / "Xác nhận hủy".
- Xác nhận → `POST /orders/{orderNumber}/cancel` (chỉ khi đơn còn `MỚI` và chưa thanh toán) → redirect `/gio-hang` + toast "Đã hủy thanh toán, giỏ hàng của bạn được giữ nguyên." (F-009: hủy khi còn được phép).

---

## §3. Polling trạng thái → F-008

- Khi ở trạng thái chờ, FE poll `GET /orders/{orderNumber}` **mỗi 4 giây** (khoảng 3–5s theo task; chốt 4s).
- Response cần có khối `payment: { method: "MOMO", status, paidAt }` (màn 7 đã trả order — bổ sung field payment).
- Dừng poll khi: `payment.status` = `ĐÃ THANH TOÁN` → §4; `THẤT BẠI` → §5.1; `order.status` = `ĐÃ HỦY` → §5.2; hoặc hết 30 phút countdown.
- Khi tab ẩn (document.hidden), giảm tần suất còn 15s để tiết kiệm request; quay lại tab → poll ngay 1 lần.
- Hiển thị trạng thái poll tinh tế: dòng nhỏ dưới QR "Đang chờ xác nhận từ MoMo..." + spinner nhỏ (không overlay chặn màn hình).

---

## §4. Trạng thái thành công → F-008 (IPN đối soát xong)

Khi poll (hoặc IPN qua nút kiểm tra) thấy `payment.status = "ĐÃ THANH TOÁN"`:

- Chuyển sang **trang thành công dùng chung của màn 7**: `/dat-hang/thanh-cong?order=<orderNumber>` (tái dùng `OrderSuccessPage`, không dựng trang mới).
- Trang thành công hiển thị thêm khối trạng thái thanh toán: check xanh lớn + "Thanh toán thành công!" + dòng "Đã thanh toán `15.600.000đ` qua Ví MoMo lúc `20:15`" (`paidAt` định dạng HH:MM).
- Giữ nguyên các phần còn lại của trang thành công màn 7: mã đơn copy được, tóm tắt đơn, 2 CTA "Theo dõi đơn hàng" (→ màn 9) + "Tiếp tục mua sắm".
- Giỏ hàng đã được xóa ở màn 7 khi tạo đơn — không xóa lại.

---

## §5. Trạng thái thất bại / hết hạn

### 5.1 Thanh toán thất bại (MoMo trả về fail)
- Banner/card đỏ nhạt: icon ⚠️ + "Thanh toán không thành công." + lý do cụ thể nếu MoMo trả về (VD: "Giao dịch bị từ chối trên app MoMo.", "Số dư ví không đủ.").
- 2 nút: Primary "Tạo lại thanh toán" (gọi lại `POST /payments/momo/create` cho cùng đơn — đơn vẫn `MỚI`, không tạo đơn mới) + Secondary "Chọn phương thức khác" (về `/dat-hang` bước 3, giữ nguyên đơn).
- Đơn KHÔNG bị hủy ở case này — chỉ payment `THẤT BẠI`, user được thử lại trong 30 phút (US-012: không treo vô thời hạn, nhưng cho thử lại trong cửa sổ giữ đơn).

### 5.2 Hết hạn 30 phút / đơn tự hủy → F-008, US-012
- Khi countdown về 0 hoặc poll thấy `order.status = "ĐÃ HỦY"`:
- Card đỏ nhạt: "Đơn hàng đã hủy do quá thời gian thanh toán." + dòng giải thích "Đơn được giữ 30 phút chờ thanh toán qua MoMo. Tồn kho và mã ưu đãi của bạn đã được hoàn lại."
- 2 CTA: Primary "Đặt lại đơn hàng" (→ `/gio-hang`; giỏ vẫn còn vì chỉ xóa giỏ khi thanh toán thành công — user đặt lại nhanh) + Text link "Về trang chủ".
- **Không** hiện nút "Tạo lại thanh toán" ở trạng thái này (đơn đã hủy, không thể hồi sinh — đúng F-008).

### 5.3 Webhook đến muộn (edge case F-008)
- Nếu user thanh toán đúng phút cuối, IPN đến sau khi đơn tự hủy: backend chỉ ghi log, không trừ kho lần 2. FE không cần xử lý riêng — poll sẽ thấy đơn `ĐÃ HỦY` → hiển thị §5.2. (Ghi chú cho BE, không phải UI.)

---

## §6. Guard + trạng thái loading / error

### Guard vào trang (gọi API ngay khi mount)
- **Thiếu `?order=`** → redirect `/gio-hang`.
- **Đơn không tồn tại** (404) → trang lỗi: "Không tìm thấy đơn hàng." + CTA "Về trang chủ".
- **Đơn không thuộc user** (403) → "Bạn không có quyền xem đơn hàng này." + CTA "Về trang chủ". (Không lộ thông tin đơn của người khác.)
- **Đơn đã thanh toán rồi** → redirect ngay `/dat-hang/thanh-cong?order=...` (tránh thanh toán 2 lần).
- **Đơn đã hủy** → hiển thị §5.2 luôn.
- **paymentMethod != MOMO** (VD user quay lại sau khi đổi ý sang COD) → redirect `/dat-hang/thanh-cong?order=...` (đơn COD đã có trang thành công riêng).
- **Chưa login** → `/dang-nhap?returnTo=/thanh-toan?order=...` (kế thừa màn 5/6).

### Loading
- Vào trang: skeleton card (QR placeholder xám nhấp nháy + 2 dòng text) + text "Đang tạo yêu cầu thanh toán, vui lòng không tắt trang..." trong lúc gọi `POST /payments/momo/create`.
- Nút "Tạo lại thanh toán": spinner trên nút, disable double-click.

### Error từng case (tiếng Việt cụ thể)
- Tạo payment thất bại (MoMo API lỗi / timeout): banner đỏ "Không tạo được yêu cầu thanh toán. Vui lòng thử lại." + nút "Thử lại" (giữ nguyên đơn `MỚI`, không mất gì).
- Lỗi mạng khi poll: không banner to — chỉ dòng nhỏ "Mất kết nối, đang thử lại..." dưới QR; poll tiếp tục nền. (Tránh user hoảng khi mạng chập chờn.)
- Nút "Tôi đã thanh toán" mà MoMo báo chưa có giao dịch: message vàng "Chưa ghi nhận thanh toán. Bạn hãy hoàn tất trên app MoMo rồi thử lại." (không báo đỏ — có thể user bấm sớm).

---

## §7. Mobile

- Card full-width, QR 200px căn giữa, nút "Mở app MoMo" sticky ngay dưới QR (vùng chạm ≥ 48px).
- Countdown pill sticky top dưới header khi scroll (luôn thấy thời gian còn lại).
- Các nút full-width, khoảng cách ≥ 12px tránh bấm nhầm "Hủy thanh toán".

---

## §8. Bảo mật phía FE → F-008 (bắt buộc)

1. **Tuyệt đối không** hardcode/nhúng `partnerCode`, `accessKey`, `secretKey`, chữ ký MoMo ở frontend — mọi ký request thực hiện ở backend.
2. QR chỉ render từ `qrCodeUrl` backend trả về (payload do MoMo sinh). FE không tự tạo QR từ amount/orderNumber.
3. Không `console.log` response tạo payment / deeplink / bất kỳ field nào liên quan MoMo.
4. `orderNumber` trên URL là mã public (`NT-...`), không phải ID nội bộ — an toàn khi share (đã có guard 403 cho đơn người khác).

---

## §9. Contract backend + dữ liệu mẫu (builder implement)

**Endpoints:**
- `POST /payments/momo/create` (auth) — body `{ orderNumber }` → `201 { qrCodeUrl, deeplink, momoOrderId, amount, expiresAt }`. Validate: đơn thuộc user, `status=MỚI`, `paymentMethod=MOMO`, chưa có payment thành công.
- `GET /orders/{orderNumber}` (auth, đã có từ màn 7 — bổ sung) → thêm khối `payment: { method, status: "CHƯA THANH TOÁN|ĐÃ THANH TOÁN|THẤT BẠI", paidAt? }`.
- `GET /payments/momo/status?order=<orderNumber>` (auth) — backend query trực tiếp MoMo (cho nút "Tôi đã thanh toán") → `{ status, paidAt? }`.
- `POST /orders/{orderNumber}/cancel` (auth) — hủy khi còn `MỚI` + chưa thanh toán → hoàn kho + hoàn lượt voucher (F-009).
- `POST /webhooks/momo/ipn` (server-to-server, không UI) — đối chiếu `momoOrderId` + chữ ký → cập nhật payment; idempotent theo `providerRef` (MoMo transId).

**Dữ liệu mẫu demo** (kế thừa màn 7: đơn `NT-20261011-0001`, tổng `15.600.000đ`):
- QR mẫu (ảnh QR giả lập), countdown mặc định `30:00`.
- Toggle trong "Bảng điều khiển demo": "Mô phỏng thanh toán thành công" (poll lần 2 → success) / "Mô phỏng thất bại" / "Mô phỏng hết hạn" (nút "Rút ngắn countdown còn 10 giây") / "Mô phỏng tạo payment thất bại" / "Mô phỏng đơn đã thanh toán rồi" (test guard).

---

## §10. Traceability

| Mục spec | Nguồn |
|---|---|
| Route `/thanh-toan?order=...`, hiển thị mã đơn + số tiền read-only, QR + deeplink "Mở app MoMo" | FR-010 · F-008 · task wave 2 |
| Countdown 30 phút giữ đơn, hết giờ → đơn tự hủy + hoàn kho + hoàn lượt voucher | F-008 (30 phút [Giả định]) · US-012 |
| Poll `GET /orders/{id}` mỗi 4s → `ĐÃ THANH TOÁN` → trang thành công dùng chung màn 7 | F-008 · US-012 |
| Nút "Tôi đã thanh toán xong" → query trực tiếp MoMo | F-008 (suy ra từ UX, không trái docs) |
| Thất bại → "Tạo lại thanh toán" / "Chọn phương thức khác" (đơn vẫn MỚI) | US-012 · F-008 |
| Hủy bởi user → confirm inline → hoàn kho + về giỏ | F-009 |
| Guard: 404/403/đã thanh toán/đã hủy/sai phương thức/chưa login | FR-010 · F-008 · kế thừa màn 5/6 |
| Tuyệt đối không lộ secret MoMo ở FE; QR chỉ từ payload backend | F-008 (bắt buộc) |
| Text tiếng Việt, không mã nội bộ (không hiện SKU/transId thô) | copy-ux-linter |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Quét mã QR`, `Mở app MoMo`, `Tôi đã thanh toán xong`, `Đang chờ thanh toán`, `Đã thanh toán`, `Hết hạn thanh toán`, `Tạo lại thanh toán`, `Hủy thanh toán`, `Đơn đã hủy do quá thời gian thanh toán`.

**Ghi chú cho live-ui-builder:** demo là mock hoàn toàn (không gọi MoMo thật) — QR mẫu, countdown và các toggle mô phỏng ở §9 là đủ để user duyệt cảm nhận. Khi sang code thật, `paymentApi.js` giữ nguyên interface, chỉ đổi `VITE_USE_MOCK=false`.
