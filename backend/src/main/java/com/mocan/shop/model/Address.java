package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

/**
 * Sổ địa chỉ giao hàng — F-011 / FR-009.
 * LƯU Ý: 02-ERD.md ghi addresses embedded trong User, nhưng checkout (dat-hang.md §7)
 * yêu cầu CRUD /addresses độc lập nên tách thành collection riêng.
 * User.addresses (embedded) giữ nguyên để tương thích ngược, không dùng cho checkout.
 */
@Data
@Document("addresses")
public class Address {
  @Id private String id;
  @Indexed private String userId;
  private String label; // Nhà | Công ty
  private String receiverName;
  private String phone;
  private String province;
  private String district;
  private String ward;
  private String detail;
  private String note; // ghi chú giao hàng
  private boolean isDefault;
  private Instant createdAt;
}
