package com.mocan.shop.dto;

import lombok.Data;

/**
 * Số đếm cho thẻ tổng quan + chips trạng thái (admin-ton-kho.md §2.2/§3.1).
 * Tính theo các bộ lọc còn lại (tìm kiếm + danh mục), BỎ QUA chính `status`.
 * `low` = stock <= lowStockThreshold (gồm cả hết hàng — khớp KPI Dashboard);
 * `out` = stock = 0.
 */
@Data
public class AdminInventoryCountsDto {
  private long all;
  private long low;
  private long out;
}
