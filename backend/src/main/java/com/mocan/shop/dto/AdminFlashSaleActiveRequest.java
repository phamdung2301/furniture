package com.mocan.shop.dto;

import lombok.Data;

/** Body PATCH /admin/flash-sales/{id}/active — admin-flash-sale-shipping.md §4.1, §8. */
@Data
public class AdminFlashSaleActiveRequest {
  private Boolean active;
}
