# Spec giao diện — Đăng nhập / Đăng ký / Xác thực SĐT (dang-nhap-otp)

- **Dự án:** noi-that-shop · **Màn:** Đăng nhập / OTP (màn 6 — wave 2, màn đầu tiên)
- **Nguồn:** US-006 · US-020 · FR-008 · FR-009 · FR-014 · FR-030 · F-006 · F-010 · F-024
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo (wave 2 đang chạy)
- **Ghi chú:** Tái dùng nguyên design system spec Trang chủ §0 (tokens, typography, Button/Badge/Input/Form). Đăng ký yêu cầu SĐT bắt buộc (F-010); xác thực SĐT bằng OTP là **bắt buộc trước khi đặt hàng** (FR-030, quyết định Q5 của chủ dự án). Không hiển thị SKU/mã nội bộ (bài học insuren). Demo dựng bằng OTP giả (mock) như các màn wave 1 dùng mock data — chọn nhà cung cấp SMS thật là việc backend, đã có bản so sánh riêng chờ duyệt.

---

## §1. Bố cục tổng thể

**Route:** `/dang-nhap` (tab Đăng nhập mặc định) · `/dang-ky` (tab Đăng ký) — chung 1 layout, đổi tab qua query hoặc 2 route đều được.

1. Layout 2 cột desktop: **trái** card form (max-width 440px) · **phải** panel thương hiệu (ảnh nội thất, slogan, lợi ích tài khoản: theo dõi đơn, sổ địa chỉ, nhận ưu đãi). Mobile: chỉ card form, panel ẩn.
2. Breadcrumb: `Trang chủ / Đăng nhập` (hoặc `/ Đăng ký`).
3. Header có nút đóng (×) → quay lại trang trước.
4. Nếu đã đăng nhập mà vào route này → redirect `/tai-khoan`.

**Tham số `returnTo`:** mọi link yêu cầu đăng nhập (vd: bấm "Đặt hàng" ở giỏ khi chưa login) dẫn đến `/dang-nhap?returnTo=/dat-hang`; đăng nhập/đăng ký xong → tự chuyển về `returnTo` thay vì trang chủ (FR-009: checkout không cho khách vãng lai).

---

## §2. Tab Đăng nhập → F-010, F-006, FR-008, US-006

Segmented control 2 chế độ trên cùng form: **[Số điện thoại | Mật khẩu]** (pill, active = nền `--brand-700` chữ trắng).

### 2a. Chế độ "Số điện thoại" (đăng nhập bằng OTP)

- Input SĐT, prefix `+84` cố định (xám, không sửa), placeholder `912 345 678`.
- Validation VN: `^0(3|5|7|8|9)\d{8}$`; sai → đỏ dưới input: `Số điện thoại chưa đúng định dạng. Vui lòng nhập 10 chữ số, bắt đầu bằng 0.`
- Nút Primary full-width `Gửi mã xác thực` → sang view OTP (§4, purpose=`login`).
- SĐT chưa có tài khoản → banner vàng: `Chưa có tài khoản với số điện thoại này.` + link **Đăng ký ngay →** (chuyển tab Đăng ký, giữ nguyên SĐT đã nhập).

### 2b. Chế độ "Mật khẩu"

- **Fields:** `Số điện thoại hoặc email` (identifier — đăng ký lưu cả 2 theo F-010) · `Mật khẩu` (**mặc định `type=password`**, toggle 👁 `aria-label="Hiện/ẩn mật khẩu"`).
- **Checkbox "Ghi nhớ đăng nhập"** (mặc định bật) + link **"Quên mật khẩu?"** (xem §5).
- **Nút Primary** `Đăng nhập` full-width.

**Validation & lỗi (inline dưới field, chữ đỏ 13px):**
- Định dạng identifier sai → `Vui lòng nhập đúng số điện thoại hoặc email`.
- Mật khẩu trống → `Vui lòng nhập mật khẩu`.
- Sai thông tin → banner đỏ trên form: `Số điện thoại/email hoặc mật khẩu chưa đúng. Bạn còn {n} lần thử.` — sai 5 lần → khóa 15 phút, banner: `Tài khoản tạm khóa 15 phút do nhập sai quá nhiều lần. Vui lòng thử lại sau.` (F-010) + nút disabled kèm đếm ngược mở lại.

### 2c. Đăng nhập bằng Google → FR-014

- **Divider** `hoặc` + nút Outline **`Tiếp tục với Google`** (icon G màu) — kế thừa pattern insuren. Loading overlay `Đang kết nối Google…`; bị hủy → ở nguyên tab + toast `Bạn đã hủy đăng nhập Google.`
- Google xong nếu chưa có SĐT → view bổ sung SĐT: input SĐT + nút `Gửi mã xác thực` → view OTP (F-010: "Google OAuth2 (sau đó bổ sung SĐT)").
- **Dưới cùng:** `Chưa có tài khoản? ` **Đăng ký ngay** → chuyển tab.

