package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/** POST /orders → 201 {orderNumber, total, paymentMethod, status}. */
@Data
public class CreateOrderResponse {
  private String id;
  private String orderNumber; // vd: NT-20261011-0001
  private BigDecimal total;
  private String paymentMethod;
  private String status; // MỚI
}
