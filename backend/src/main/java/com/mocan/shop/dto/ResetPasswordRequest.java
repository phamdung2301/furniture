package com.mocan.shop.dto;

import lombok.Data;

/**
 * Đặt lại mật khẩu — F-010. Contract FE: POST /auth/reset-password {token, newPassword}.
 * token từ link email, hiệu lực 30 phút; newPassword ≥ 8 ký tự.
 */
@Data
public class ResetPasswordRequest {
  private String token;
  private String newPassword;
}