**Đăng nhập thành công (cả 3 chế độ):**
1. Gọi `mergeCartAfterLogin(onToast)` từ `api/cartApi.js` (màn 5 đã chuẩn bị). Giỏ local có món → toast xanh 4s, copy đã duyệt: `Đã gộp {N} sản phẩm từ giỏ hàng trước khi đăng nhập của bạn.` Giỏ rỗng → không toast.
2. Redirect `navigate(returnTo || '/')` (§1).
3. Header: cụm "Tài khoản" → avatar tròn (chữ cái đầu tên, nền `--brand-700`, chữ trắng) + tên user 13px/600. *(Click avatar → menu Đơn hàng/Hồ sơ/Đăng xuất: thuộc màn Hồ sơ wave 3.)*

---

## §3. Tab Đăng ký → F-010, US-006

- **Fields:** Họ tên · Email · **Số điện thoại (bắt buộc)** · Mật khẩu · Nhập lại mật khẩu.
- **Checkbox bắt buộc:** `Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật` (chưa tick → nút disabled).
- **Nút Primary** `Đăng ký tài khoản`.
- **Dưới cùng:** `Đã có tài khoản? ` **Đăng nhập**.

**Validation & lỗi:**
- Họ tên < 2 ký tự → `Vui lòng nhập họ tên`.
- Email đã tồn tại → `Email này đã được đăng ký. ` + link **Đăng nhập**.
- SĐT: chuẩn hóa đầu số VN (0xxxxxxxxx hoặc +84); sai định dạng → `Số điện thoại chưa đúng định dạng`. SĐT đã được tài khoản khác xác thực → `Số điện thoại này đã được dùng cho tài khoản khác. Vui lòng liên hệ hỗ trợ.` (F-024 edge case).
- Mật khẩu < 8 ký tự → `Mật khẩu cần ít nhất 8 ký tự` (F-010). Nhập lại không khớp → `Mật khẩu nhập lại chưa khớp`.

**Đăng ký thành công:** KHÔNG cho vào thẳng app — chuyển ngay sang bước xác thực SĐT (§4) với banner xanh: `Đăng ký thành công! Hãy xác thực số điện thoại để bắt đầu đặt hàng.`

---

## §4. Xác thực SĐT bằng OTP → F-024, US-020, FR-030

**Route:** `/xac-thuc-sdt` (hoặc modal toàn màn hình nếu đang ở checkout).

1. Tiêu đề: `Xác thực số điện thoại`; mô tả: `Chúng tôi đã gửi mã 6 số đến **{phone}**` + link **Đổi số** (quay lại sửa SĐT → phải xác thực lại, F-024).
2. **6 ô nhập OTP** (mỗi ô 1 số, 48×56px, `inputmode="numeric"`, `autocomplete="one-time-code"`): tự nhảy ô tiếp theo khi nhập; Backspace ở ô trống → lùi ô trước và xóa; **paste cả dãy 6 số → điền hết**; chỉ nhận ký tự số. **Nhập đủ 6 số → tự động xác thực** (không cần bấm thêm).
3. Nút Primary `Xác nhận` (dự phòng cho người không muốn chờ tự động).
4. **Gửi lại mã:** đếm ngược `Gửi lại sau {60}s`; hết giờ → link `Gửi lại mã`. OTP hiệu lực 5 phút (F-024) — hết hiệu lực hiện banner vàng `Mã đã hết hạn. Vui lòng bấm Gửi lại mã để nhận mã mới.` và focus vào nút gửi lại.
5. Sai 5 lần → khóa nhập, banner đỏ `Bạn đã nhập sai quá 5 lần. Mã này đã bị hủy — vui lòng bấm Gửi lại mã để nhận mã mới.` (F-024).

**Bảo mật UI:** tuyệt đối không `console.log` mã OTP ra console; mật khẩu luôn `type=password` mặc định (§2b, §3, §5). Chỉ bản demo mới được hiển thị mã mẫu trên màn hình.

**Xác thực thành công:** `user.phoneVerified = true`; toast xanh `Xác thực thành công! Giờ bạn có thể đặt hàng.` → chuyển về `returnTo` hoặc `/`.

**Nơi xuất hiện lời nhắc xác thực (không chỉ sau đăng ký):**
- Banner vàng trên header (mọi trang) khi `phoneVerified != true`: `⚠ Xác thực SĐT để đặt hàng ` + nút `Xác thực ngay`.
- Ở checkout: bấm "Đặt hàng" khi chưa xác thực → **chặn cứng** (F-007 business rule 1) + modal hướng dẫn xác thực (FR-030).

