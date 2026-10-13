# Spec giao diện — Hồ sơ / Tài khoản (ho-so)

- **Dự án:** noi-that-shop · **Màn:** Hồ sơ (màn 12, wave 3: Tương tác)
- **Nguồn:** FR-015, FR-016 (link) · F-010, F-011, F-024 · Entity: User (+ Address embedded) · *Lưu ý: `04-user-stories.md` không có US riêng cho quản lý hồ sơ — spec trace về FR/F-xxx, không bịa US (theo pattern spec wishlist).*
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Design system:** tái dùng nguyên xi §0 của `trang-chu.md` (tokens warm wood, Be Vietnam Pro, components Nút Primary/Secondary, Badge, Card). Không định nghĩa lại.
- **Giải quyết TODO tồn đọng:** `Header.jsx` hiện có comment `TODO(wave-3 ho-so)` — avatar click đang `navigate('/tai-khoan')` vào catch-all. Màn này tạo route thật + menu avatar (xem §6).

---

## §1. Bố cục tổng thể → FR-015

Route gốc `/tai-khoan`. Layout 2 cột trong container 1200px:

- **Cột trái (3/12) — Sidebar tài khoản** (card `--surface`, bo 16px, sticky top dưới header):
  - Khối định danh: avatar tròn 64px (ảnh nếu có, không thì chữ cái đầu tên trên nền `--brand-700` chữ trắng — giống Header) + họ tên (16px/700) + SĐT (13px, `--text-muted`) + badge `Đã xác thực` nếu `phoneVerified=true` (xem §2.3).
  - Menu dọc (item: icon + chữ 15px, active = nền `#F5EFE6` + chữ `--brand-700` 600 + viền trái accent 3px):
    1. `Hồ sơ cá nhân` → `/tai-khoan`
    2. `Sổ địa chỉ` → `/tai-khoan/dia-chi`
    3. `Đổi mật khẩu` → `/tai-khoan/doi-mat-khau`
    4. `Đơn hàng của tôi` → `/don-hang` (route màn 11 — rời layout tài khoản, FR-016)
    5. `Sản phẩm yêu thích` → `/yeu-thich` (route màn 10 — rời layout tài khoản, FR-018)
  - Cuối sidebar: nút Text đỏ `Đăng xuất` (xem §6).
- **Cột phải (9/12):** nội dung theo route con (§2/§3/§4). Mỗi tab có H2 riêng 20px/700 + mô tả nhỏ 13px `--text-muted`.
- **Breadcrumb:** `Trang chủ / Tài khoản / {Tên tab}`.
- **Mobile (<768px):** sidebar thu thành card ngang trên cùng: avatar 44px + tên + SĐT 1 dòng; menu thành **hàng chips cuộn ngang** (chip active = nền `--brand-700` chữ trắng); nút Đăng xuất nằm cuối trang nội dung. Nội dung full-width bên dưới.

**Thứ tự ưu tiên hiển thị:** định danh + trạng thái xác thực SĐT > form tab hiện tại > đăng xuất.

---

## §2. Tab Hồ sơ cá nhân — `/tai-khoan` → FR-015, F-011

### 2.1 Khối ảnh đại diện [Giả định — cần chốt]

- Avatar tròn 96px giữa/trái khối đầu form: có ảnh → hiển thị ảnh; chưa có → chữ cái đầu.
- Nút Secondary nhỏ `Đổi ảnh` → mở file picker: nhận JPG/PNG/WebP, tối đa 2MB **[Giả định]**; chọn xong hiện **preview tròn ngay** (optimistic) + nút `Lưu ảnh` / tự lưu ngay khi chọn (chốt: tự lưu ngay, hiện spinner trên avatar, lỗi → khôi phục ảnh cũ + toast đỏ).
- Nút Text `Xóa ảnh` (chỉ hiện khi đang có ảnh) → về avatar chữ cái.
- ⚠️ **[Giả định]**: ERD User hiện **không có field avatar** — builder implement theo field đề xuất `avatarUrl`; cần doc-writer bổ sung vào `02-ERD.md` §User (theo pattern màn 9 thêm `Review.color`, màn 10 thêm `priceAtSave`).

