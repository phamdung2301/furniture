package com.mocan.shop.dto;

import lombok.Data;

/**
 * Gửi OTP — F-024. Contract FE: POST /auth/otp/send {phone, purpose}.
 * purpose = "register" | "login" | "verify-phone" | "change-phone"
 * (2 purpose sau dùng ở màn Hồ sơ).
 */
@Data
public class OtpSendRequest {
  private String phone;
  private String purpose;
}
