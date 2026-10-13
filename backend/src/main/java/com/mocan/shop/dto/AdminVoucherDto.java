package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * 1 voucher thường trong danh sách/chi tiết admin — admin-voucher.md §6.
 * Chỉ dùng cho type PERCENT | FIXED (FLASH_SALE thuộc màn 22, không bao giờ
 * xuất hiện qua AdminVoucherController). totalUsageLimit = 0 và
 * perUserLimit null/0 nghĩa là KHÔNG giới hạn (§9.1, §9.2).
 */
@Data
public class AdminVoucherDto {
  private String id;
  private String code;
  private String type; // PERCENT | FIXED
  private BigDecimal value;
  private BigDecimal maxDiscount;
  private BigDecimal minOrderValue;
  private List<String> applicableCategories;
  private List<String> applicableProductIds;
  private Integer perUserLimit;
  private Instant startAt;
  private Instant endAt;
  private int totalUsageLimit;
  private int usedCount;
  private boolean active;
}
