package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/** POST /vouchers/validate {code, subtotal}. */
@Data
public class ValidateVoucherRequest {
  private String code;
  private BigDecimal subtotal;
}
