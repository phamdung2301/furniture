package com.mocan.shop.dto;

import lombok.Data;

/**
 * Body PATCH /admin/customers/{id}/lock — admin-khach-hang.md §4.2/§7.
 * `reason` (lý do khóa) KHÔNG bắt buộc; lưu vào User.lockReason để hiển thị
 * lại ở chi tiết (§3.3) và xóa khi mở khóa.
 */
@Data
public class AdminCustomerLockRequest {
  private String reason;
}
