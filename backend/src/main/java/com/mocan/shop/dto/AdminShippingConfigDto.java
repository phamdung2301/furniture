package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/** Response GET/PUT /admin/shipping-config — admin-flash-sale-shipping.md §8. */
@Data
public class AdminShippingConfigDto {
  private BigDecimal freeThreshold;
}
