package com.mocan.shop.dto;

import lombok.Data;

/**
 * Body hủy đơn — POST /orders/{orderNumber}/cancel (F-009).
 * reason: lý do hủy do user nhập, không bắt buộc; body có thể vắng mặt
 * (luồng hủy từ màn Thanh toán không gửi body).
 */
@Data
public class CancelOrderRequest {
  private String reason;
}
