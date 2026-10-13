package com.mocan.shop.service.storage;

import com.mocan.shop.exception.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

/**
 * Chế độ local (mặc định): ghi file xuống app.upload.dir/<key> và trả URL
 * /uploads/<key> — UploadConfig serve thư mục này ra ngoài.
 * Hành vi store() giữ NGUYÊN như code ghi đĩa cũ trong các admin service.
 * Chỉ phù hợp dev / chạy 1 server; vận hành thật nên chuyển STORAGE_TYPE=s3.
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

  private final String uploadDir;

  public LocalStorageService(@Value("${app.upload.dir:uploads}") String uploadDir) {
    this.uploadDir = uploadDir;
  }

  @Override
  public String store(MultipartFile file, String subdir) {
    String fileName = UUID.randomUUID() + StorageService.extensionFor(file.getContentType());
    Path target = resolve(subdir + "/" + fileName);
    try {
      Files.createDirectories(target.getParent());
      file.transferTo(target.toFile());
    } catch (IOException | IllegalStateException e) {
      throw uploadFailed();
    }
    return urlFor(subdir + "/" + fileName);
  }

  @Override
  public String storeAt(MultipartFile file, String key) {
    Path target = resolve(key);
    try {
      Files.createDirectories(target.getParent());
      file.transferTo(target.toFile());
    } catch (IOException | IllegalStateException e) {
      throw uploadFailed();
    }
    return urlFor(key);
  }

  @Override
  public String storeBytes(byte[] data, String contentType, String subdir) {
    String fileName = UUID.randomUUID() + StorageService.extensionFor(contentType);
    Path target = resolve(subdir + "/" + fileName);
    try {
      Files.createDirectories(target.getParent());
      Files.write(target, data);
    } catch (IOException e) {
      throw uploadFailed();
    }
    return urlFor(subdir + "/" + fileName);
  }

  @Override
  public String urlFor(String key) {
    return "/uploads/" + key;
  }

  @Override
  public void delete(String url) {
    // Best-effort: chỉ xử lý URL local dạng /uploads/<key>.
    try {
      if (url == null || !url.startsWith("/uploads/")) {
        return;
      }
      Path base = Paths.get(uploadDir).toAbsolutePath().normalize();
      Path target = base.resolve(url.substring("/uploads/".length())).normalize();
      if (target.startsWith(base)) {
        Files.deleteIfExists(target);
      }
    } catch (Exception e) {
      log.warn("LocalStorageService: không xóa được file từ URL {} ({})", url, e.getMessage());
    }
  }

  /** Đường dẫn tuyệt đối an toàn trong uploadDir (chặn key chứa ".."). */
  private Path resolve(String key) {
    Path base = Paths.get(uploadDir).toAbsolutePath().normalize();
    Path target = base.resolve(key).normalize();
    if (!target.startsWith(base)) {
      throw uploadFailed();
    }
    return target;
  }

  private ApiException uploadFailed() {
    return new ApiException(
        HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Không lưu được ảnh.");
  }
}
