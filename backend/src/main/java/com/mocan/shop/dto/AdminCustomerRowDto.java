package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * 1 dòng khách hàng trong danh sách admin — admin-khach-hang.md §7.
 * Chỉ user có ROLE_CUSTOMER. `status` là trạng thái HIỆU LỰC do BE suy ra
 * (§4.3): khóa tự động đã qua lockedUntil → status=ACTIVE, lockSource=null.
 * `lockSource`: "ADMIN" (lockedUntil=null, không tự mở) | "AUTO" (tạm khóa
 * 15 phút F-010) | null (đang hoạt động).
 * orderCount = mọi trạng thái; totalSpent = chỉ đơn HOÀN THÀNH (F-019/F-020).
 * DTO cấm chứa passwordHash / passwordResetToken / OTP (NFR-004, §5).
 */
@Data
public class AdminCustomerRowDto {
  private String id;
  private String fullName;
  private String email;
  private String phone;
  private boolean phoneVerified;
  private String avatarUrl;
  private String status; // ACTIVE | LOCKED (hiệu lực)
  private String lockSource; // ADMIN | AUTO | null
  private Instant lockedUntil; // chỉ có khi lockSource = AUTO
  private Instant createdAt;
  private long orderCount;
  private BigDecimal totalSpent;
}
