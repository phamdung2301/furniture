package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

/** Danh mục — 02-ERD.md. Cây 2 cấp qua parentId. */
@Data
@Document("categories")
public class Category {
  @Id private String id;
  private String name;
  @Indexed(unique = true) private String slug;
  private String parentId; // null = danh mục gốc
  private String imageUrl;
  private int sortOrder;
  private boolean active;
  // Bổ sung khi implement màn 16: contract GET /admin/categories (admin-danh-muc.md §7)
  // có createdAt; document cũ chưa có trường này → null khi đọc ra.
  private Instant createdAt;
}
