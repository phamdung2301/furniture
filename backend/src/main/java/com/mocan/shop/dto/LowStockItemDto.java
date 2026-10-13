package com.mocan.shop.dto;

import lombok.Data;

/**
 * Variant sắp hết hàng — GET /admin/inventory/low-stock (§8).
 * Phía admin ĐƯỢC thấy SKU (US-015); quy tắc giấu SKU chỉ áp cho khách hàng.
 */
@Data
public class LowStockItemDto {
  private String variantId;
  private String productName;
  private String color;
  private String sku;
  private String image;
  private int stock;
  private int lowStockThreshold;
}
