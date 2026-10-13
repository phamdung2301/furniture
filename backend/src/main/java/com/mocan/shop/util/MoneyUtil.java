package com.mocan.shop.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Định dạng tiền VND cho message tiếng Việt: 1500000 → "1.500.000đ". */
public final class MoneyUtil {
  private MoneyUtil() {}

  public static String vnd(BigDecimal amount) {
    if (amount == null) return "0đ";
    long v = amount.setScale(0, RoundingMode.HALF_UP).longValue();
    return String.format("%,d", v).replace(',', '.') + "đ";
  }
}