### 2.2 Form thông tin

| Field | Loại | Quy tắc |
|---|---|---|
| Họ tên | text, bắt buộc | 2–50 ký tự; prefill `user.fullName` |
| Email | **read-only** | Hiển thị `user.email` + dòng chú thích 13px `--text-muted`: `Email dùng để đăng nhập. Nếu cần đổi email, vui lòng liên hệ hotline 1900 6868.` — *Lý do: F-010 định email là định danh đăng nhập (unique), docs không định nghĩa luồng đổi email → không tự chế luồng; xem ghi chú cuối spec.* |
| Số điện thoại | read-only + hành động | Xem §2.3 |
| Ngày sinh / Giới tính | — | **Không đưa vào form**: ERD User không có `dateOfBirth`/`gender` → không bịa field (operating rule 1). Nếu chủ dự án muốn thêm, cập nhật ERD trước rồi bổ sung spec sau. |

- Nút Primary `Lưu thay đổi` cuối form: **disabled khi form chưa thay đổi gì** (so với dữ liệu gốc); click → loading spinner trên nút → thành công: toast xanh `Đã lưu thay đổi.` + cập nhật tên ở Header/sidebar ngay (qua `mocan:auth-changed`, cơ chế sẵn có của `utils/auth.js`); thất bại: toast đỏ + giữ nguyên form.
- Validate inline: họ tên trống/quá ngắn → viền đỏ + message dưới field `Vui lòng nhập họ tên.` / `Họ tên cần từ 2 ký tự.`

### 2.3 Số điện thoại & xác thực → FR-030, F-024

Hàng SĐT trong form (không sửa trực tiếp tại đây):

- **Đã xác thực** (`phoneVerified=true`): SĐT (định dạng `0901 234 567`) + Badge success `Đã xác thực` + nút Text `Đổi số`.
- **Chưa xác thực**: SĐT + Badge warning `Chưa xác thực` + nút Primary nhỏ `Xác thực ngay`.
- **`Xác thực ngay`** → mở **luồng OTP ngay trong tab** (panel mở rộng dưới hàng SĐT, tái dùng component `OtpInput` + `authApi.sendOtp/verifyOtp` của màn 6 — không chuyển trang): gửi mã về chính SĐT hiện tại → nhập 6 số (tự nhảy ô, đếm ngược gửi lại 60s, mã hết hạn 5 phút, sai tối đa 5 lần — đúng F-024) → thành công: badge chuyển `Đã xác thực`, panel đóng, toast xanh `Số điện thoại đã được xác thực.`
- **`Đổi số`** → panel mở rộng: ô nhập SĐT mới (validate 10 số, đầu 0) + nút `Gửi mã xác thực` → OTP gửi về **số mới** → nhập đúng → SĐT cập nhật + `phoneVerified=true` (đổi SĐT phải xác thực lại — F-024) + toast `Đã đổi số điện thoại.`
  - Edge (F-024): SĐT mới đã được tài khoản khác xác thực → message đỏ tại panel: `Số điện thoại này đã được dùng cho tài khoản khác. Vui lòng liên hệ hotline 1900 6868 để được hỗ trợ.` — không đổi, không đóng panel.
  - Đang có panel mở mà bấm `Hủy` → đóng panel, giữ SĐT cũ.

---

## §3. Tab Sổ địa chỉ — `/tai-khoan/dia-chi` → FR-015, F-011

**Tái dùng 100% màn 7 — KHÔNG thiết kế lại:**

