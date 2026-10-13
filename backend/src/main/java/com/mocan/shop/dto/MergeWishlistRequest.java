package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Yêu cầu gộp wishlist local vào server khi đăng nhập — FR-018 (pattern F-006 giỏ hàng).
 * Contract: POST /wishlist/merge {items:[{productId, priceAtSave, addedAt}]}.
 */
@Data
public class MergeWishlistRequest {
  private List<MergeItem> items;

  @Data
  public static class MergeItem {
    private String productId;
    private BigDecimal priceAtSave;
    private Instant addedAt;
  }
}
