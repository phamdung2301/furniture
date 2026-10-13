package com.mocan.shop.dto;

import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import lombok.Data;
import java.util.List;

/**
 * Chi tiết sản phẩm — F-004 / FR-005 / FR-006.
 * Contract khớp frontend/src/api/productApi.getProduct().
 * KHÔNG trả sku ra ngoài? — sku vẫn cần cho admin; FE chi tiết không hiển thị
 * (copy-ux-linter: mã nội bộ không lên UI).
 */
@Data
public class ProductDetailDto {
  private String id;
  private String name;
  private String slug;
  private String categoryId;
  private String categoryName;
  private String categorySlug;
  private String description;
  private java.util.Map<String, String> specs;
  private List<Product.ProductImage> images;
  private java.math.BigDecimal ratingAvg;
  private int ratingCount;
  private int soldCount;
  private boolean featured;
  private boolean active;
  private ProductWithVariantsDto.BadgeDto badge;
  private List<ProductVariant> variants;
  private ReviewSummaryDto reviewSummary;
  private List<ProductWithVariantsDto> related; // cùng danh mục, ≤8
}
