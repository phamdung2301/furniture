package com.mocan.shop.controller;

import com.mocan.shop.dto.AdminOverviewDto;
import com.mocan.shop.dto.LowStockItemDto;
import com.mocan.shop.dto.OrdersByStatusDto;
import com.mocan.shop.dto.RecentOrderDto;
import com.mocan.shop.dto.RevenueByCategoryDto;
import com.mocan.shop.dto.RevenuePointDto;
import com.mocan.shop.dto.TopProductDto;
import com.mocan.shop.service.AdminStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Thống kê Admin Dashboard — FR-026 · F-020 · F-017 (admin-dashboard.md §10).
 * Toàn bộ /admin/** yêu cầu role ADMIN (SecurityConfig: hasRole("ADMIN");
 * JWT mang authority ROLE_ADMIN). Chưa đăng nhập -> 401, sai role -> 403.
 */
@RestController
@RequiredArgsConstructor
public class AdminStatsController {

  private final AdminStatsService adminStatsService;

  /** KPI tổng quan: doanh thu hôm nay/tháng, đơn mới, đơn chờ, khách mới, sắp hết hàng. */
  @GetMapping("/admin/stats/overview")
  public AdminOverviewDto overview() {
    return adminStatsService.overview();
  }

  /** Chuỗi doanh thu — range: day (30 ngày) | week (12 tuần) | month (12 tháng). */
  @GetMapping("/admin/stats/revenue")
  public List<RevenuePointDto> revenue(
      @RequestParam(defaultValue = "day") String range) {
    return adminStatsService.revenueSeries(range);
  }

  /** Số đơn tháng này theo 6 trạng thái FR-012 (cho donut). */
  @GetMapping("/admin/stats/orders-by-status")
  public List<OrdersByStatusDto> ordersByStatus() {
    return adminStatsService.ordersByStatus();
  }

  /** Doanh thu tháng này theo danh mục, sắp giảm dần. */
  @GetMapping("/admin/stats/revenue-by-category")
  public List<RevenueByCategoryDto> revenueByCategory() {
    return adminStatsService.revenueByCategory();
  }

  /** Top sản phẩm bán chạy tháng này theo doanh thu. */
  @GetMapping("/admin/stats/top-products")
  public List<TopProductDto> topProducts(
      @RequestParam(defaultValue = "5") int limit) {
    return adminStatsService.topProducts(limit);
  }

  /** 8 đơn mới nhất (mọi trạng thái). */
  @GetMapping("/admin/stats/recent-orders")
  public List<RecentOrderDto> recentOrders() {
    return adminStatsService.recentOrders();
  }

  /** Variant sắp hết hàng (stock <= ngưỡng), tồn tăng dần. */
  @GetMapping("/admin/inventory/low-stock")
  public List<LowStockItemDto> lowStock(
      @RequestParam(defaultValue = "5") int limit) {
    return adminStatsService.lowStock(limit);
  }
}
