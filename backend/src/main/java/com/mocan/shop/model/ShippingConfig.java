package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;

/**
 * Cấu hình vận chuyển đơn nhất — 02-ERD.md entity SHIPPING_CONFIG
 * (admin-flash-sale-shipping.md §10.3, bổ sung 2026-10-12 màn 22).
 * Document duy nhất với key = "SHIPPING" giữ ngưỡng miễn phí vận chuyển
 * sửa được bởi admin, thay cho hằng hardcode trước đây trong ShippingService.
 * Chưa có document -> ShippingService dùng mặc định 10.000.000đ.
 */
@Data
@Document("shipping_configs")
public class ShippingConfig {
  public static final String KEY_SHIPPING = "SHIPPING";

  @Id private String id;
  @Indexed(unique = true) private String key;
  /** Ngưỡng tạm tính (chưa trừ voucher) được miễn phí vận chuyển (VND). */
  private BigDecimal freeThreshold;
}