- Dùng lại `AddressCard.jsx` (hiển thị label, receiverName, phone, địa chỉ đầy đủ, tag `Mặc định`, nút Sửa/Xóa) + `AddressForm.jsx` (form inline: label chips Nhà/Công ty, tên người nhận, SĐT, tỉnh/quận/phường phụ thuộc, địa chỉ chi tiết, ghi chú, checkbox đặt mặc định) + `addressApi.js` (`getAddresses/createAddress/updateAddress/deleteAddress`).
- Nội dung tab = đúng khối §2.1–2.2 của spec `dat-hang.md`: radio/list địa chỉ, nút `+ Thêm địa chỉ mới` mở form inline, **tối đa 5 địa chỉ** (đủ 5 → ẩn nút thêm + hint `Bạn đã lưu tối đa 5 địa chỉ.`), **luôn đúng 1 mặc định** — xóa địa chỉ mặc định → tự chuyển mặc định sang địa chỉ còn lại đầu tiên (F-011).
- Khác biệt duy nhất so với checkout: ở đây list **không có radio chọn** (không trong luồng đặt hàng) — mỗi card chỉ có Sửa / Xóa / `Đặt làm mặc định` (với card chưa mặc định).
- Đồng bộ hai chiều: địa chỉ sửa ở tab này phải hiện đúng ở bước 1 checkout (cùng API — không cache riêng).

---

## §4. Tab Đổi mật khẩu — `/tai-khoan/doi-mat-khau` → F-010

### 4.1 Form (áp dụng khi user có mật khẩu — `passwordHash != null`)

| Field | Quy tắc |
|---|---|
| Mật khẩu hiện tại | `type=password` + toggle mắt (pattern màn 6); bắt buộc |
| Mật khẩu mới | `type=password` + toggle mắt; **≥ 8 ký tự** (F-010); thanh độ mạnh dưới field: Yếu (đỏ) / Trung bình (vàng `--warning`) / Mạnh (xanh `--success`) — tính theo độ dài + trộn chữ hoa/thường/số/ký tự đặc biệt; message gợi ý `Dùng ít nhất 8 ký tự, gồm chữ, số và ký tự đặc biệt.` |
| Nhập lại mật khẩu mới | phải khớp mật khẩu mới; không khớp → message `Mật khẩu nhập lại chưa khớp.` |

- Checkbox (mặc định **không** check): `Đăng xuất khỏi các thiết bị khác sau khi đổi mật khẩu` **[Giả định — docs chưa định nghĩa quản lý phiên đa thiết bị; builder implement field `logoutOtherDevices`, backend hỗ trợ thì bật, chưa có thì ẩn checkbox]**.
- Nút Primary `Đổi mật khẩu`: disabled cho đến khi cả 3 field hợp lệ; click → loading → thành công: toast xanh `Đã đổi mật khẩu.` + **xóa trắng form** (không giữ mật khẩu trên màn hình).
- **Error từng case:**
  - Sai mật khẩu hiện tại → message đỏ ngay dưới field hiện tại: `Mật khẩu hiện tại chưa đúng.` (không dùng message chung chung). *Lưu ý bảo mật: lỗi này tách riêng được vì user đã đăng nhập — khác luồng login.*
  - Mật khẩu mới trùng mật khẩu hiện tại → `Mật khẩu mới cần khác mật khẩu hiện tại.`
  - Lỗi mạng/server → toast đỏ `Có lỗi xảy ra, vui lòng thử lại.` + giữ form (trừ field mật khẩu hiện tại vẫn giữ để thử lại nhanh — chốt: giữ cả 3 field, không tự xóa khi lỗi).

### 4.2 Tài khoản Google (chưa có mật khẩu — `passwordHash == null`)

- Thay form bằng khối thông báo: `Bạn đang đăng nhập bằng Google nên chưa có mật khẩu.` + form rút gọn **Tạo mật khẩu**: chỉ 2 field (Mật khẩu mới + Nhập lại, validate như §4.1) + nút `Tạo mật khẩu`. Sau khi tạo → các lần sau dùng form §4.1. **[Suy luận từ ERD `passwordHash "null nếu login Google"` + F-010 input Google OAuth2.]**

---

## §5. Guard + trạng thái loading / empty / error → FR-015

