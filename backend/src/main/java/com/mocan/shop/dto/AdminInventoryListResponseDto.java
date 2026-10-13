package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/**
 * Response danh sách tồn kho — GET /admin/inventory (admin-ton-kho.md §9).
 * Kèm `counts` cho thẻ tổng quan §2.2 + chips §3.1 (cùng 1 nguồn số liệu).
 * page: 1-indexed.
 */
@Data
public class AdminInventoryListResponseDto {
  private List<AdminInventoryItemDto> content;
  private long totalElements;
  private int totalPages;
  private int page;
  private int size;
  private AdminInventoryCountsDto counts;
}
