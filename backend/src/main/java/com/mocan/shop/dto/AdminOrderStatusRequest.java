package com.mocan.shop.dto;

import lombok.Data;

/**
 * Body PATCH /admin/orders/{orderNumber}/status (admin-don-hang.md §7).
 * status: enum đích (MỚI|ĐÃ XÁC NHẬN|ĐANG GIAO|HOÀN THÀNH|ĐÃ HỦY|HOÀN TRẢ).
 * trackingCode: bắt buộc khi → ĐANG GIAO. note: lý do/ghi chú của mốc mới —
 * bắt buộc khi → ĐÃ HỦY / HOÀN TRẢ (khách thấy trên timeline của họ).
 */
@Data
public class AdminOrderStatusRequest {
  private String status;
  private String trackingCode;
  private String note;
}
