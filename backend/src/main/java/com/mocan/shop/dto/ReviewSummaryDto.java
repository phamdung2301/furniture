package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Map;

/**
 * Tóm tắt đánh giá — khớp ReviewSummary FE (api/productApi.summarizeReviews).
 * distribution: % số review 5→1 sao.
 */
@Data
public class ReviewSummaryDto {
  private BigDecimal average;
  private long total;
  private Map<Integer, Integer> distribution;
}
