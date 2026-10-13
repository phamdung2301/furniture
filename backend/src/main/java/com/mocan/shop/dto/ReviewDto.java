package com.mocan.shop.dto;

import com.mocan.shop.model.Review;
import lombok.Data;
import java.time.Instant;
import java.util.List;

/**
 * Review trả về FE — khớp shape mock FE (api/reviewApi) đang đọc:
 * id, productId, userId, userName, rating, comment, images[], color,
 * verifiedPurchase, orderId, createdAt.
 */
@Data
public class ReviewDto {
  private String id;
  private String productId;
  private String userId;
  private String userName;
  private int rating;
  private String comment;
  private List<String> images;
  private String color;
  private boolean verifiedPurchase;
  private String orderId;
  private Instant createdAt;

  public static ReviewDto of(Review r, String userName) {
    ReviewDto d = new ReviewDto();
    d.setId(r.getId());
    d.setProductId(r.getProductId());
    d.setUserId(r.getUserId());
    d.setUserName(userName);
    d.setRating(r.getRating());
    d.setComment(r.getComment());
    d.setImages(r.getImages() != null ? r.getImages() : List.of());
    d.setColor(r.getColor());
    d.setVerifiedPurchase(r.isVerifiedPurchase());
    d.setOrderId(r.getOrderId());
    d.setCreatedAt(r.getCreatedAt());
    return d;
  }
}
