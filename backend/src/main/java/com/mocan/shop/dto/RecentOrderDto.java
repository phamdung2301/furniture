package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Dòng đơn mới nhất trên Dashboard — GET /admin/stats/recent-orders (§7).
 * Tên/SĐT khách lấy từ snapshot người nhận của đơn.
 */
@Data
public class RecentOrderDto {
  private String orderNumber;
  private String customerName;
  private String customerPhone;
  private BigDecimal total;
  private String status;
  private Instant createdAt;
}
