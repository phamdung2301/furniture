package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Sản phẩm yêu thích — F-013 / FR-018 (02-ERD.md: WishlistItem + giả định bổ sung).
 * Mỗi cặp (userId, productId) duy nhất — compound unique index; thêm trùng → 409.
 * priceAtSave = giá variant mặc định (F-004) tại lúc bấm tim — cho badge "Đã giảm giá".
 * Tiền dùng BigDecimal (VND), nhất quán với ProductVariant.price / Product.basePrice.
 */
@Data
@Document("wishlists")
@CompoundIndexes({
    @CompoundIndex(name = "uq_user_product", def = "{'userId': 1, 'productId': 1}", unique = true),
    @CompoundIndex(name = "idx_user", def = "{'userId': 1}")
})
public class Wishlist {
  @Id private String id;
  @Indexed private String userId;
  private String productId;
  private BigDecimal priceAtSave;
  private Instant createdAt;
}
