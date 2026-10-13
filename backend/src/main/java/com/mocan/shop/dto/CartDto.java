package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

/**
 * Giỏ hàng trả về cho FE — F-006 / FR-008.
 */
@Data
public class CartDto {
  private String userId;
  private List<CartItemDto> items;
  private BigDecimal subtotal;
}
