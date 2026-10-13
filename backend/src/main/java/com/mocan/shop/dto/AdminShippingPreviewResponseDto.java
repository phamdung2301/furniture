package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * Response POST /admin/shipping-rules/preview — admin-flash-sale-shipping.md §5.4, §8.
 * Dùng lại đúng logic ShippingService (tra bậc + ngưỡng cấu hình + trần 10 m²):
 * tier = null khi rơi khoảng trống hoặc vượt trần; fee = null khi không tính được /
 * vượt trần, 0 khi miễn phí; originalFee = phí gốc theo bậc (để FE gạch giá).
 */
@Data
public class AdminShippingPreviewResponseDto {
  private TierDto tier;
  private BigDecimal originalFee;
  private BigDecimal fee;
  private boolean freeShipping;
  private boolean overLimit;

  @Data
  public static class TierDto {
    private BigDecimal min;
    private BigDecimal max; // null = trở lên
  }
}
