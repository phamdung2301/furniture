package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Một dòng bảng Quản lý sản phẩm — admin-san-pham.md §6.
 * "Giá từ" = giá biến thể rẻ nhất (US-013); lowStockVariantCount = số màu
 * có stock <= lowStockThreshold của chính màu đó (F-017);
 * hasOrders quyết định nút Xóa hay Ngừng bán (F-014).
 */
@Data
public class AdminProductListItemDto {
  private String id;
  private String name;
  private String slug;
  private String image;
  private String categoryId;
  private String categoryName;
  private int variantCount;
  private List<String> colorHexes;
  private BigDecimal minPrice;
  private int totalStock;
  private int lowStockVariantCount;
  private boolean active;
  private boolean featured;
  private boolean hasOrders;
  private Instant createdAt;
}
