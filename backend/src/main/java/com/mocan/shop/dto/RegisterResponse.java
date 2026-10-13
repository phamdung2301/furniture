package com.mocan.shop.dto;

import lombok.Data;

/**
 * Kết quả đăng ký — FR-030: chưa xác thực SĐT thì KHÔNG trả token,
 * FE chuyển sang bước xác thực SĐT ngay.
 */
@Data
public class RegisterResponse {
  private String userId;
  private String message;
}
