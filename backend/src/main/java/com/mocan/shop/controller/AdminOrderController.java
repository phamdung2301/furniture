package com.mocan.shop.controller;

import com.mocan.shop.dto.AdminOrderDetailDto;
import com.mocan.shop.dto.AdminOrderListResponseDto;
import com.mocan.shop.dto.AdminOrderNoteRequest;
import com.mocan.shop.dto.AdminOrderStatusRequest;
import com.mocan.shop.service.AdminOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Quản lý đơn hàng (admin) — FR-022 · FR-012 · F-016 (admin-don-hang.md §7).
 * Contract khớp frontend/src/api/adminOrderApi.js (api-contract-guard).
 * Toàn bộ /admin/** yêu cầu role ADMIN (SecurityConfig).
 * Lỗi nghiệp vụ: 404 đơn không tồn tại · 422 { message, currentStatus } khi
 * chuyển trạng thái sai ma trận FR-012 / thiếu mã vận đơn / thiếu lý do /
 * quá hạn hoàn trả 7 ngày.
 */
@RestController
@RequiredArgsConstructor
public class AdminOrderController {

  private final AdminOrderService adminOrderService;

  @GetMapping("/admin/orders")
  public AdminOrderListResponseDto list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String paymentMethod,
      @RequestParam(required = false) String from,
      @RequestParam(required = false) String to,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String sort,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int size) {
    return adminOrderService.list(status, paymentMethod, from, to, q, sort, page, size);
  }

  @GetMapping("/admin/orders/{orderNumber}")
  public AdminOrderDetailDto get(@PathVariable String orderNumber) {
    return adminOrderService.get(orderNumber);
  }

  @PatchMapping("/admin/orders/{orderNumber}/status")
  public AdminOrderDetailDto updateStatus(
      @PathVariable String orderNumber, @RequestBody AdminOrderStatusRequest req) {
    return adminOrderService.updateStatus(orderNumber, req);
  }

  @PatchMapping("/admin/orders/{orderNumber}/admin-note")
  public AdminOrderDetailDto updateAdminNote(
      @PathVariable String orderNumber, @RequestBody AdminOrderNoteRequest req) {
    return adminOrderService.updateAdminNote(orderNumber, req);
  }

  @PatchMapping("/admin/orders/{orderNumber}/payment-confirm")
  public AdminOrderDetailDto confirmBankTransfer(@PathVariable String orderNumber) {
    return adminOrderService.confirmBankTransfer(orderNumber);
  }
}
