package com.mocan.shop.dto;

import lombok.Data;

/**
 * Xác thực OTP — F-024. Contract FE: POST /auth/otp/verify {phone, code, purpose}.
 * purpose = "register" | "login".
 */
@Data
public class OtpVerifyRequest {
  private String phone;
  private String code;
  private String purpose;
}
