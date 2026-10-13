package com.mocan.shop.service.storage;

import com.mocan.shop.exception.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Chế độ s3 (STORAGE_TYPE=s3): đẩy ảnh lên cloud object storage tương thích S3
 * bằng AWS SDK for Java v2 — chạy với AWS S3, Cloudflare R2, MinIO và mọi
 * endpoint S3-compatible khác nhờ cấu hình endpoint + path-style.
 *
 * URL trả về: ưu tiên S3_PUBLIC_BASE_URL (CDN / custom domain); không có thì
 * tự dựng: có endpoint → endpoint/bucket/key; AWS xịn → virtual-hosted URL.
 *
 * Thiếu cấu hình bắt buộc (bucket/region/access-key/secret-key) → ném
 * IllegalStateException ngay lúc khởi tạo bean: app KHÔNG khởi động và log
 * ghi rõ thiếu biến nào, tuyệt đối không fail im lặng rồi lỗi lúc upload.
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class S3StorageService implements StorageService {

  private final S3Client s3Client;
  private final String bucket;
  private final String region;
  private final String endpoint;      // "" = AWS S3 xịn
  private final String publicBaseUrl; // "" = tự dựng URL theo endpoint/bucket/region

  public S3StorageService(
      @Value("${app.storage.s3.endpoint:}") String endpoint,
      @Value("${app.storage.s3.region:}") String region,
      @Value("${app.storage.s3.bucket:}") String bucket,
      @Value("${app.storage.s3.access-key:}") String accessKey,
      @Value("${app.storage.s3.secret-key:}") String secretKey,
      @Value("${app.storage.s3.public-base-url:}") String publicBaseUrl,
      @Value("${app.storage.s3.path-style:false}") boolean pathStyle) {
    List<String> missing = new ArrayList<>();
    if (isBlank(bucket)) missing.add("S3_BUCKET");
    if (isBlank(region)) missing.add("S3_REGION");
    if (isBlank(accessKey)) missing.add("S3_ACCESS_KEY");
    if (isBlank(secretKey)) missing.add("S3_SECRET_KEY");
    if (!missing.isEmpty()) {
      String message = "STORAGE_TYPE=s3 nhưng thiếu cấu hình bắt buộc: "
          + String.join(", ", missing)
          + ". Điền các biến này vào .env / biến môi trường (xem backend/.env.example)"
          + " hoặc đổi STORAGE_TYPE=local.";
      log.error("S3StorageService: {}", message);
      throw new IllegalStateException(message);
    }

    this.bucket = bucket.trim();
    this.region = region.trim();
    this.endpoint = trimToEmpty(endpoint);
    this.publicBaseUrl = stripTrailingSlash(trimToEmpty(publicBaseUrl));

    var builder = S3Client.builder()
        .region(Region.of(this.region))
        .credentialsProvider(StaticCredentialsProvider.create(
            AwsBasicCredentials.create(accessKey.trim(), secretKey.trim())))
        .serviceConfiguration(
            S3Configuration.builder().pathStyleAccessEnabled(pathStyle).build());
    if (!this.endpoint.isEmpty()) {
      builder.endpointOverride(URI.create(this.endpoint));
    }
    this.s3Client = builder.build();
    log.info("S3StorageService: bucket={}, region={}, endpoint={}, pathStyle={}, publicBaseUrl={}",
        this.bucket, this.region,
        this.endpoint.isEmpty() ? "(AWS)" : this.endpoint,
        pathStyle,
        this.publicBaseUrl.isEmpty() ? "(tự dựng)" : this.publicBaseUrl);
  }

  @Override
  public String store(MultipartFile file, String subdir) {
    String key = subdir + "/" + UUID.randomUUID()
        + StorageService.extensionFor(file.getContentType());
    return storeAt(file, key);
  }

  @Override
  public String storeAt(MultipartFile file, String key) {
    try {
      putBytes(key, file.getBytes(), file.getContentType());
    } catch (IOException e) {
      log.error("S3StorageService: không đọc được file upload (key={}): {}", key, e.getMessage());
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Không lưu được ảnh.");
    }
    return urlFor(key);
  }

  @Override
  public String storeBytes(byte[] data, String contentType, String subdir) {
    String key = subdir + "/" + UUID.randomUUID() + StorageService.extensionFor(contentType);
    putBytes(key, data, contentType);
    return urlFor(key);
  }

  private void putBytes(String key, byte[] data, String contentType) {
    try {
      s3Client.putObject(
          PutObjectRequest.builder()
              .bucket(bucket)
              .key(key)
              .contentType(contentType)
              .build(),
          RequestBody.fromBytes(data));
    } catch (RuntimeException e) {
      log.error("S3StorageService: putObject thất bại (key={}): {}", key, e.getMessage());
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Không lưu được ảnh.");
    }
  }

  @Override
  public String urlFor(String key) {
    if (!publicBaseUrl.isEmpty()) {
      return publicBaseUrl + "/" + key;
    }
    if (!endpoint.isEmpty()) {
      return stripTrailingSlash(endpoint) + "/" + bucket + "/" + key;
    }
    return "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
  }

  @Override
  public void delete(String url) {
    // Best-effort: suy key từ URL do chính store() tạo ra; không suy được thì bỏ qua.
    try {
      String key = extractKey(url);
      if (key == null || key.isBlank()) {
        return;
      }
      s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    } catch (Exception e) {
      log.warn("S3StorageService: không xóa được object từ URL {} ({})", url, e.getMessage());
    }
  }

  private String extractKey(String url) {
    if (url == null) {
      return null;
    }
    if (!publicBaseUrl.isEmpty() && url.startsWith(publicBaseUrl + "/")) {
      return url.substring(publicBaseUrl.length() + 1);
    }
    if (!endpoint.isEmpty()) {
      String prefix = stripTrailingSlash(endpoint) + "/" + bucket + "/";
      if (url.startsWith(prefix)) {
        return url.substring(prefix.length());
      }
    }
    String awsMarker = ".amazonaws.com/";
    int idx = url.indexOf(awsMarker);
    if (idx >= 0) {
      return url.substring(idx + awsMarker.length());
    }
    return null;
  }

  private static boolean isBlank(String s) {
    return s == null || s.isBlank();
  }

  private static String trimToEmpty(String s) {
    return s == null ? "" : s.trim();
  }

  private static String stripTrailingSlash(String s) {
    return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
  }
}
