package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * Response danh sách đơn admin — GET /admin/orders (admin-don-hang.md §7).
 * Kèm `statusCounts` cho hàng tab trạng thái (§2.1): đếm theo các bộ lọc
 * còn lại (tìm kiếm/ngày/phương thức), BỎ QUA chính bộ lọc trạng thái.
 * Keys: ALL, MOI, DA_XAC_NHAN, DANG_GIAO, HOAN_THANH, DA_HUY, HOAN_TRA.
 */
@Data
public class AdminOrderListResponseDto {
  private List<AdminOrderListItemDto> content;
  private long totalElements;
  private int totalPages;
  private int page;
  private int size;
  private Map<String, Long> statusCounts;
}
