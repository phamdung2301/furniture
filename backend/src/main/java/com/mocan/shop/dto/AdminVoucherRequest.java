package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Body POST /admin/vouchers và PUT /admin/vouchers/{id} — admin-voucher.md §3, §6.
 * Validate nghiệp vụ F-018 nằm ở AdminVoucherService (409 trùng code toàn cục,
 * 422 kèm field khi vi phạm: endAt <= startAt, % ngoài 1–100, giới hạn < đã dùng…).
 * totalUsageLimit null/0 = không giới hạn; perUserLimit null/0 = không giới hạn.
 */
@Data
public class AdminVoucherRequest {
  private String code;
  private String type; // PERCENT | FIXED (FLASH_SALE bị từ chối — thuộc màn 22)
  private BigDecimal value;
  private BigDecimal maxDiscount;
  private BigDecimal minOrderValue;
  private List<String> applicableCategories;
  private List<String> applicableProductIds;
  private Integer perUserLimit;
  private Instant startAt;
  private Instant endAt;
  private Integer totalUsageLimit;
  private Boolean active;
}
