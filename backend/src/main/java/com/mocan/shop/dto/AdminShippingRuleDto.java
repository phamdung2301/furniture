package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * 1 bậc phí vận chuyển — admin-flash-sale-shipping.md §5.2, §8.
 * maxAreaM2 null = "Trở lên" (không giới hạn).
 */
@Data
public class AdminShippingRuleDto {
  private String id;
  private BigDecimal minAreaM2;
  private BigDecimal maxAreaM2;
  private BigDecimal fee;
  private boolean active;
}
