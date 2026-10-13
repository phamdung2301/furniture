package com.mocan.shop.dto;

import lombok.Data;

/** Kết quả gộp wishlist — { merged: N } (N = số item mới thực sự chèn vào server). */
@Data
public class MergeWishlistResponse {
  private int merged;
}
