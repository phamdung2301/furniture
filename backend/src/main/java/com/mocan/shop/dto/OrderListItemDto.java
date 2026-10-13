package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Dòng tóm tắt 1 đơn trong danh sách — GET /orders (theo-doi-don.md §8).
 * Chỉ field hiển thị ở card đơn; chi tiết đầy đủ lấy qua GET /orders/{orderNumber}.
 */
@Data
public class OrderListItemDto {
  private String orderNumber;
  private Instant createdAt;
  private BigDecimal total;
  private String status;
  private String paymentMethod;
  private String paymentStatus; // CHƯA THANH TOÁN | ĐÃ THANH TOÁN | THẤT BẠI
  private int itemCount; // số dòng món phân biệt trong đơn
  private List<Preview> itemsPreview; // tối đa 3 món đầu
  private boolean hasUnreviewedItems; // HOÀN THÀNH + còn món chưa đánh giá -> link nhanh §6

  @Data
  public static class Preview {
    private String image;
    private String productName;
  }
}
