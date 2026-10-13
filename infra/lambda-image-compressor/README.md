# Lambda nén ảnh review — noi-that-shop

## Pipeline này làm gì

```
Khách đăng ảnh đánh giá
  → backend upload ảnh GỐC lên S3:            reviews/original/<uuid>.<ext>
  → S3 ObjectCreated kích hoạt Lambda này:    nén/resize bằng Pillow
  → bản tối ưu nằm tại:                        reviews/optimized/<uuid>.jpg
  → backend đã lưu sẵn URL bản tối ưu vào review.images ngay từ lúc upload
    (key đích cố định theo uuid nên đoán trước được — Lambda chạy async ~1 giây)
```

Ảnh gốc bị xóa sau khi nén xong (mặc định) — bucket chỉ giữ bản tối ưu nhẹ.
Thông số nén: cạnh dài nhất ≤ 1600px, JPEG quality 82, ảnh trong suốt ghép nền trắng,
header `Cache-Control: public, max-age=31536000, immutable` — khớp với đường dev local
(backend tự nén bằng Thumbnailator khi `STORAGE_TYPE=local`, xem ReviewService).

Chỉ cần làm các bước dưới đây **một lần** khi đưa lên production với `STORAGE_TYPE=s3`.

---

## Bước 1 — Chuẩn bị bucket

Dùng **chính bucket** đã khai trong `S3_BUCKET` của backend (xem `backend/.env.example`).

- Quyền đọc công khai: khách phải mở được URL bản tối ưu. Cách gọn nhất là đặt một
  **CDN / custom domain** trước bucket (CloudFront nếu dùng AWS S3; custom domain nếu dùng
  Cloudflare R2) rồi điền domain đó vào `S3_PUBLIC_BASE_URL`. Nếu không dùng CDN, cần bucket
  policy cho phép `s3:GetObject` công khai **chỉ** trên prefix `reviews/optimized/*`
  (và các prefix ảnh shop `products/*`, `categories/*`, `banners/*` nếu muốn public trực tiếp).
- Prefix `reviews/original/*` **không** cần public — chỉ backend (upload) và Lambda (đọc/xóa) chạm vào.

## Bước 2 — Tạo Lambda function

- AWS Console → Lambda → Create function: tên gợi ý `mocan-image-compressor`,
  Runtime **Python 3.12**, Architecture **x86_64** (layer Pillow ở bước 3 phổ biến cho x86_64;
  nếu chọn arm64 phải lấy layer đúng kiến trúc).
- Upload / dán nội dung file `handler.py` trong thư mục này vào function,
  Handler giữ nguyên `lambda_function.lambda_handler` nếu bạn đặt tên file là
  `lambda_function.py`, hoặc sửa Handler thành `handler.handler` nếu giữ tên `handler.py`.
- Configuration → General: **Timeout 30 giây**, **Memory 512 MB** (ảnh 5MB giải mã + resize
  bằng Pillow ăn RAM hơn mức mặc định 128MB).

## Bước 3 — Gắn Pillow bằng Lambda Layer

Pillow không có sẵn trong runtime Python của Lambda. Hai cách:

- **Dùng layer có sẵn của Klayers (nhanh nhất):** vào https://github.com/keithrozario/Klayers
  tra ARN layer `Klayers-p312-Pillow` cho **đúng region** bạn deploy, rồi Lambda →
  Layers → Add a layer → Specify an ARN. Lưu ý: layer Klayers là của bên thứ ba công khai —
  chỉ dùng ARN lấy từ repo chính thức của họ, và cân nhắc tự đóng gói khi chạy lâu dài.
- **Tự đóng gói (chủ động nhất):** tạo thư mục `python/` chứa Pillow cài bằng
  `pip install Pillow -t python/`, nén thành zip, upload làm Custom layer của riêng bạn
  (compatible runtime Python 3.12). Cách này không phụ thuộc bên thứ ba.

## Bước 4 — IAM policy tối thiểu cho Lambda

Execution role của Lambda chỉ cần đúng 3 quyền trên đúng bucket (thay `TEN_BUCKET`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::TEN_BUCKET/reviews/original/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::TEN_BUCKET/reviews/optimized/*"
    }
  ]
}
```

(Ghi log CloudWatch dùng policy mặc định `AWSLambdaBasicExecutionRole` đính kèm sẵn.)

## Bước 5 — Biến môi trường của Lambda

| Biến | Giá trị | Ý nghĩa |
|---|---|---|
| `DELETE_ORIGINAL` | `true` | Xóa ảnh gốc sau khi nén xong. Đặt `false` khi debug để đối chiếu 2 bản |

## Bước 6 — Bật S3 trigger

Lambda → Add trigger → chọn **S3** → bucket của bạn → Event type **All object create events**
(`s3:ObjectCreated:*`) → **Prefix: `reviews/original/`** → Add.

⚠️ Trigger phải có prefix — thiếu prefix, bản tối ưu ở `reviews/optimized/` cũng kích hoạt
lại Lambda (handler có chặn prefix nên không lặp vô hạn, nhưng vẫn tốn lần chạy thừa).

## Bước 7 — Kiểm thử

1. Upload thử 1 ảnh qua app thật (đăng đánh giá kèm ảnh), hoặc đẩy tay một ảnh lên:
   `aws s3 cp anh-test.jpg s3://TEN_BUCKET/reviews/original/anh-test.jpg`
2. Chờ ~1 giây, kiểm tra `reviews/optimized/anh-test.jpg` đã xuất hiện trong bucket
   và `reviews/original/anh-test.jpg` đã bị xóa.
3. Mở URL `{S3_PUBLIC_BASE_URL}/reviews/optimized/anh-test.jpg` trên trình duyệt — thấy ảnh
   đã nén (kích thước nhỏ hơn bản gốc, cạnh dài nhất ≤ 1600px) là xong.
4. Nếu không thấy bản tối ưu: xem log ở Lambda → Monitor → CloudWatch logs —
   handler cố ý KHÔNG nuốt exception nên lỗi (thiếu layer Pillow, sai quyền IAM…)
   sẽ hiện rõ trong log kèm lần S3 tự retry.

## Ghi chú vận hành

- **Độ trễ ~1 giây:** URL app lưu là URL đoán trước — ngay sau khi khách đăng bài,
  ảnh có thể chưa tải được trong khoảnh khắc Lambda đang nén. Đây là đánh đổi đã chốt
  của kiến trúc; nếu khó chịu, cho frontend retry khi `<img>` lỗi tải lần đầu.
- **Không dùng AWS?** Pipeline này là mẫu AWS (S3 event → Lambda). Cloudflare R2 không có
  Lambda tương đương sẵn — nếu chốt R2 làm storage chính thì cần thay bước nén bằng
  Cloudflare Workers/Queues hoặc chấp nhận chạy đường nén tại backend như chế độ local.
  MinIO có bucket notification → webhook về backend, cũng là một hướng thay thế.
