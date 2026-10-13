package com.mocan.shop.dto;

import lombok.Data;

/** Response sau POST/PUT review: {review, summary} (summary cập nhật ratingAvg). */
@Data
public class ReviewMutationResponse {
  private ReviewDto review;
  private ReviewSummaryDto summary;
}
