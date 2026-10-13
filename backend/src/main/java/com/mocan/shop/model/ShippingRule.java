package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;

/** Bảng phí ship theo diện tích — 02-ERD.md (FR-029). Admin cấu hình được. */
@Data
@Document("shipping_rules")
public class ShippingRule {
  @Id private String id;
  private BigDecimal minAreaM2;
  private BigDecimal maxAreaM2; // null = không giới hạn
  private BigDecimal fee;
  private boolean active;
}
