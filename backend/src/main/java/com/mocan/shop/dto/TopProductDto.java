package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/** Sản phẩm bán chạy — GET /admin/stats/top-products (§6). */
@Data
public class TopProductDto {
  private String productId;
  private String name;
  private String image;
  private long soldQty;
  private BigDecimal revenue;
}
