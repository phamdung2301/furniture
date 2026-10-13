package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Body POST /admin/flash-sales và PUT /admin/flash-sales/{id} —
 * admin-flash-sale-shipping.md §3, §8. `code` server tự sinh, `type` server gán
 * FLASH_SALE — client không gửi 2 field đó. Validate nghiệp vụ nằm ở
 * AdminFlashSaleService (422 kèm field; 409/422 cho trùng lịch theo §3.2).
 * Mỗi item: đúng 1 trong flashPrice | discountPercent (XOR).
 */
@Data
public class AdminFlashSaleRequest {
  private String name;
  private Instant startAt;
  private Instant endAt;
  private Integer totalUsageLimit; // null/0 = không giới hạn
  private Boolean active;
  private List<ItemRequest> items;

  @Data
  public static class ItemRequest {
    private String productId;
    private String variantId; // null = mọi màu
    private BigDecimal flashPrice;
    private BigDecimal discountPercent;
    private BigDecimal maxDiscount;
    private Integer itemQuota; // null = không giới hạn theo món
  }
}
