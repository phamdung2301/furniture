package com.mocan.shop.dto;

import lombok.Data;
import java.time.Instant;

/** GET /payments/status/{orderNumber} — cho nút "Tôi đã thanh toán xong" của FE. */
@Data
public class PaymentStatusResponse {
  private String status; // CHƯA THANH TOÁN | ĐÃ THANH TOÁN | THẤT BẠI
  private Instant paidAt; // có khi đã thanh toán
  private String message; // lý do thất bại (nếu MoMo trả về), null khi bình thường
}
