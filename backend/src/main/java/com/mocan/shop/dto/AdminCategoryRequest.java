package com.mocan.shop.dto;

import lombok.Data;

/**
 * Body POST /admin/categories và PUT /admin/categories/{id} — admin-danh-muc.md §7.
 * Validate nghiệp vụ F-015 nằm ở AdminCategoryService (422 vi phạm cây 2 cấp,
 * 409 { field: "slug" } khi trùng slug).
 */
@Data
public class AdminCategoryRequest {
  private String name;
  private String slug;
  private String parentId; // null = danh mục gốc
  private String imageUrl;
  private Integer sortOrder;
  private boolean active;
}
