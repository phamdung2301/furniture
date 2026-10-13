"""Lambda nén ảnh review cho noi-that-shop.

Pipeline: backend upload ảnh GỐC lên S3 tại key reviews/original/<uuid>.<ext>
-> sự kiện S3 ObjectCreated (prefix reviews/original/) kích hoạt Lambda này
-> nén/resize bằng Pillow -> ghi bản tối ưu tại reviews/optimized/<uuid>.jpg
(CÙNG bucket) -> xóa ảnh gốc nếu biến môi trường DELETE_ORIGINAL=true.

Backend đã lưu sẵn URL bản tối ưu (đoán trước theo uuid) vào review.images,
nên Lambda PHẢI giữ đúng quy ước key này. Lỗi xử lý KHÔNG được nuốt: cứ để
exception nổi lên Lambda runtime (CloudWatch thấy được + S3 async invoke
tự retry) thay vì báo thành công giả.
"""

import io
import os
import urllib.parse

import boto3
from PIL import Image, ImageOps

s3 = boto3.client("s3")

MAX_EDGE = 1600          # cạnh dài nhất tối đa — khớp ImageCompressor phía backend (đường local dev)
JPEG_QUALITY = 82        # ~0.82
ORIGINAL_PREFIX = "reviews/original/"
OPTIMIZED_PREFIX = "reviews/optimized/"
DELETE_ORIGINAL = os.environ.get("DELETE_ORIGINAL", "true").strip().lower() == "true"
CACHE_CONTROL = "public, max-age=31536000, immutable"


def handler(event, context):
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        # Key trong sự kiện S3 bị URL-encode (dấu cách -> '+', ký tự đặc biệt -> %XX).
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])
        if not key.startswith(ORIGINAL_PREFIX):
            print(f"Bo qua key ngoai prefix {ORIGINAL_PREFIX}: {key}")
            continue
        compress(bucket, key)
    return {"statusCode": 200, "body": "ok"}


def compress(bucket, key):
    print(f"Nen anh: s3://{bucket}/{key}")
    obj = s3.get_object(Bucket=bucket, Key=key)
    raw = obj["Body"].read()

    image = Image.open(io.BytesIO(raw))
    image = ImageOps.exif_transpose(image)  # xoay đúng chiều theo EXIF của ảnh chụp điện thoại
    image = to_rgb_on_white(image)
    # thumbnail() chỉ thu nhỏ (không phóng to), giữ tỉ lệ — cạnh dài nhất <= MAX_EDGE.
    image.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)

    out = io.BytesIO()
    image.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    body = out.getvalue()

    relative = key[len(ORIGINAL_PREFIX):]
    dest_key = OPTIMIZED_PREFIX + relative.rsplit(".", 1)[0] + ".jpg"
    s3.put_object(
        Bucket=bucket,
        Key=dest_key,
        Body=body,
        ContentType="image/jpeg",
        CacheControl=CACHE_CONTROL,
    )
    print(f"Da ghi ban toi uu: s3://{bucket}/{dest_key} ({len(raw)} -> {len(body)} bytes)")

    if DELETE_ORIGINAL:
        s3.delete_object(Bucket=bucket, Key=key)
        print(f"Da xoa anh goc: s3://{bucket}/{key}")


def to_rgb_on_white(image):
    """JPEG không có kênh alpha: ảnh trong suốt (PNG) ghép lên nền trắng."""
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.split()[3])
        return background
    return image.convert("RGB")
