package com.mocan.shop.dto;

import lombok.Data;

/**
 * Body POST /admin/inventory/{variantId}/adjust (admin-ton-kho.md §9/§5).
 * mode: RECEIVE (cộng qty) | REMOVE (trừ qty) | SET (đặt tồn = newStock).
 * reason: RESTOCK | STOCKTAKE | DAMAGED | RETURN | DISPOSAL | OTHER
 * (note bắt buộc khi reason = OTHER). expectedStock = tồn tại thời điểm
 * admin mở modal — không khớp tồn hiện tại → 409 STOCK_CHANGED (FR-011).
 */
@Data
public class AdminInventoryAdjustRequest {
  private String mode;
  private Integer qty;
  private Integer newStock;
  private Integer expectedStock;
  private String reason;
  private String note;
}
