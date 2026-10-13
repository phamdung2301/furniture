package com.mocan.shop.dto;

import lombok.Data;
import java.time.Instant;

/**
 * 1 dòng danh mục ở GET /admin/categories — admin-danh-muc.md §7.
 * Trả toàn bộ phẳng (FE dựng cây); productCount đếm TRỰC THUỘC theo
 * Product.categoryId (không gộp của danh mục con); hasChildren phục vụ
 * chặn xóa §5 + khóa trường cha trong form §3.
 * Giữ shape tương thích dropdown màn 15 (id, name, parentId).
 */
@Data
public class AdminCategoryDto {
  private String id;
  private String name;
  private String slug;
  private String parentId; // null = danh mục gốc
  private String imageUrl;
  private int sortOrder;
  private boolean active;
  private long productCount;
  private boolean hasChildren;
  private Instant createdAt;
}
