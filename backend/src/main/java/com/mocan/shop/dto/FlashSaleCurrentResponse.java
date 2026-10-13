package com.mocan.shop.dto;

import lombok.Data;

/**
 * GET /flash-sale/current — flash-sale.md §9.
 * program = null khi không có chương trình hiện hành (FE hiện empty state §7.2).
 */
@Data
public class FlashSaleCurrentResponse {
  private FlashSaleProgramDto program;
}
