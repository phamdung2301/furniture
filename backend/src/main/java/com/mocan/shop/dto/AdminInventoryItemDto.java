package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * 1 dòng bảng Quản lý tồn kho = 1 biến thể màu — GET /admin/inventory
 * (admin-ton-kho.md §9, FR-023 · F-017 · US-015).
 * Phía admin ĐƯỢC thấy SKU; quy tắc giấu SKU chỉ áp cho khách hàng.
 */
@Data
public class AdminInventoryItemDto {
  private String variantId;
  private String productId;
  private String productName;
  private boolean productActive;
  private String categoryId;
  private String categoryName;
  private String image;
  private String color;
  private String colorHex;
  private String sku;
  private BigDecimal price;
  private int stock;
  private int lowStockThreshold;
}