- **Chưa login:** vào bất kỳ route `/tai-khoan*` nào → redirect `/dang-nhap?returnTo=<route đích>` (đúng pattern màn 6, `LoginPage` đã hỗ trợ `returnTo`).
- **Loading:** skeleton: sidebar (khối avatar xám + 5 dòng menu) + cột phải (3 dòng form xám). Tab Địa chỉ: skeleton 2 card địa chỉ (tái dùng pattern màn 7).
- **Empty:** chỉ áp dụng tab Địa chỉ khi chưa có địa chỉ nào: khối trống `Bạn chưa lưu địa chỉ nào.` + nút Primary `+ Thêm địa chỉ đầu tiên` (mở AddressForm). Tab Hồ sơ/Đổi mật khẩu không có empty state (luôn có dữ liệu user).
- **Error tải dữ liệu:** banner đỏ trong cột phải `Không tải được thông tin. Vui lòng thử lại.` + nút `Thử lại`.
- **User bị khóa** (`status=LOCKED`): vào được trang nhưng mọi form disabled + banner vàng đầu trang `Tài khoản của bạn đang bị khóa. Vui lòng liên hệ hotline 1900 6868.` **[Suy luận từ ERD `User.status` + F-010 khóa 15 phút.]**

---

## §6. Đăng xuất + menu avatar Header → F-010 (phiên đăng nhập)

- **Điểm bấm:** (1) nút `Đăng xuất` cuối sidebar §1; (2) **menu dropdown avatar ở Header** (màn này bổ sung, đóng TODO màn 6): click avatar → dropdown nhỏ gồm: đầu menu (tên + email, không bấm được) · `Hồ sơ cá nhân` → `/tai-khoan` · `Đơn hàng của tôi` → `/don-hang` · `Sản phẩm yêu thích` → `/yeu-thich` · divider · `Đăng xuất`. Click ngoài/Esc đóng dropdown; mobile: dropdown vẫn dùng được (avatar ở header mobile).
- **Hành vi:** không hỏi confirm → gọi `clearSession()` (`utils/auth.js` sẵn có: xóa `accessToken` + `mocan_user` ở cả local/session storage, phát `mocan:auth-changed`) → Header tự về trạng thái chưa login → điều hướng `/` → toast `Đã đăng xuất. Hẹn gặp lại bạn!`
- **Không xóa** giỏ hàng local (`mocan_cart_v1`) và wishlist local (`mocan_wishlist_v1`) khi đăng xuất — dữ liệu khách vãng lai theo thiết kế màn 5/10; lần đăng nhập sau sẽ merge lại.

---

## §7. Contract backend + dữ liệu mẫu (builder implement)

**Endpoints** (prefix `/auth` theo AuthController màn 6; địa chỉ đã có từ màn 7):

- `GET /auth/me` → `{ id, fullName, email, phone, phoneVerified, avatarUrl, hasPassword, status, createdAt }` (auth)
- `PUT /auth/me` — body `{ fullName }` → user đã cập nhật (auth)
- `POST /auth/me/avatar` — multipart `file` → `{ avatarUrl }`; `DELETE /auth/me/avatar` → xóa ảnh (auth) **[Giả định theo §2.1]**
- `POST /auth/change-password` — body `{ currentPassword, newPassword, logoutOtherDevices? }` → `200`; sai mật khẩu hiện tại → `400 { message }` (auth)
- `POST /auth/me/password` — body `{ newPassword }` (tạo mật khẩu cho tài khoản Google, §4.2) **[Suy luận ERD]**
- Đổi/xác thực SĐT: tái dùng `POST /auth/otp/send` + `POST /auth/otp/verify` (màn 6, `purpose: "verify-phone" | "change-phone"`) rồi `PUT /auth/me/phone` — body `{ phone }` kèm phiên OTP đã verify ở server → SĐT trùng tài khoản khác → `409 { message }`
- Địa chỉ: `GET/POST/PUT/DELETE /addresses` — **đã có từ màn 7, không thêm mới**
- `vite.config.js`: các prefix `/auth`, `/addresses` **đã có proxy sẵn** (verify trong file — bài học /claims); avatar trả URL `/uploads/**` — entry `/uploads` đã thêm ở màn 9.

