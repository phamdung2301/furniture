# Hướng dẫn vận hành noi-that-shop — từ mock đến chạy thật

> Trạng thái hiện tại: frontend đang chạy **chế độ mock** (dữ liệu mẫu nằm trong `frontend/src/mocks/`).
> Tài liệu này mô tả toàn bộ đường đi của dữ liệu và các bước để chuyển sang vận hành thật với MongoDB.

---

## 1. Bức tranh tổng thể: dữ liệu đi như thế nào

```
GIAI ĐOẠN MOCK (hiện tại)
  Trình duyệt → Frontend (React) → file mock trong frontend/src/mocks/*.js
  (không có backend, không có database — dữ liệu "chết", sửa mock là sửa code)

GIAI ĐOẠN VẬN HÀNH THẬT
  Trình duyệt → Frontend (React) → API Backend (Spring Boot) → MongoDB
                                      ↑
              Admin CRUD ─────────────┘  (admin cũng đi qua API này)
              Seeder (chạy 1 lần lúc khởi động đầu tiên) ──→ MongoDB
```

Nguyên tắc cốt lõi: **sau khi chuyển sang chạy thật, MongoDB là nguồn dữ liệu duy nhất.**
Frontend không giữ dữ liệu thật nào; mọi trang (khách + admin) đều đọc/ghi qua API.

---

## 2. Bước 1 — Chuẩn bị MongoDB

Chọn 1 trong 2 cách:

- **MongoDB Atlas (cloud, khuyên dùng khi deploy thật):** tạo cluster miễn phí tại mongodb.com/atlas → tạo user database → lấy chuỗi kết nối dạng `mongodb+srv://<user>:<password>@<cluster>/mocan_shop`.
- **MongoDB cài local (để test trên máy bạn):** cài MongoDB Community, chạy service, dùng chuỗi mặc định `mongodb://localhost:27017/mocan_shop`.

Không cần tạo bảng/collection trước — backend tự tạo khi ghi dữ liệu lần đầu.

---

## 3. Bước 2 — Cấu hình backend bằng biến môi trường

Backend đọc cấu hình từ biến môi trường (xem `backend/.env.example` và `application.yml`). Các biến bắt buộc khi vận hành thật:

| Biến | Ý nghĩa | Ghi chú |
|---|---|---|
| `MONGODB_URI` | Chuỗi kết nối MongoDB | Không đặt → mặc định localhost |
| `JWT_SECRET` | Khóa ký token đăng nhập | **Bắt buộc đổi** khi deploy (tối thiểu 32 ký tự ngẫu nhiên) — giá trị mặc định trong code chỉ để dev |
| `ADMIN_EMAIL` / `ADMIN_PHONE` / `ADMIN_PASSWORD` | Tài khoản admin đầu tiên | Backend tự tạo admin khi khởi động nếu chưa có (AdminBootstrap). Mật khẩu ≥ 8 ký tự |
| `MOMO_PARTNER_CODE` / `MOMO_ACCESS_KEY` / `MOMO_SECRET_KEY` | Khóa MoMo | Sandbox lấy tại developers.momo.vn; production dùng khóa thật |
| `MOMO_IPN_URL` / `MOMO_REDIRECT_URL` | URL callback MoMo | Phải là URL public mà MoMo gọi tới được |
| `STORAGE_TYPE` + các biến `S3_*` | Lưu trữ ảnh trên cloud (mục 7) | `local` = ghi đĩa (dev); `s3` = AWS S3 / Cloudflare R2 / MinIO — chi tiết trong `backend/.env.example` |

Ví dụ chạy trên Windows (PowerShell, tại thư mục `backend/`):

```powershell
$env:MONGODB_URI="mongodb+srv://user:pass@cluster/mocan_shop"
$env:JWT_SECRET="chuoi-ngau-nhien-dai-hon-32-ky-tu"
$env:ADMIN_EMAIL="admin@mocan.vn"; $env:ADMIN_PHONE="0909999999"; $env:ADMIN_PASSWORD="mat-khau-admin-cua-ban"
.\mvnw spring-boot:run
```

> Tuyệt đối không commit file chứa secret thật lên git.

---

## 4. Bước 3 — Chạy backend lần đầu: seeder nạp dữ liệu mẫu

Khi backend khởi động với MongoDB **còn trống**, `CatalogSeeder` tự động nạp dữ liệu mẫu
từ `backend/src/main/resources/seed/catalog.json` (trích xuất nguyên vẹn từ dữ liệu mock hiện tại):

| Dữ liệu | Số lượng | Vào collection |
|---|---|---|
| Danh mục | 8 | `categories` |
| Sản phẩm | 23 | `products` |
| Biến thể màu (SKU/giá/tồn từng màu) | 46 | `product_variants` |
| Banner trang chủ | 4 | `banners` |
| Mã giảm giá (NOITHAT50, NOITHAT10) | 2 | `vouchers` |
| Chương trình flash sale mẫu | 1 (5 sản phẩm, giờ tính tương đối lúc chạy) | `vouchers` (type FLASH_SALE) |
| Bậc phí ship theo diện tích | 4 bậc | `shipping_rules` |
| Ngưỡng miễn phí ship (10.000.000đ) | 1 cấu hình | `shipping_configs` |

