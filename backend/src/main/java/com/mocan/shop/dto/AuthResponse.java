package com.mocan.shop.dto;

import lombok.Data;

/**
 * Kết quả đăng nhập / xác thực OTP.
 * Contract FE: POST /auth/login → {accessToken, user};
 * POST /auth/otp/verify (purpose=login) → {accessToken, user};
 * POST /auth/otp/verify (purpose=register) → {accessToken: null, user, message}.
 */
@Data
public class AuthResponse {
  private String accessToken; // null khi chưa được cấp (vd: vừa xác thực xong bước đăng ký)
  private UserDto user;
  private String message;
}
