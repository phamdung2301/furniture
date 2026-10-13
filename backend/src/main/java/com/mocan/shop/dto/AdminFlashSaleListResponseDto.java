package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/**
 * Response danh sách chương trình flash sale admin — admin-flash-sale-shipping.md §8:
 * { items, total, page, size } với page 0-indexed (như AdminVoucherListResponseDto).
 */
@Data
public class AdminFlashSaleListResponseDto {
  private List<AdminFlashSaleDto> items;
  private long total;
  private int page;
  private int size;
}
