package com.mocan.shop.dto;

import lombok.Data;

/**
 * Chi tiết danh mục nạp vào form sửa — GET /admin/categories/{id}
 * và response của POST/PUT (admin-danh-muc.md §7).
 */
@Data
public class AdminCategoryDetailDto {
  private String id;
  private String name;
  private String slug;
  private String parentId; // null = danh mục gốc
  private String imageUrl;
  private int sortOrder;
  private boolean active;
}
