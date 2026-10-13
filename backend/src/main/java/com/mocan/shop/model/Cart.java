package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

/** Giỏ hàng — 02-ERD.md. */
@Data
@Document("carts")
public class Cart {
  @Id private String id;
  private String userId; // null = khách vãng lai (dùng sessionId)
  private String sessionId;
  private List<CartItem> items;
  private Instant updatedAt;

  @Data
  public static class CartItem {
    private String variantId;
    private int qty;
    // Chương trình flash sale đang áp cho dòng này (flash-sale.md §5.2,
    // 02-ERD divergence 2) — server tự resolve khi merge/đọc giỏ, null = giá thường.
    private String flashSaleProgramId;
  }
}
