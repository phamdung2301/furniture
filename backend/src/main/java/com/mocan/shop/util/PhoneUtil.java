package com.mocan.shop.util;

import java.util.regex.Pattern;

/** Chuẩn hóa & kiểm tra SĐT Việt Nam — F-010 / F-024. */
public final class PhoneUtil {
  private static final Pattern VN = Pattern.compile("^0(3|5|7|8|9)\\d{8}$");

  private PhoneUtil() {}

  /** Chuẩn hóa về dạng 0xxxxxxxxx: chấp nhận 0xxx, +84xxx, 84xxx, kèm dấu cách/chấm/gạch. */
  public static String normalize(String raw) {
    if (raw == null) return null;
    String p = raw.replaceAll("[\\s.\\-()]", "");
    if (p.startsWith("+84")) p = "0" + p.substring(3);
    else if (p.startsWith("84") && p.length() == 11) p = "0" + p.substring(2);
    return p;
  }

  /** Đúng định dạng SĐT VN: 10 số, đầu 03/05/07/08/09. */
  public static boolean isValidVn(String phone) {
    return phone != null && VN.matcher(phone).matches();
  }
}
