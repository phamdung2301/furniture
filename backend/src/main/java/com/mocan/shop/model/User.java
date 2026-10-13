package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

/** Người dùng — 02-ERD.md. SĐT bắt buộc + xác thực OTP trước khi đặt hàng (FR-030). */
@Data
@Document("users")
public class User {
  @Id private String id;
  @Indexed(unique = true) private String email;
  private String passwordHash; // null nếu login Google
  private String fullName;
  private String avatarUrl; // ảnh đại diện (màn Hồ sơ) — [Giả định] bổ sung ERD sau
  @Indexed(unique = true) private String phone;
  private boolean phoneVerified;
  private List<String> roles; // ROLE_CUSTOMER | ROLE_ADMIN
  private String status; // ACTIVE | LOCKED
  private int failedLoginAttempts; // F-010: sai 5 lần → khóa 15 phút
  private Instant lockedUntil; // hạn tự mở của khóa TỰ ĐỘNG; khóa do admin thì null (không tự mở)
  // Khóa do quản trị viên (FR-025, màn 20 — admin-khach-hang.md §4.2/§4.3,
  // đã ghi vào 02-ERD.md): lý do (không bắt buộc) + ai khóa + khi nào.
  // Mở khóa (PATCH /admin/customers/{id}/unlock) thì xóa cả 3 field.
  private String lockReason;
  private String lockedBy;
  private Instant lockedAt;
  private String passwordResetToken; // token đặt lại mật khẩu (hash lưu plain là đủ cho mock)
  private Instant passwordResetTokenExpiry;
  private Instant createdAt;
  private List<Address> addresses; // embedded

  @Data
  public static class Address {
    private String label;
    private String receiverName;
    private String phone;
    private String province;
    private String district;
    private String ward;
    private String detail;
    private boolean isDefault;
  }
}
