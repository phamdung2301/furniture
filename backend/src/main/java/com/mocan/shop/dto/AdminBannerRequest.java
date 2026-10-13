package com.mocan.shop.dto;

import lombok.Data;

/**
 * Body POST /admin/banners và PUT /admin/banners/{id} — admin-banner.md §8.
 * Validate nghiệp vụ nằm ở AdminBannerService (400 { field, message }):
 * imageUrl/title/linkUrl bắt buộc, tiêu đề ≤80, mô tả phụ ≤120,
 * chữ trên nút ≤20 [Giả định của spec], linkUrl bắt đầu bằng / hoặc http(s).
 */
@Data
public class AdminBannerRequest {
  private String imageUrl;
  private String linkUrl;
  private String title;
  private String subtitle;
  private String ctaText;
  private Integer sortOrder;
  private boolean active;
}
