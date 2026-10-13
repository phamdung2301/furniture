package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/** 1 điểm của chuỗi doanh thu — GET /admin/stats/revenue (admin-dashboard.md §3). */
@Data
public class RevenuePointDto {
  private String label; // dd/MM (ngày) · "Tuần 41" (tuần) · "Tháng 10" (tháng)
  private BigDecimal revenue;
  private long completedOrders; // số đơn HOÀN THÀNH trong kỳ (tooltip biểu đồ)
}
