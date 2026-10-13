package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

/**
 * Đánh giá — 02-ERD.md. 1 user 1 review/sản phẩm, cần đơn HOÀN THÀNH (FR-017).
 * color + userName: bổ sung 2026-10-11 (màn Viết/Sửa đánh giá — 02-ERD cần cập nhật sau).
 */
@Data
@Document("reviews")
@CompoundIndexes(@CompoundIndex(name = "product_user_unique", def = "{'productId': 1, 'userId': 1}", unique = true))
public class Review {
  @Id private String id;
  private String productId;
  private String userId;
  private String userName; // snapshot tên user lúc tạo (FE đọc review.userName)
  private String orderId;
  private String color; // màu đã mua (snapshot từ OrderItem)
  private int rating; // 1-5
  private String comment;
  private List<String> images;
  private boolean verifiedPurchase; // true khi tạo từ đơn HOÀN THÀNH
  private Instant createdAt;
}
