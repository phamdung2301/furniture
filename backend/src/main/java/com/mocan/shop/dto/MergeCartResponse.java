package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

/**
 * Kết quả gộp giỏ — F-006.
 * skipped: dòng không gộp được; reason = "not_found" | "discontinued" | "out_of_stock".
 */
@Data
public class MergeCartResponse {
  private String userId;
  private List<CartItemDto> items;
  private BigDecimal subtotal;
  private int mergedCount;
  private List<SkippedItem> skipped;

  @Data
  public static class SkippedItem {
    private String variantId;
    private String reason;
  }
}
