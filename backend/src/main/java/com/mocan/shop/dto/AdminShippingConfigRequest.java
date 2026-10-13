package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * Body PUT /admin/shipping-config — admin-flash-sale-shipping.md §5.3, §8.
 * Lưu vào document SHIPPING_CONFIG (key=SHIPPING) — §10.3.
 */
@Data
public class AdminShippingConfigRequest {
  private BigDecimal freeThreshold;
}
