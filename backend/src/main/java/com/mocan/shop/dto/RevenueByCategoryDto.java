package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;

/** Doanh thu theo danh mục — GET /admin/stats/revenue-by-category (§5), sắp giảm dần. */
@Data
public class RevenueByCategoryDto {
  private String categoryId;
  private String categoryName;
  private BigDecimal revenue;
}