**Dữ liệu mẫu demo** (khớp tài khoản demo màn 6):
- User: họ tên `Nguyễn Minh Anh`, email `minhanh.nguyen@gmail.com`, SĐT `0901234567` (`phoneVerified=true`, badge `Đã xác thực`), chưa có avatar (chữ `N`), có mật khẩu.
- Địa chỉ mẫu: dùng đúng 2 địa chỉ mẫu của màn 7 (1 mặc định `Nhà`, 1 `Công ty`).
- **Toggle demo** (cho live builder): `Chưa xác thực SĐT` (badge warning + nút Xác thực ngay; OTP demo `123456` như màn 6) · `Tài khoản Google` (tab Đổi mật khẩu → form Tạo mật khẩu §4.2) · `Lỗi tải dữ liệu` (banner error + Thử lại).

---

## §8. Traceability

| Mục spec | Nguồn |
|---|---|
| Layout sidebar + tab Hồ sơ/Địa chỉ, sửa thông tin cá nhân | FR-015 · F-011 |
| Sổ địa chỉ: tối đa 5, luôn 1 mặc định, xóa mặc định → tự chuyển; tái dùng AddressCard/AddressForm/addressApi màn 7 | FR-015 · F-011 |
| Menu `Đơn hàng của tôi` link `/don-hang` (không làm lại) | FR-016 (màn 11) |
| Menu `Sản phẩm yêu thích` link `/yeu-thich` (không làm lại) | FR-018 (màn 10) |
| SĐT read-only + badge Đã xác thực / CTA Xác thực ngay (OTP trong trang) | FR-030 · F-024 |
| Đổi SĐT → OTP về số mới, xác thực lại; SĐT trùng tài khoản khác → từ chối + hướng dẫn hotline | F-024 (business rules + edge case) |
| Đổi mật khẩu: ≥ 8 ký tự, sai mật khẩu hiện tại → message riêng | F-010 |
| Tài khoản Google chưa có mật khẩu → Tạo mật khẩu | ERD User.`passwordHash` · F-010 (Google OAuth2) |
| Đăng xuất: xóa token/user storage, về trang chủ; giữ giỏ + wishlist local | F-010 (phiên JWT) · màn 5/10 (thiết kế local) |
| Menu dropdown avatar Header (đóng TODO màn 6) | Header.jsx TODO(wave-3 ho-so) |
| Email read-only + hướng dẫn liên hệ hỗ trợ | F-010 (email = định danh đăng nhập; docs không có luồng đổi email) |
| Avatar upload + preview tròn, field `avatarUrl` | **[Giả định]** — ERD chưa có, cần doc-writer bổ sung |
| Ngày sinh / Giới tính: **không có trong form** | ERD User không có 2 field này — không bịa |
| User LOCKED → banner + disable form | ERD User.`status` · F-010 |
| Text tiếng Việt, không mã nội bộ, SĐT/OTP không log ra console | copy-ux-linter · F-024 (không lưu/log OTP plain) |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Hồ sơ cá nhân`, `Sổ địa chỉ`, `Đổi mật khẩu`, `Ảnh đại diện`, `Đã xác thực`, `Chưa xác thực`, `Xác thực ngay`, `Đổi số điện thoại`, `Lưu thay đổi`, `Đăng xuất`, `Mật khẩu hiện tại`, `Mật khẩu mới`.

**Điểm cần parent/user chốt (không chặn dựng demo):** (1) field `avatarUrl` bổ sung ERD; (2) email read-only — nếu muốn cho đổi email cần spec riêng (đổi email = đổi định danh đăng nhập, cần xác nhận qua email mới + mật khẩu); (3) checkbox `Đăng xuất khỏi các thiết bị khác` chờ backend xác nhận hỗ trợ quản lý phiên.
