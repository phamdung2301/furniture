package com.mocan.shop.dto;

import lombok.Data;

/**
 * Đăng ký — F-010. Contract FE: POST /auth/register {fullName, email, phone, password}.
 * phone bắt buộc; password ≥ 8 ký tự.
 */
@Data
public class RegisterRequest {
  private String fullName;
  private String email;
  private String phone;
  private String password;
}
