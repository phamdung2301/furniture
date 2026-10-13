package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Chương trình flash sale hiện hành — flash-sale.md §9.
 * Tên chương trình KHÔNG có trong entity Voucher -> FE dùng nhãn cố định "Flash sale";
 * tuyệt đối không trả `code` ra ngoài (mã nội bộ — copy-ux-linter).
 * flashPrice/discountPercent do backend tính sẵn, FE không tự nhân %.
 */
@Data
public class FlashSaleProgramDto {
  private String id;
  private String status; // RUNNING | UPCOMING (theo serverNow)
  private Instant startAt;
  private Instant endAt;
  private Instant serverNow; // FE hiệu chỉnh lệch đồng hồ cho CountdownTimer (§3)
  private int totalUsageLimit;
  private int usedCount;
  private List<ItemDto> items;

  @Data
  public static class ItemDto {
    private String productId;
    private String slug;
    private String name;
    private String image;
    private BigDecimal ratingAvg;
    private int ratingCount;
    private ProductWithVariantsDto.BadgeDto badge;
    private List<ColorDto> colors; // mọi màu của sản phẩm (chấm màu như ProductCard)
    private List<String> flashVariantIds; // các variant (màu) thuộc chương trình
    private String variantId; // variant mặc định F-004 trong các màu thuộc chương trình
    private BigDecimal originalPrice; // giá thường của variant mặc định
    private BigDecimal flashPrice; // giá flash của variant mặc định (backend tính)
    private int discountPercent;
    private boolean hasMultipleFlashPrices;
    private Integer itemQuota; // null -> FE ẩn thanh tiến độ theo món (§4.3)
    private Integer itemSoldCount;
    private boolean itemSoldOut; // hết suất của món
    private boolean stockOut; // mọi màu thuộc chương trình đều hết tồn kho
    private boolean soldOut; // itemSoldOut || stockOut (backend tính — §9)
  }

  @Data
  public static class ColorDto {
    private String variantId;
    private String color;
    private String colorHex;
    private int stock;
  }
}
