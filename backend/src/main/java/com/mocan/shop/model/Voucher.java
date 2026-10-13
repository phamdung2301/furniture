package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Voucher / Flash sale — 02-ERD.md. usedCount tăng nguyên tử khi áp thành công. */
@Data
@Document("vouchers")
public class Voucher {
  @Id private String id;
  @Indexed(unique = true) private String code;
  /**
   * Tên nội bộ chương trình flash sale — CHỈ admin thấy (admin-flash-sale-shipping.md
   * §10.2, bổ sung 2026-10-12 màn 22, đã ghi vào 02-ERD.md). Chỉ dùng khi
   * type=FLASH_SALE; phía khách không đọc field này (nhãn cố định "Flash sale").
   */
  private String name;
  private String type; // PERCENT | FIXED | FLASH_SALE
  private BigDecimal value;
  private BigDecimal maxDiscount;
  private BigDecimal minOrderValue;
  private List<String> applicableCategories;
  private List<String> applicableProductIds;
  private Instant startAt;
  private Instant endAt;
  private int totalUsageLimit; // 0 = KHÔNG giới hạn (convention §9.2 admin-voucher.md)
  /**
   * Giới hạn lượt mỗi khách — bổ sung 2026-10-12 màn 19 (admin-voucher.md §9.1,
   * đã ghi vào 02-ERD.md). null/0 = không giới hạn. VoucherService.validate
   * đếm đơn của user theo voucherCode (không tính ĐÃ HỦY / HOÀN TRẢ).
   */
  private Integer perUserLimit;
  private int usedCount;
  private boolean active;
  /**
   * Cấu hình theo món — CHỈ dùng khi type=FLASH_SALE (flash-sale.md §10 divergence 1,
   * đã bổ sung vào 02-ERD.md). null/rỗng -> fallback: applicableProductIds +
   * value (% giảm cho mọi màu) + maxDiscount.
   */
  private List<FlashSaleItem> items;

  /** 1 món trong chương trình flash sale: áp cho 1 product, có thể giới hạn 1 màu (variantId). */
  @Data
  public static class FlashSaleItem {
    private String productId;
    private String variantId; // null = mọi màu của product
    private BigDecimal flashPrice; // giá cố định — 1 trong 2 kiểu giảm
    private BigDecimal discountPercent; // % giảm — kiểu còn lại (kèm trần maxDiscount)
    private BigDecimal maxDiscount;
    private Integer itemQuota; // null = không giới hạn theo món (chỉ trần toàn chương trình)
    private int itemSoldCount; // tăng nguyên tử khi tạo đơn (F-022)
  }
}
