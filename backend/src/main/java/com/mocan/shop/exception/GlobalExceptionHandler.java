package com.mocan.shop.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.LinkedHashMap;
import java.util.Map;

/** Chuyển ApiException thành body {code, message, field?, ...extras} để FE đọc code xử lý riêng. */
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<Map<String, Object>> handleApiException(ApiException ex) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("code", ex.getCode());
    body.put("message", ex.getReason());
    if (ex.getField() != null) {
      body.put("field", ex.getField());
    }
    if (ex.getExtras() != null) {
      body.putAll(ex.getExtras());
    }
    return ResponseEntity.status(ex.getStatusCode()).body(body);
  }
}
