package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Biến thể theo MÀU — 02-ERD.md (QĐ 2026-10-10).
 * Mỗi màu: SKU/giá/tồn kho riêng. Trừ kho nguyên tử khi đặt hàng (FR-011).
 */
@Data
@Document("product_variants")
public class ProductVariant {
  @Id private String id;
  private String productId;
  @Indexed(unique = true) private String sku;
  private String color;
  private String colorHex; // mã màu hiển thị chấm màu (vd: #9AA0A6)
  private BigDecimal price;
  private int stock;
  private int lowStockThreshold;
  private BigDecimal lengthM; // dài (m) — tính diện tích chiếm chỗ (FR-029)
  private BigDecimal widthM; // rộng (m)
  private String sizeLabel; // vd: "1m8 x 2m" (hiển thị)
  private String materialNote; // ghi chú chất liệu (hiển thị, không tách kho)

  /**
   * Thông tin flash sale của biến thể — TRANSIENT, không lưu DB.
   * FlashSaleService gắn vào khi serialize response (flash-sale.md §5.1/§9):
   * FE chỉ hiển thị flashPrice backend trả, tuyệt đối không tự nhân %.
   * null = biến thể không thuộc chương trình nào.
   */
  @Transient private FlashSaleInfo flashSale;

  @Data
  public static class FlashSaleInfo {
    private String programId;
    private BigDecimal flashPrice; // giá flash cuối cùng backend đã tính
    private int discountPercent; // % hiển thị badge (làm tròn)
    private Instant startAt;
    private Instant endAt;
    private boolean upcoming; // true = chương trình sắp diễn ra (FE chỉ hiện ghi chú, không hiện giá flash)
    private boolean itemSoldOut; // hết suất của món
    private Integer itemQuota; // null = ẩn thanh tiến độ theo món
    private Integer itemSoldCount;
  }
}
