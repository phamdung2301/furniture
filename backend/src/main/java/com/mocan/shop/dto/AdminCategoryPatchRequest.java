package com.mocan.shop.dto;

import lombok.Data;

/** Body PATCH /admin/categories/{id} — bật/tắt hiển thị nhanh (admin-danh-muc.md §7). */
@Data
public class AdminCategoryPatchRequest {
  private Boolean active;
}
