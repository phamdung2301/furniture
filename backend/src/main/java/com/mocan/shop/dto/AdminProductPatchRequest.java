package com.mocan.shop.dto;

import lombok.Data;

/**
 * Body PATCH /admin/products/{id} — admin-san-pham.md §6:
 * { active } (ngừng bán / bán lại) hoặc { featured } (toggle ★ ở bảng).
 * Trường null = không thay đổi.
 */
@Data
public class AdminProductPatchRequest {
  private Boolean active;
  private Boolean featured;
}
