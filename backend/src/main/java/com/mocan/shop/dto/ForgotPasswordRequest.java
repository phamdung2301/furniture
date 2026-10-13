package com.mocan.shop.dto;

import lombok.Data;

/**
 * Quên mật khẩu — F-010. Contract FE: POST /auth/forgot-password {email}.
 * Luôn trả 200 để không lộ email có tồn tại hay không.
 */
@Data
public class ForgotPasswordRequest {
  private String email;
}
