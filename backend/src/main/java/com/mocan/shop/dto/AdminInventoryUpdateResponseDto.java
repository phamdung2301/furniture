package com.mocan.shop.dto;

import lombok.Data;

/**
 * Kết quả sau điều chỉnh tồn / sửa ngưỡng — dùng chung cho
 * POST /admin/inventory/{variantId}/adjust và
 * PATCH /admin/inventory/{variantId}/threshold (admin-ton-kho.md §9).
 */
@Data
public class AdminInventoryUpdateResponseDto {
  private String variantId;
  private int stock;
  private int lowStockThreshold;
}
