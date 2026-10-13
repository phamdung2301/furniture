package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * POST /vouchers/validate → {valid, discount, message}.
 * Thêm errorCode để FE switch từng case: NOT_FOUND | EXPIRED | USED_UP | MIN_NOT_MET.
 */
@Data
public class ValidateVoucherResponse {
  private boolean valid;
  private BigDecimal discount; // 0 khi !valid
  private String errorCode; // null khi valid
  private String message; // null khi valid
}
