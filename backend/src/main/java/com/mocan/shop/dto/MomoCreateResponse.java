package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

/** 201 POST /payments/momo/create — FE render QR từ qrCodeUrl, mở app qua deeplink. */
@Data
public class MomoCreateResponse {
  private String qrCodeUrl;
  private String deeplink;
  private String momoOrderId;
  private BigDecimal amount;
  private Instant expiresAt;
}
