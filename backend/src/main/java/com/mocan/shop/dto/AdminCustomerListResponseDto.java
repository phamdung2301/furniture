package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/**
 * Response danh sách khách hàng admin — admin-khach-hang.md §7:
 * { items, total, page, size } với page 0-indexed (cùng convention
 * AdminVoucherListResponseDto của màn 19).
 */
@Data
public class AdminCustomerListResponseDto {
  private List<AdminCustomerRowDto> items;
  private long total;
  private int page;
  private int size;
}
