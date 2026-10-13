package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/**
 * Kết quả kiểm tra quyền viết review.
 * reason: OK | NOT_LOGGED_IN | NOT_PURCHASED | NOT_COMPLETED | ALREADY_REVIEWED
 */
@Data
public class ReviewEligibilityDto {
  private boolean canReview;
  private boolean hasReviewed;
  private String reason;
  private List<String> purchasedColors;
  private String reviewId; // có khi ALREADY_REVIEWED
  private String orderId; // đơn HOÀN THÀNH mới nhất chứa SP, khi OK
}
