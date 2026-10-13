package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/** Banner trang chủ — 02-ERD.md (đã bổ sung title/subtitle/ctaText cho text overlay). */
@Data
@Document("banners")
public class Banner {
  @Id private String id;
  private String imageUrl;
  private String linkUrl;
  private String title;
  private String subtitle;
  private String ctaText;
  private int sortOrder;
  private boolean active;
}
