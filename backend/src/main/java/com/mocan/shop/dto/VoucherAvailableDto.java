package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/** Một mã trong danh sách khả dụng — GET /vouchers/available. */
@Data
public class VoucherAvailableDto {
  private String code;
  private String type; // PERCENT | FIXED | FLASH_SALE
  private BigDecimal value;
  private BigDecimal maxDiscount;
  private BigDecimal minOrderValue;
  /** Mô tả tiếng Việt cho FE, vd: "Giảm 50% tối đa 200.000đ — đơn từ 1.000.000đ". */
  private String description;
  /** Đủ điều kiện áp cho subtotal hiện tại (chỉ xét minOrderValue; các mã hết hạn/hết lượt đã bị lọc). */
  private boolean eligible;
  /** Lý do khi !eligible, vd: "Cần thêm 300.000đ để dùng mã này." */
  private String reason;
}
