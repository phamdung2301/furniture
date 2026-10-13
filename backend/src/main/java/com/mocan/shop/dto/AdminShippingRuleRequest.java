package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * Body POST /admin/shipping-rules và PUT /admin/shipping-rules/{id} —
 * admin-flash-sale-shipping.md §5.2.1, §8. Bật/tắt bậc đi qua chính PUT này
 * (field active) — không có endpoint PATCH riêng. Validate: 422 khi
 * max <= min, chồng lấp với bậc active khác, hoặc 2 bậc "trở lên" active.
 */
@Data
public class AdminShippingRuleRequest {
  private BigDecimal minAreaM2;
  private BigDecimal maxAreaM2; // null = trở lên
  private BigDecimal fee;
  private Boolean active;
}
