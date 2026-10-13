package com.mocan.shop.dto;

import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import lombok.Data;
import java.util.List;

/**
 * Product kèm variants — response cho các endpoint trang chủ.
 * Shape khớp mock data FE (src/mocks/homeMock.js).
 */
@Data
public class ProductWithVariantsDto {
  private String id;
  private String name;
  private String slug;
  private String categoryId;
  private String description;
  private java.util.Map<String, String> specs;
  private java.math.BigDecimal basePrice;
  private List<Product.ProductImage> images;
  private java.math.BigDecimal ratingAvg;
  private int ratingCount;
  private int soldCount;
  private boolean featured;
  private boolean active;
  private java.time.Instant createdAt;
  private List<ProductVariant> variants;
  private BadgeDto badge; // badge marketing: MỚI / BÁN CHẠY (null = không badge)

  @Data
  public static class BadgeDto {
    private String type; // new | bestseller | sale
    private String label; // MỚI | BÁN CHẠY | -15%
  }

  public static ProductWithVariantsDto of(Product p, List<ProductVariant> variants) {
    ProductWithVariantsDto dto = new ProductWithVariantsDto();
    dto.setId(p.getId());
    dto.setName(p.getName());
    dto.setSlug(p.getSlug());
    dto.setCategoryId(p.getCategoryId());
    dto.setDescription(p.getDescription());
    dto.setSpecs(p.getSpecs());
    dto.setBasePrice(p.getBasePrice());
    dto.setImages(p.getImages());
    dto.setRatingAvg(p.getRatingAvg());
    dto.setRatingCount(p.getRatingCount());
    dto.setSoldCount(p.getSoldCount());
    dto.setFeatured(p.isFeatured());
    dto.setActive(p.isActive());
    dto.setCreatedAt(p.getCreatedAt());
    dto.setVariants(variants);
    return dto;
  }
}
