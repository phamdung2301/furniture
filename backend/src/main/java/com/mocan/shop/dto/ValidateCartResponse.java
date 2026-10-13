package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

/**
 * Kết quả validate giỏ — mỗi dòng: biến thể còn tồn tại / SP còn bán / tồn kho / giá hiện tại.
 */
@Data
public class ValidateCartResponse {
  private List<ValidateResult> results;

  @Data
  public static class ValidateResult {
    private String variantId;
    private boolean exists;
    private boolean active;
    private int stock;
    private BigDecimal currentPrice;
    private String productId;
    private String productName;
    private String color;
    private String colorHex;
    private String image;
  }
}
