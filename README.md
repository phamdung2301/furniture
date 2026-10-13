# Web bán nội thất — Mộc An (tên thương hiệu tạm, chờ chốt)

Dự án: Spring Boot 4.1.1 + MongoDB (backend) · React 19 + Vite (frontend).
Trạng thái: **hoàn thành 22/22 màn hình** (khách hàng + admin), bàn giao 2026-10-12.
Tài liệu thiết kế: `docs/` (SRE, ERD, functions, user stories) · Spec giao diện: `ui-specs/`.

## Yêu cầu môi trường

- Node.js 20+ (frontend)
- JDK 17+ và Maven 3.9+ (backend)
- MongoDB đang chạy ở `localhost:27017` (local hoặc Atlas qua `MONGODB_URI`)

## Chạy frontend

```bash
cd frontend
cp .env.example .env   # sửa VITE_API_BASE_URL nếu backend không ở localhost:8080
npm install
npm run dev            # http://localhost:5173
```

Mặc định frontend dùng **mock data** (`VITE_USE_MOCK=true`) nên chạy được ngay
khi chưa có backend — đây là cách xem demo nhanh nhất. Khi backend sẵn sàng:
set `VITE_USE_MOCK=false` trong `.env` để gọi API thật — không cần sửa component.

Tài khoản demo ở chế độ mock: `admin@mocan.vn` / `admin123` (chỉ là mock ở
frontend, KHÔNG phải tài khoản backend thật — xem mục AdminBootstrap bên dưới).

> Lưu ý (bài học xương máu): thêm endpoint backend mới thì thêm entry proxy
> tương ứng trong `frontend/vite.config.js`, rồi verify nó đã nằm trong file.
> Bản bàn giao này đã audit: mọi path API frontend đang gọi đều có proxy entry.

Build production:

```bash
cd frontend
npm run build   # ra thư mục dist/
```

## Chạy backend

```bash
cd backend
# MongoDB local mặc định: mongodb://localhost:27017/mocan_shop
# Đổi qua biến môi trường khi cần:
#   MONGODB_URI, JWT_SECRET
mvn spring-boot:run    # http://localhost:8080
```

Chạy test:

```bash
cd backend
mvn test
```

> **Việc kiểm chứng còn lại phía người chạy:** frontend đã build pass trên máy
> build, nhưng backend **chưa từng được compile trên máy build (không có JDK)**.
> Lần chạy đầu tiên hãy chạy `mvn test` (hoặc tối thiểu `mvn compile`) để verify.

### Ba lưu ý khi chạy backend thật

1. **Chưa có dữ liệu mẫu (seed) cho sản phẩm/danh mục.** Backend khởi động với
   database rỗng — catalog thật sẽ trống cho tới khi tạo dữ liệu qua các màn
   admin (QL Sản phẩm / QL Danh mục). Muốn xem giao diện đầy đủ ngay: dùng
   frontend ở chế độ mock.
2. **Tài khoản ADMIN thật tạo qua biến môi trường (AdminBootstrap):** set
   `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD` trước khi khởi động — app tự
   tạo user `ROLE_ADMIN` ở lần chạy đầu. Thiếu biến thì app vẫn chạy, chỉ log
   WARN và bỏ qua. Xem `backend/src/main/resources/application.yml`.
3. **OTP hiện là mock SMS:** chưa tích hợp nhà cung cấp SMS thật. Ở local, mã
   OTP chỉ được ghi ở log mức DEBUG của `OtpService` (không log ở mức info vì
   lý do bảo mật). Bật thanh toán MoMo thật và SMS thật khi go-live: điền bộ
   khóa MoMo vào biến môi trường theo `backend/.env.example`
   (`MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_IPN_URL`,
   `MOMO_REDIRECT_URL`) — secret chỉ qua ENV, không hardcode.

## Cấu trúc

```
noi-that-shop/
├── docs/            # Tài liệu thiết kế (source of truth)
├── ui-specs/        # Spec giao diện từng màn
├── frontend/
│   ├── src/
│   │   ├── api/         # axiosClient + api modules (homeApi...)
│   │   ├── mocks/       # Mock data shape y hệt API thật
│   │   ├── components/  # Component dùng chung
│   │   ├── pages/       # Các màn hình
│   │   └── utils/
│   └── vite.config.js   # Proxy đầy đủ mọi backend path
└── backend/
    └── src/main/java/com/mocan/shop/
        ├── config/      # Security, CORS, AdminBootstrap
        ├── controller/  # REST endpoints
        ├── service/
        ├── repository/
        ├── model/       # MongoDB documents (khớp 02-ERD.md)
        ├── dto/
        └── security/    # JWT
```

## Màn hình đã xong (22/22)

### Khách hàng (13)

- [x] 1. Trang chủ (`/`)
- [x] 2. Danh mục + lọc (`/danh-muc/:slug`)
- [x] 3. Tìm kiếm (`/tim-kiem`)
- [x] 4. Chi tiết sản phẩm (`/san-pham/:slug`)
- [x] 5. Giỏ hàng (`/gio-hang`)
- [x] 6. Đăng nhập / Đăng ký / OTP (`/dang-nhap`, `/dang-ky`)
- [x] 7. Đặt hàng — checkout 4 bước (`/dat-hang`)
- [x] 8. Thanh toán MoMo (`/thanh-toan`)
- [x] 9. Viết / sửa đánh giá (modal trên trang chi tiết sản phẩm)
- [x] 10. Wishlist (`/yeu-thich`)
- [x] 11. Theo dõi đơn (`/don-hang`, `/don-hang/:orderNumber`)
- [x] 12. Hồ sơ (`/tai-khoan`)
- [x] 13. Flash sale (`/flash-sale`)

### Admin (9) — dưới `/admin`

- [x] 14. Dashboard
- [x] 15. QL Sản phẩm (`san-pham`)
- [x] 16. QL Danh mục (`danh-muc`)
- [x] 17. QL Đơn hàng (`don-hang`)
- [x] 18. QL Tồn kho (`ton-kho`)
- [x] 19. QL Voucher (`voucher`)
- [x] 20. QL Khách hàng (`khach-hang`)
- [x] 21. QL Banner (`banner`)
- [x] 22. Flash sale & phí ship (`khuyen-mai`)

## Quyết định còn mở (không chặn chạy thử)

1. **Tên thương hiệu** — "Mộc An" vẫn là tên tạm (đã lan vào package
   `com.mocan.shop`, README, mock data). Có tên thật sẽ thay toàn bộ một lượt.
2. **Nội dung chuyển khoản** — hiện dùng dạng `NT202610110001`.
3. **Go-live** — khóa MoMo thật + nhà cung cấp SMS thật, khai qua ENV như trên.
