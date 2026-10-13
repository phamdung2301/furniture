package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/**
 * Response danh sách voucher admin — admin-voucher.md §6:
 * { items, total, page, size } với page 0-indexed (đúng contract spec của
 * màn này; khác PageResponseDto 1-indexed của các màn khách hàng).
 */
@Data
public class AdminVoucherListResponseDto {
  private List<AdminVoucherDto> items;
  private long total;
  private int page;
  private int size;
}
