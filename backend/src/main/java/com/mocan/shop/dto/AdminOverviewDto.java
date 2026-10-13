package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * KPI tổng quan Dashboard — GET /admin/stats/overview (admin-dashboard.md §2).
 * Doanh thu chỉ tính đơn HOÀN THÀNH (+ COD đã thu) — quy ước F-020.
 * ChangePct: % so với kỳ trước, 1 số thập phân (âm = giảm).
 */
@Data
public class AdminOverviewDto {
  private BigDecimal revenueToday;
  private double revenueTodayChangePct;
  private BigDecimal revenueMonth;
  private double revenueMonthChangePct;
  private long newOrdersToday;
  private double newOrdersChangePct;
  private long pendingOrders; // MỚI + ĐÃ XÁC NHẬN
  private long newCustomersToday;
  private double newCustomersChangePct;
  private long lowStockCount; // variant stock <= ngưỡng (F-017)
}
