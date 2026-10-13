package com.mocan.shop.controller;

import com.mocan.shop.dto.AdminInventoryAdjustRequest;
import com.mocan.shop.dto.AdminInventoryListResponseDto;
import com.mocan.shop.dto.AdminInventoryThresholdRequest;
import com.mocan.shop.dto.AdminInventoryUpdateResponseDto;
import com.mocan.shop.service.AdminInventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Quản lý tồn kho (admin) — FR-023 · F-017 · US-015 (admin-ton-kho.md §9).
 * Contract khớp frontend/src/api/adminInventoryApi.js (api-contract-guard).
 * Toàn bộ /admin/** yêu cầu role ADMIN (SecurityConfig).
 * Lưu ý: GET /admin/inventory/low-stock (Dashboard §8) nằm ở
 * AdminStatsController từ màn 14 — giữ nguyên, không đụng.
 * Lỗi: 409 { code: "STOCK_CHANGED", currentStock } khi tồn vừa bị giao dịch
 * khác thay đổi · 422 khi vi phạm validate §5.4/§6.
 */
@RestController
@RequiredArgsConstructor
public class AdminInventoryController {

  private final AdminInventoryService adminInventoryService;

  /** Danh sách biến thể kèm counts (status: all|low|out; mặc định sort tồn tăng dần). */
  @GetMapping("/admin/inventory")
  public AdminInventoryListResponseDto list(
      @RequestParam(defaultValue = "all") String status,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(required = false) String categoryId,
      @RequestParam(defaultValue = "stock_asc") String sort,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int size) {
    return adminInventoryService.list(status, q, categoryId, sort, page, size);
  }

  /** Điều chỉnh tồn 3 chế độ: RECEIVE cộng · REMOVE trừ · SET đặt số mới. */
  @PostMapping("/admin/inventory/{variantId}/adjust")
  public AdminInventoryUpdateResponseDto adjust(
      @PathVariable String variantId, @RequestBody AdminInventoryAdjustRequest req) {
    return adminInventoryService.adjust(variantId, req);
  }

  /** Sửa ngưỡng cảnh báo sắp hết của 1 biến thể (số nguyên >= 0). */
  @PatchMapping("/admin/inventory/{variantId}/threshold")
  public AdminInventoryUpdateResponseDto updateThreshold(
      @PathVariable String variantId, @RequestBody AdminInventoryThresholdRequest req) {
    return adminInventoryService.updateThreshold(variantId, req);
  }
}
