package com.mocan.shop.dto;

import lombok.Data;

/** Kết quả gửi OTP — F-024. */
@Data
public class OtpSendResponse {
  private String message;
  private int expiresInSeconds; // 300 — OTP hiệu lực 5 phút
}
