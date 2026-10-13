package com.mocan.shop.dto;

import lombok.Data;

/**
 * Đăng nhập bằng mật khẩu — F-010.
 * Contract FE: POST /auth/login {identifier, password}.
 * identifier = số điện thoại hoặc email.
 */
@Data
public class LoginRequest {
  private String identifier;
  private String password;
}
