package com.mocan.shop.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 1 phần tử của response PATCH /admin/categories/{id}/move:
 * toàn bộ nhóm anh em sau khi chuẩn hoá sortOrder thành dãy 1..n (§4).
 */
@Data
@AllArgsConstructor
public class AdminCategoryMoveItemDto {
  private String id;
  private int sortOrder;
}