Kiểm tra log lúc khởi động: seeder in rõ đã nạp bao nhiêu bản ghi từng loại.

**Tính chất quan trọng của seeder:**

- **Idempotent theo từng collection:** collection nào đã có dữ liệu thì seeder *bỏ qua*, không ghi đè.
  Khởi động lại backend bao nhiêu lần cũng an toàn — dữ liệu admin đã sửa không bao giờ bị seeder đè.
- **Muốn nạp lại một loại dữ liệu từ đầu:** xóa collection đó trong MongoDB rồi khởi động lại backend.
  ⚠️ Việc này xóa luôn dữ liệu thật đã phát sinh trong collection đó — chỉ làm khi chắc chắn.
- **Seeder KHÔNG nạp:** khách hàng, đơn hàng, giỏ hàng, đánh giá, wishlist.
  Những dữ liệu này chỉ sinh ra từ vận hành thật (riêng tài khoản admin do AdminBootstrap tạo).

---

## 5. Bước 4 — Chuyển frontend sang dữ liệu thật

Mọi module API của frontend đều có công tắc dùng chung:

- **Chạy dev:** tạo file `frontend/.env.local` với dòng `VITE_USE_MOCK=false`, chạy backend ở cổng 8080 rồi `npm run dev` — Vite tự proxy các đường API sang backend.
- **Build production:** đặt thêm `VITE_API_BASE_URL=https://api.ten-mien-cua-ban` (địa chỉ backend) cùng `VITE_USE_MOCK=false`, sau đó `npm run build` và đưa thư mục `dist` lên hosting tĩnh.
  Nếu frontend và backend cùng một domain (reverse proxy) thì không cần `VITE_API_BASE_URL`.

Từ thời điểm này, dữ liệu mock trong `frontend/src/mocks/` không còn được dùng nữa (chỉ còn là dữ liệu dự phòng khi bật lại mock).

---

## 6. Vận hành hằng ngày — Admin CRUD với dữ liệu đã seed

Đây là phần cốt lõi: **sản phẩm nạp bằng seeder và sản phẩm admin nhập tay là MỘT — không có gì phân biệt.**

Seeder ghi dữ liệu qua đúng các repository/collection mà API admin đang dùng. Sau khi seed xong:

- Danh sách sản phẩm ở `/admin/san-pham` chính là 23 sản phẩm mẫu — admin **sửa tên, giá, tồn kho, ảnh, thêm/xóa màu** như bình thường; mỗi thao tác đi qua API và cập nhật thẳng document trong MongoDB.
- Khách hàng thấy thay đổi **ngay lập tức** ở trang chủ/danh mục/chi tiết, vì phía khách cũng đọc từ cùng document đó.
- **Quy tắc xóa giữ nguyên:** sản phẩm chưa từng có trong đơn hàng → xóa hẳn; đã có trong đơn → chỉ "Ngừng bán" (ẩn khỏi cửa hàng, đơn cũ không bị ảnh hưởng).
- **Thêm sản phẩm mới:** thao tác như bình thường ở trang admin — sản phẩm mới sinh ra trực tiếp trong MongoDB, không liên quan gì tới seeder.
- **Ảnh:** ảnh của sản phẩm seed đang trỏ tới file tĩnh `/images/...` trong `frontend/public/images/`.
  Ảnh admin upload mới đi qua lớp StorageService — ghi vào thư mục `uploads/` khi chạy local, đẩy lên cloud khi `STORAGE_TYPE=s3` — và MongoDB chỉ lưu chuỗi URL — xem mục 7.

Tóm lại vòng đời một sản phẩm: `mock (file JS) → seeder (1 lần) → MongoDB → admin CRUD tiếp quản hoàn toàn`.

---

## 7. Ảnh được lưu như thế nào — 2 đường riêng

MongoDB **không chứa file ảnh** — chỉ chứa chuỗi URL (field `images` của sản phẩm là `[{url, sortOrder}]`, phần tử đầu là ảnh chính; review giữ danh sách URL ảnh). File ảnh thật nằm ngoài DB, theo 2 đường riêng cho 2 loại ảnh:

**Đường 1 — Ảnh của SHOP (sản phẩm / danh mục / banner):** đi qua lớp `StorageService` của backend, chọn bằng biến `STORAGE_TYPE`:

