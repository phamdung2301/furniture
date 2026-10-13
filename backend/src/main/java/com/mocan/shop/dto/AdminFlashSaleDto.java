package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * 1 chương trình flash sale trong danh sách/chi tiết admin —
 * admin-flash-sale-shipping.md §8. Chỉ dùng cho Voucher type=FLASH_SALE.
 * status SUY RA ở server theo §2.3 (INACTIVE khi active=false, còn lại theo
 * FlashSaleService.statusOf: RUNNING | UPCOMING | ENDED).
 * totalUsageLimit = 0 = không giới hạn; itemQuota null = không giới hạn theo món.
 * originalPrice = giá của phạm vi áp dụng (variant đã chọn, hoặc variant mặc
 * định F-004 khi áp mọi màu) tại thời điểm trả.
 */
@Data
public class AdminFlashSaleDto {
  private String id;
  private String code; // server tự sinh FS-XXXXXX — admin không nhập/sửa
  private String name; // tên nội bộ, chỉ admin thấy (§10.2)
  private Instant startAt;
  private Instant endAt;
  private int totalUsageLimit;
  private int usedCount;
  private boolean active;
  private String status; // RUNNING | UPCOMING | ENDED | INACTIVE
  private int itemCount;
  private List<ItemDto> items;

  @Data
  public static class ItemDto {
    private String productId;
    private String productName;
    private String image;
    private String variantId; // null = mọi màu
    private String color; // tên màu khi variantId != null
    private BigDecimal flashPrice; // 1 trong 2 kiểu giảm (XOR discountPercent)
    private BigDecimal discountPercent;
    private BigDecimal maxDiscount;
    private Integer itemQuota;
    private int itemSoldCount;
    private BigDecimal originalPrice;
  }
}
