package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Chi tiết khách hàng cho slide-over admin — admin-khach-hang.md §3/§7.
 * Gồm hồ sơ (chỉ xem) + địa chỉ embedded + tổng quan mua hàng + tối đa 5 đơn
 * gần nhất. `hasPassword` chỉ là cờ suy ra từ passwordHash != null để hiển
 * thị "Cách đăng nhập" (§3.3) — TUYỆT ĐỐI không trả passwordHash /
 * passwordResetToken / OTP ra DTO (NFR-004, §5).
 */
@Data
public class AdminCustomerDetailDto {
  private String id;
  private String fullName;
  private String email;
  private String phone;
  private boolean phoneVerified;
  private String avatarUrl;
  private String status; // ACTIVE | LOCKED (hiệu lực — §4.3)
  private String lockSource; // ADMIN | AUTO | null
  private Instant lockedUntil; // chỉ có khi lockSource = AUTO
  private String lockReason; // lý do admin nhập khi khóa (§4.2), null nếu không có
  private int failedLoginAttempts; // phục vụ hỗ trợ khách bị tạm khóa (§3.3)
  private boolean hasPassword; // false ⇔ tài khoản Google
  private Instant createdAt;
  private List<AddressDto> addresses;
  private Stats stats;
  private List<RecentOrder> recentOrders;

  /** Tổng quan mua hàng — §3.2. totalSpent chỉ tính đơn HOÀN THÀNH. */
  @Data
  public static class Stats {
    private long orderCount; // mọi trạng thái
    private long completedOrderCount; // số đơn HOÀN THÀNH (mẫu số của totalSpent)
    private BigDecimal totalSpent;
    private CountByStatus countByStatus;
    private LastOrder lastOrder; // null khi khách chưa có đơn
  }

  /** Đếm đơn theo nhóm trạng thái — §3.2 (processing gộp MỚI + ĐÃ XÁC NHẬN + ĐANG GIAO). */
  @Data
  public static class CountByStatus {
    private long completed;
    private long processing;
    private long cancelled;
    private long returned;
  }

  @Data
  public static class LastOrder {
    private String orderNumber;
    private Instant createdAt;
    private String status;
    private BigDecimal total;
  }

  /** 1 đơn trong "Lịch sử đơn hàng gần đây" — §3.5 (total = giá trị đơn, mọi trạng thái). */
  @Data
  public static class RecentOrder {
    private String orderNumber;
    private Instant createdAt;
    private int itemCount; // Σ items.qty
    private BigDecimal total;
    private String status;
  }
}