- `local` (mặc định — chỉ phù hợp dev / chạy 1 server): file ghi vào thư mục `uploads/<loại>/` trên máy chạy backend, URL dạng `/uploads/...`, backend tự phục vụ file.
- `s3` (**khuyên dùng khi vận hành thật**): file được đẩy lên cloud object storage tương thích S3 — AWS S3, Cloudflare R2, MinIO… — URL là địa chỉ public/CDN của bucket (`S3_PUBLIC_BASE_URL` nếu có). Cần tạo bucket + điền các biến `S3_*` trong `backend/.env.example`. Không phụ thuộc ổ đĩa server nên nhân bản bao nhiêu máy cũng được.
- Riêng ảnh mẫu đi kèm giao diện là file tĩnh `/images/...` trong `frontend/public/images/` — không qua StorageService.

**Đường 2 — Ảnh của USER (ảnh đính kèm đánh giá):** pipeline **S3 + Lambda nén**, app không giữ binary nào:

- Production (`STORAGE_TYPE=s3`): backend chỉ upload ảnh **gốc** lên `reviews/original/<uuid>.<ext>`; sự kiện S3 ObjectCreated kích hoạt Lambda (xem `infra/lambda-image-compressor/`) nén — resize cạnh dài nhất ≤ 1600px, JPEG quality 82 — rồi ghi bản tối ưu tại `reviews/optimized/<uuid>.jpg` trên cùng bucket và xóa ảnh gốc. URL lưu vào review là URL bản tối ưu, đoán trước được theo uuid; Lambda chạy async ~1 giây nên ảnh có thể hiện chậm một nhịp ngay sau khi khách đăng.
- Dev local (`STORAGE_TYPE=local`): backend tự mô phỏng pipeline — nén bằng Thumbnailator ngay khi upload (cùng thông số) rồi lưu vào `uploads/reviews/` như đường 1.

Hệ quả: đổi/chuyển MongoDB không mất ảnh. Ở chế độ `s3`, chuyển server cũng không phải mang theo thư mục `uploads/` nữa — xem mục 8.

---

## 8. Sao lưu & lưu ý vận hành

- **Backup MongoDB:** dùng `mongodump` định kỳ (hoặc bật backup tự động trên Atlas). Đây là toàn bộ dữ liệu kinh doanh: sản phẩm, đơn, khách, voucher…
- **Backup ảnh:** ảnh review của khách nằm **trên S3 cùng bucket với ảnh shop** (prefix `reviews/optimized/`) — sao lưu theo cơ chế của nhà cung cấp, nên bật **versioning trên bucket**. Thư mục `uploads/` của backend **chỉ còn ý nghĩa khi `STORAGE_TYPE=local`** (chứa ảnh shop + ảnh review của môi trường dev) — đang chạy local thì backup thư mục này cùng chu kỳ với MongoDB; đã chuyển `s3` thì bỏ qua, không cần mang theo khi chuyển server.
- **Không commit `.env`/secret lên git.** `JWT_SECRET` lộ = ai cũng giả mạo được token.
- **CORS:** nếu frontend và backend khác domain, bảo đảm backend cho phép origin của frontend (cấu hình trong backend).
- **OTP đăng nhập:** backend đã có cơ chế tạo + lưu mã OTP, nhưng **chưa nối nhà cung cấp SMS thật**. Trước khi mở cho khách thật cần tích hợp một dịch vụ SMS (ví dụ eSMS, Twilio); trong lúc test có thể đọc mã trực tiếp trong collection `otps` của MongoDB.

---

## 9. Checklist go-live

- [ ] MongoDB sẵn sàng (Atlas hoặc server riêng) + đã đặt `MONGODB_URI`
- [ ] Đã đổi `JWT_SECRET` (≥ 32 ký tự ngẫu nhiên)
- [ ] Đã đặt `ADMIN_EMAIL` / `ADMIN_PHONE` / `ADMIN_PASSWORD` và đăng nhập admin được
- [ ] Backend chạy lần đầu: log CatalogSeeder báo đã nạp đủ dữ liệu mẫu
- [ ] **Ảnh shop:** đã tạo bucket trên nhà cung cấp S3-compatible (AWS S3 / Cloudflare R2 / MinIO), đặt `STORAGE_TYPE=s3` + đủ bộ `S3_*` trong `.env`, upload thử 1 ảnh sản phẩm và mở được URL trả về
- [ ] **Ảnh review (khi dùng AWS S3):** đã deploy Lambda nén ảnh theo `infra/lambda-image-compressor/README.md`, upload thử 1 ảnh đánh giá và thấy bản tối ưu xuất hiện ở `reviews/optimized/`
- [ ] Frontend build với `VITE_USE_MOCK=false` (+ `VITE_API_BASE_URL` nếu khác domain)
- [ ] MoMo: bộ khóa production + `MOMO_IPN_URL` là URL public gọi được từ internet
- [ ] SMS OTP: đã nối nhà cung cấp SMS thật (mục 8)
- [ ] Backup: lịch mongodump định kỳ + bật versioning trên bucket ảnh
- [ ] Domain / HTTPS / CORS đã cấu hình đúng phía hosting