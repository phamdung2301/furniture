package com.mocan.shop.dto;

import lombok.Data;

/**
 * POST /orders — tạo đơn từ GIỎ của user (F-007: "tạo đơn từ giỏ").
 * {addressId | receiver{...}, voucherCode?, paymentMethod, note?}.
 */
@Data
public class CreateOrderRequest {
  /** Ưu tiên dùng địa chỉ đã lưu (phải thuộc về đúng user). */
  private String addressId;
  /** Người nhận nhập tay khi không dùng địa chỉ đã lưu. */
  private ReceiverDto receiver;
  private String voucherCode;
  /** COD | BANK_TRANSFER | MOMO (chỉ lưu ở màn này; MoMo thật xử lý ở màn 8 — F-008). */
  private String paymentMethod;
  private String note;

  @Data
  public static class ReceiverDto {
    private String name;
    private String phone;
    private String province;
    private String district;
    private String ward;
    private String detail;
  }
}
