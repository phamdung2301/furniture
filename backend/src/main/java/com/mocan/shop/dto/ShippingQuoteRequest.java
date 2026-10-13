package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/** Request báo giá ship — dat-hang.md §7: POST /shipping/quote {items:[{variantId,qty}]}. */
@Data
public class ShippingQuoteRequest {
  private List<QuoteItem> items;

  @Data
  public static class QuoteItem {
    private String variantId;
    private int qty;
  }
}
