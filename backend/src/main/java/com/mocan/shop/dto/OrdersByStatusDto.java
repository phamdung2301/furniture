package com.mocan.shop.dto;

import lombok.Data;

/** Số đơn theo trạng thái (donut) — GET /admin/stats/orders-by-status (§4). */
@Data
public class OrdersByStatusDto {
  private String status; // enum FR-012: MỚI|ĐÃ XÁC NHẬN|ĐANG GIAO|HOÀN THÀNH|ĐÃ HỦY|HOÀN TRẢ
  private long count;
}
