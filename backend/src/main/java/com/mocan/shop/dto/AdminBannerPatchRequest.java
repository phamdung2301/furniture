package com.mocan.shop.dto;

import lombok.Data;

/** Body PATCH /admin/banners/{id} — bật/tắt nhanh trên thẻ (admin-banner.md §6.1). */
@Data
public class AdminBannerPatchRequest {
  private Boolean active;
}
