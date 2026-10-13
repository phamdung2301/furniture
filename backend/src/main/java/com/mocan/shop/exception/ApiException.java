package com.mocan.shop.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;

/**
 * Lỗi API có mã (code) để FE nhận diện trường hợp:
 * PHONE_NOT_VERIFIED, ACCOUNT_LOCKED, INVALID_CREDENTIALS, OTP_INVALID,
 * OTP_EXPIRED, OTP_ATTEMPTS_EXCEEDED, RESEND_TOO_SOON, EMAIL_EXISTS, PHONE_EXISTS...
 * GlobalExceptionHandler chuyển thành body {code, message}.
 */
public class ApiException extends ResponseStatusException {
  private final String code;
  private final String field;
  private final Map<String, Object> extras;

  public ApiException(HttpStatus status, String code, String message) {
    this(status, code, message, null);
  }

  /**
   * @param field trường form liên quan (vd "slug", "sku", "variant") để FE gắn
   *              lỗi đúng trường — admin-san-pham.md §6 (409 { field, message }).
   *              null = lỗi không gắn trường cụ thể.
   */
  public ApiException(HttpStatus status, String code, String message, String field) {
    this(status, code, message, field, Map.of());
  }

  /**
   * @param extras số liệu kèm theo lỗi để FE hiện dialog đúng ngữ cảnh —
   *               VD 409 xóa danh mục: { childCount } / { productCount }
   *               (admin-danh-muc.md §7). GlobalExceptionHandler merge vào body.
   */
  public ApiException(
      HttpStatus status, String code, String message, String field, Map<String, Object> extras) {
    super(status, message);
    this.code = code;
    this.field = field;
    this.extras = extras == null ? Map.of() : extras;
  }

  public String getCode() {
    return code;
  }

  public String getField() {
    return field;
  }

  public Map<String, Object> getExtras() {
    return extras;
  }
}
