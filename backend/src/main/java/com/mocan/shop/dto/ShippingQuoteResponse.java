package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

/**
 * Response báo giá ship — dat-hang.md §7:
 * {totalAreaM2, tier:{min,max}, fee, freeShipping, overLimit}.
 * Thêm originalFee (phí gốc của nấc, để FE gạch giá khi miễn phí) và breakdown từng dòng
 * cho tooltip "Sofa góc L 3.8 m² × 1 + ..." (§5.3).
 */
@Data
public class ShippingQuoteResponse {
  private BigDecimal totalAreaM2;
  private TierDto tier;
  /** Phí hiệu dụng: 0 khi miễn phí, null khi vượt giới hạn (liên hệ báo giá). */
  private BigDecimal fee;
  /** Phí gốc của nấc (null nếu không có nấc nào khớp). */
  private BigDecimal originalFee;
  private boolean freeShipping;
  private boolean overLimit;
  private List<LineDto> breakdown;

  @Data
  public static class TierDto {
    private BigDecimal min;
    private BigDecimal max; // null = không giới hạn
  }

  @Data
  public static class LineDto {
    private String variantId;
    private String productName;
    private String color;
    private int qty;
    /** Diện tích dòng = lengthM × widthM × qty (m²). */
    private BigDecimal areaM2;
  }
}
