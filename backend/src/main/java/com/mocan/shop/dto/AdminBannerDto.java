package com.mocan.shop.dto;

import lombok.Data;

/**
 * Banner phía admin — GET /admin/banners (toàn bộ kể cả đã tắt),
 * GET /admin/banners/{id} và response của POST/PUT/PATCH
 * (admin-banner.md §8). Shape khớp model Banner (8 trường) —
 * KHÔNG có startAt/endAt vì ERD/model không có.
 */
@Data
public class AdminBannerDto {
  private String id;
  private String imageUrl;
  private String linkUrl;
  private String title;
  private String subtitle;
  private String ctaText;
  private int sortOrder;
  private boolean active;
}
