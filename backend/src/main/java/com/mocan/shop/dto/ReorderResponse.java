package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/**
 * Kết quả "Đặt lại đơn hàng" — POST /orders/{orderNumber}/reorder
 * (theo-doi-don.md §5): thêm lại món vào giỏ theo snapshot, kiểm tra tồn
 * hiện tại; món không thêm được được liệt kê kèm lý do (FE dịch sang
 * tiếng Việt khi hiển thị toast).
 */
@Data
public class ReorderResponse {
  private int added; // số dòng món đã thêm vào giỏ
  private List<SkippedItem> skipped;

  @Data
  public static class SkippedItem {
    private String variantId;
    private String productName; // snapshot trong đơn cũ
    private String color; // snapshot trong đơn cũ
    private String reason; // out_of_stock | discontinued | not_found
  }
}
