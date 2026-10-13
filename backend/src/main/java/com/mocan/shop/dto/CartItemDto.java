package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * Dòng hàng trong giỏ — F-006 / FR-008.
 * price = giá HIỆN TẠI của biến thể; image = ảnh đầu của sản phẩm.
 */
@Data
public class CartItemDto {
  private String variantId;
  private String productId;
  private String productName;
  private String color;
  private String colorHex;
  private BigDecimal price;
  private String image;
  private int stock;
  private int qty;
  // Khác null = dòng đang hưởng giá flash sale của chương trình này (flash-sale.md §5.2).
  private String flashSaleProgramId;
}
