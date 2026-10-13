package com.mocan.shop.dto;

import lombok.Data;

/** Body PATCH /admin/inventory/{variantId}/threshold (admin-ton-kho.md §9/§6). */
@Data
public class AdminInventoryThresholdRequest {
  private Integer lowStockThreshold;
}
