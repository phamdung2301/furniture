package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * Body POST /admin/shipping-rules/preview — admin-flash-sale-shipping.md §5.4, §8.
 * subtotal null/0 = chỉ kiểm tra bậc phí, không xét miễn phí theo ngưỡng.
 */
@Data
public class AdminShippingPreviewRequest {
  private BigDecimal areaM2;
  private BigDecimal subtotal;
}
