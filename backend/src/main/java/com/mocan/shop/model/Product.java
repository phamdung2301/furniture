package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Sản phẩm — 02-ERD.md. Ảnh embedded; biến thể (theo màu) ở collection riêng. */
@Data
@Document("products")
public class Product {
  @Id private String id;
  private String name;
  @Indexed(unique = true) private String slug;
  private String categoryId;
  private String description;
  private Map<String, String> specs;
  private BigDecimal basePrice;
  private Badge badge; // nhãn marketing hiển thị (02-ERD bổ sung 2026-10-12)
  private List<ProductImage> images;
  private BigDecimal ratingAvg;
  private int ratingCount;
  private int soldCount;
  private boolean featured;
  private boolean active;
  private Instant createdAt;

  @Data
  public static class ProductImage {
    private String url;
    private int sortOrder;
  }

  /** Nhãn marketing trên card khách hàng: type new|bestseller|sale + label hiển thị. */
  @Data
  public static class Badge {
    private String type;
    private String label;
  }
}
