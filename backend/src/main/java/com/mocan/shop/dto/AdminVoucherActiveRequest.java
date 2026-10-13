package com.mocan.shop.dto;

import lombok.Data;

/** Body PATCH /admin/vouchers/{id}/active — admin-voucher.md §4.1, §6. */
@Data
public class AdminVoucherActiveRequest {
  private Boolean active;
}