**Demo:** OTP demo = mã giả hiện ngay trên màn hình demo (giống cách các màn wave 1 dùng mock data), để chủ dự án duyệt flow mà không cần SMS thật.

---

## §5. Quên mật khẩu → F-010 (mở rộng hợp lý)

1. Link từ tab Đăng nhập → route `/quen-mat-khau`: nhập email → nút `Gửi link đặt lại`.
2. Thành công: màn hình xác nhận `Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (kể cả thư rác).`
3. Link trong email (hiệu lực 30 phút **[Giả định]**) → trang đặt mật khẩu mới (mật khẩu + nhập lại, rule ≥ 8 ký tự như §3) → toast `Đổi mật khẩu thành công, mời bạn đăng nhập lại.`

---

## §6. Trạng thái & edge cases

- **Đang tải:** nút Primary hiện spinner + disabled khi submit (tránh double-submit tạo 2 tài khoản).
- **Mất mạng:** banner đỏ `Không có kết nối mạng. Vui lòng thử lại.`
- **Google OAuth bị hủy:** ở nguyên tab, toast `Bạn đã hủy đăng nhập Google.`
- **Đổi SĐT sau khi đã xác thực:** vào Hồ sơ → sửa SĐT → `phoneVerified` reset về false + bắt buộc xác thực lại (F-024).
- **Admin đăng nhập:** cùng form này; sau login nếu `role=ADMIN` → redirect `/admin` (RBAC đã có ở backend từ màn Trang chủ).
- **Copy:** toàn bộ chữ tiếng Việt tự nhiên cho người dùng cuối — không dùng từ nội bộ (token, payload, hash...), không hiện mã lỗi kỹ thuật (bài học insuren copy-rewrite).

---

## §7. Backend cần có (song song, như quy ước wave 1)

- `AuthController`: `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, `POST /auth/forgot-password`, `POST /auth/reset-password` — JWT + bcrypt + khóa 15 phút sau 5 lần sai (kế thừa pattern insuren).
- OTP gom vào `AuthController`: `POST /auth/otp/send {phone, purpose}`, `POST /auth/otp/verify {phone, code, purpose}` — OTP 6 số, TTL 5 phút, resend ≥ 60s, tối đa 5 lần sai, 1 SĐT = 1 tài khoản đã xác thực (F-024). *(Chốt 2026-10-11: dùng `/auth/otp/*` thay vì `/otp/*` riêng.)* Provider SMS thật cấu hình ở server — bản so sánh provider đã chuẩn bị riêng, chờ duyệt.
- Frontend `vite.config.js`: giữ nguyên proxy entry — `/auth` đã có sẵn trong file (đã verify 2026-10-11), FE chỉ gọi `/auth/*`.

---

## §8. Traceability

| Spec mục | Nguồn |
|---|---|
| Route `/dang-nhap` + `?returnTo=`, layout 2 cột, breadcrumb | FR-014, FR-009 |
| Chế độ "Số điện thoại" (login bằng OTP) | FR-030, F-024 + yêu cầu task |
| Chế độ "Mật khẩu" (SĐT/email + pass), quên mật khẩu, ghi nhớ đăng nhập | F-010 + yêu cầu task |
| "Tiếp tục với Google", bổ sung SĐT sau Google | FR-014, F-010 |
| Đăng ký: họ tên + email + SĐT bắt buộc + pass ≥ 8 ký tự → OTP | F-010, FR-030 |
| 6 ô OTP tự nhảy/paste/tự xác thực, gửi lại 60s, hết hạn 5 phút, sai 5 lần | F-024 |
| Đổi SĐT → xác thực lại; SĐT trùng tài khoản khác → từ chối | F-024 |
| Khóa 15 phút khi sai pass 5 lần | F-010 [Giả định] |
| Gộp giỏ + toast copy đã duyệt, redirect `returnTo` | F-006, FR-008, US-006 |
| Header → avatar/tên user sau login | FR-014 (header spec trang-chu §2.2) |
| Banner xác thực + chặn đặt hàng khi `phoneVerified=false` (ghi chú cho màn Đặt hàng) | FR-030, US-020, F-007 |
| Không log OTP, pass ẩn mặc định | yêu cầu task (bảo mật UI) |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Mã xác thực` (OTP) · `Xác thực số điện thoại` · `Gửi lại mã` · `Tiếp tục với Google` · `Quên mật khẩu?` · `Chưa có tài khoản?` / `Đã có tài khoản?` · `Gửi mã xác thực`
