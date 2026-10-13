package com.mocan.shop.dto;

import lombok.Data;

/**
 * Đổi số điện thoại — PUT /users/me/phone (F-024).
 * otpCode là mã đã gửi về SỐ MỚI qua POST /auth/otp/send (purpose=change-phone);
 * server xác thực lại qua OtpService trước khi đổi.
 */
@Data
public class ChangePhoneRequest {
  private String phone;
  private String otpCode;
}
