package com.mocan.shop.dto;

import lombok.Data;

/** Body PATCH /admin/categories/{id}/move — đổi thứ tự trong cùng nhóm anh em (§4). */
@Data
public class AdminCategoryMoveRequest {
  private String direction; // "up" | "down"
}
