package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/**
 * Yêu cầu gộp giỏ local vào giỏ server khi đăng nhập — F-006.
 * Contract khớp FE: POST /cart/merge {items:[{variantId,qty}]}.
 */
@Data
public class MergeCartRequest {
  private List<MergeItem> items;

  @Data
  public static class MergeItem {
    private String variantId;
    private int qty;
  }
}
