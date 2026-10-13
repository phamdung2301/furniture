package com.mocan.shop.controller;

import com.mocan.shop.dto.AdminCustomerDetailDto;
import com.mocan.shop.dto.AdminCustomerListResponseDto;
import com.mocan.shop.dto.AdminCustomerLockRequest;
import com.mocan.shop.dto.AdminCustomerRowDto;
import com.mocan.shop.service.AdminCustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Quản lý khách hàng (admin) — FR-025 · F-019 (admin-khach-hang.md §7).
 * Contract khớp frontend/src/api/adminCustomerApi.js (api-contract-guard).
 * Toàn bộ /admin/** yêu cầu role ADMIN (SecurityConfig).
 * Chỉ user ROLE_CUSTOMER; KHÔNG có endpoint xóa khách (§4.6).
 * Lỗi: 404 khách không tồn tại / không phải CUSTOMER · 409 khóa tài khoản
 * đã bị khóa do admin / mở khóa tài khoản đang hoạt động.
 */
@RestController
@RequiredArgsConstructor
public class AdminCustomerController {

  private final AdminCustomerService adminCustomerService;

  /**
   * Danh sách: page 0-indexed, sort mặc định createdAt,desc.
   * `verified` là alias của `phoneVerified` (tên param phía FE).
   */
  @GetMapping("/admin/customers")
  public AdminCustomerListResponseDto list(
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) Boolean phoneVerified,
      @RequestParam(required = false) Boolean verified,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(defaultValue = "createdAt,desc") String sort) {
    Boolean verifiedFilter = phoneVerified != null ? phoneVerified : verified;
    return adminCustomerService.list(q, status, verifiedFilter, page, size, sort);
  }

  @GetMapping("/admin/customers/{id}")
  public AdminCustomerDetailDto get(@PathVariable String id) {
    return adminCustomerService.get(id);
  }

  /** Khóa tài khoản — body { reason? } → CustomerRow đã cập nhật. */
  @PatchMapping("/admin/customers/{id}/lock")
  public AdminCustomerRowDto lock(
      @PathVariable String id,
      @RequestBody(required = false) AdminCustomerLockRequest req,
      Authentication authentication) {
    // JWT subject = userId của admin (JwtUtil) — lưu vào User.lockedBy để tra soát.
    String lockedBy = authentication == null ? null : authentication.getName();
    return adminCustomerService.lock(id, req == null ? null : req.getReason(), lockedBy);
  }

  /** Mở khóa tài khoản — làm ngay, không cần body → CustomerRow đã cập nhật. */
  @PatchMapping("/admin/customers/{id}/unlock")
  public AdminCustomerRowDto unlock(@PathVariable String id) {
    return adminCustomerService.unlock(id);
  }
}
