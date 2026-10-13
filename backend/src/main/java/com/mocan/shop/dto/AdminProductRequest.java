package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Body POST /admin/products và PUT /admin/products/{id} — admin-san-pham.md §6.
 * Validate nghiệp vụ F-014 nằm ở AdminProductService (422 vi phạm rule,
 * 409 khi trùng slug/SKU hoặc xóa màu đã có trong đơn).
 */
@Data
public class AdminProductRequest {
  private String name;
  private String slug;
  private String categoryId;
  private String description;
  private Map<String, String> specs;
  private BigDecimal basePrice;
  private BadgeRequest badge;
  private List<ImageRequest> images;
  private boolean featured;
  private boolean active;
  private List<VariantRequest> variants;

  @Data
  public static class BadgeRequest {
    private String type; // new | bestseller | sale
    private String label;
  }

  @Data
  public static class ImageRequest {
    private String url;
    private int sortOrder;
  }

  @Data
  public static class VariantRequest {
    private String id; // null = màu mới; có id = cập nhật màu hiện hữu
    private String sku;
    private String color;
    private String colorHex;
    private BigDecimal price;
    private Integer stock;
    private Integer lowStockThreshold;
    private BigDecimal lengthM;
    private BigDecimal widthM;
    private String sizeLabel;
    private String materialNote;
  }
}
