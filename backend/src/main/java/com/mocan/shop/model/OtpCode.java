package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

/**
 * Mã OTP xác thực SĐT — F-024 / FR-030.
 * Lưu vào collection `otps`: mã được HASH (bcrypt), KHÔNG lưu plain;
 * TTL tự xóa khi hết hiệu lực 5 phút (expireAfter = "0" trên expiresAt);
 * 1 phone = 1 bản ghi (unique) = 1 tài khoản đã xác thực.
 */
@Data
@Document("otps")
public class OtpCode {
  @Id private String id;
  @Indexed(unique = true) private String phone; // đã chuẩn hóa dạng 0xxxxxxxxx
  private String codeHash; // hash bcrypt của mã 6 số — không bao giờ log plain
  private String purpose; // register | login
  private int failedAttempts;
  private Instant lastSentAt; // chống spam gửi lại (< 60s)
  @Indexed(expireAfter = "0") private Instant expiresAt; // TTL: Mongo tự xóa
  private Instant createdAt;
}
