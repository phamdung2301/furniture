package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/** Body POST /products/{slug}/reviews và PUT /reviews/{id} (cùng validation). */
@Data
public class CreateReviewRequest {
  private int rating; // 1-5
  private String comment; // ≤1000 ký tự, lọc từ thô tục
  private List<String> imageUrls; // từ POST /reviews/images
  private String color; // màu đã mua
  private String orderId; // tuỳ chọn — nếu không hợp lệ sẽ dùng đơn HOÀN THÀNH mới nhất
}
