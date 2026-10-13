package com.mocan.shop.dto;

import lombok.Data;

/** Body PATCH /admin/orders/{orderNumber}/admin-note — ghi chú nội bộ admin. */
@Data
public class AdminOrderNoteRequest {
  private String adminNote;
}
