package com.mocan.shop.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 1 phần tử của response PUT /admin/banners/reorder:
 * toàn bộ danh sách sau khi chuẩn hoá sortOrder thành dãy 1..n (§8).
 */
@Data
@AllArgsConstructor
public class AdminBannerReorderItemDto {
  private String id;
  private int sortOrder;
}
