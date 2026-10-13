package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Dòng 1 đơn trong bảng Quản lý đơn hàng — GET /admin/orders
 * (admin-don-hang.md §2.3/§7). Khách hàng lấy từ snapshot `receiver`.
 * itemCount = Σ số lượng (items[].qty); itemKinds = số dòng món phân biệt.
 */
@Data
public class AdminOrderListItemDto {
  private String orderNumber;
  private String customerName;
  private String customerPhone;
  private int itemCount;
  private int itemKinds;
  private BigDecimal total;
  private String paymentMethod; // COD | BANK_TRANSFER | MOMO
  private String paymentStatus; // CHƯA THANH TOÁN | ĐÃ THANH TOÁN | THẤT BẠI | HOÀN TIỀN
  private String status;
  private Instant createdAt;
}
