package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

/**
 * Response GET /admin/shipping-rules — admin-flash-sale-shipping.md §8:
 * { rules (sort minAreaM2 asc), config: { freeThreshold, maxAreaM2 } }.
 * config.maxAreaM2 là trần 10 m² hardcode CHỈ-ĐỌC (§0.2).
 */
@Data
public class AdminShippingRulesResponseDto {
  private List<AdminShippingRuleDto> rules;
  private ConfigDto config;

  @Data
  public static class ConfigDto {
    private BigDecimal freeThreshold;
    private BigDecimal maxAreaM2;
  }
}
