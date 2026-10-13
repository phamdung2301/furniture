package com.mocan.shop.dto;

import com.mocan.shop.model.Product;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Chi tiết sản phẩm nạp vào form thêm/sửa — admin-san-pham.md §6.
 * Shape khớp AdminProductRequest (PUT gửi lại cùng cấu trúc này, trừ id SP).
 */
@Data
public class AdminProductDetailDto {
  private String id;
  private String name;
  private String slug;
  private String categoryId;
  private String description;
  private Map<String, String> specs;
  private BigDecimal basePrice;
  private BadgeDto badge;
  private List<Product.ProductImage> images;
  private boolean featured;
  private boolean active;
  private List<VariantDto> variants;

  @Data
  public static class BadgeDto {
    private String type; // new | bestseller | sale
    private String label; // MỚI | BÁN CHẠY | -15%
  }

  /** Biến thể theo MÀU — F-014: sku/price/stock/lengthM/widthM từng màu. */
  @Data
  public static class VariantDto {
    private String id;
    private String sku;
    private String color;
    private String colorHex;
    private BigDecimal price;
    private int stock;
    private int lowStockThreshold;
    private BigDecimal lengthM;
    private BigDecimal widthM;
    private String sizeLabel;
    private String materialNote;
  }
}
