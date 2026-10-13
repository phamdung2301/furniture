package com.mocan.shop.service.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * Lưu trữ file upload. Chọn implementation bằng ENV STORAGE_TYPE (app.storage.type):
 *   local → LocalStorageService (ghi đĩa, mặc định)
 *   s3    → S3StorageService (cloud object storage tương thích S3)
 *
 * Hai nhóm nhu cầu:
 *  - Ảnh của SHOP (sản phẩm / danh mục / banner): store(file, subdir) là đủ.
 *  - Ảnh của USER (review): production đi pipeline S3 + Lambda nén (xem
 *    ReviewService + infra/lambda-image-compressor/): upload bản gốc bằng
 *    storeAt(file, "reviews/original/<uuid>.<ext>") rồi giữ URL bản tối ưu
 *    đoán trước bằng urlFor("reviews/optimized/<uuid>.jpg").
 *    Dev local mô phỏng pipeline bằng storeBytes() sau khi nén tại backend.
 */
public interface StorageService {

  /**
   * Lưu 1 file vào thư mục con với tên uuid (vd "products", "categories", "banners").
   * @return URL công khai của ảnh (local: /uploads/<subdir>/<uuid>.<ext>;
   *         s3: URL public/CDN của object tại key <subdir>/<uuid>.<ext>).
   */
  String store(MultipartFile file, String subdir);

  /**
   * Lưu 1 file tại ĐÚNG key chỉ định (vd "reviews/original/<uuid>.jpg").
   * @return URL công khai của object tại key đó.
   */
  String storeAt(MultipartFile file, String key);

  /**
   * Lưu bytes sẵn có (vd ảnh đã nén tại backend) vào thư mục con với tên uuid;
   * đuôi file suy từ contentType.
   * @return URL công khai của ảnh.
   */
  String storeBytes(byte[] data, String contentType, String subdir);

  /**
   * Dựng URL công khai cho 1 key BẤT KỲ mà không cần object đã tồn tại —
   * dùng để đoán trước URL bản tối ưu khi Lambda nén chưa chạy xong.
   */
  String urlFor(String key);

  /** Xóa file theo URL đã trả từ store()/storeAt()/storeBytes() — best-effort, không ném lỗi. */
  void delete(String url);

  /** Đuôi file suy từ content-type đã validate (JPG/PNG/WebP) — dùng chung các implementation. */
  static String extensionFor(String contentType) {
    if (contentType == null) {
      return ".jpg";
    }
    return switch (contentType.toLowerCase()) {
      case "image/png" -> ".png";
      case "image/webp" -> ".webp";
      default -> ".jpg";
    };
  }
}
