package com.mocan.shop.controller;

import com.mocan.shop.dto.AdminVoucherActiveRequest;
import com.mocan.shop.dto.AdminVoucherDto;
import com.mocan.shop.dto.AdminVoucherListResponseDto;
import com.mocan.shop.dto.AdminVoucherRequest;
import com.mocan.shop.service.AdminVoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Quản lý voucher (admin) — FR-024 · F-018 · US-017 (admin-voucher.md §6).
 * Contract khớp frontend/src/api/adminVoucherApi.js (api-contract-guard).
 * Toàn bộ /admin/** yêu cầu role ADMIN (SecurityConfig).
 * Chỉ voucher thường (PERCENT | FIXED) — FLASH_SALE thuộc màn 22, không bao
 * giờ trả qua các endpoint này; nhưng trùng `code` với flash sale vẫn 409
 * vì code unique toàn cục.
 * Lỗi: 409 { code: "CODE_EXISTS", field: "code" } trùng mã · 409 khi xóa
 * voucher đã có lượt dùng/đơn tham chiếu · 422 { field } vi phạm validate.
 */
@RestController
@RequiredArgsConstructor
public class AdminVoucherController {

  private final AdminVoucherService adminVoucherService;

  /** Danh sách: lọc q/status/discountType ở service, page 0-indexed, sort mặc định endAt,asc. */
  @GetMapping("/admin/vouchers")
  public AdminVoucherListResponseDto list(
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String discountType,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(defaultValue = "endAt,asc") String sort) {
    return adminVoucherService.list(q, status, discountType, page, size, sort);
  }

  @GetMapping("/admin/vouchers/{id}")
  public AdminVoucherDto get(@PathVariable String id) {
    return adminVoucherService.get(id);
  }

  @PostMapping("/admin/vouchers")
  @ResponseStatus(HttpStatus.CREATED)
  public AdminVoucherDto create(@RequestBody AdminVoucherRequest req) {
    return adminVoucherService.create(req);
  }

  @PutMapping("/admin/vouchers/{id}")
  public AdminVoucherDto update(@PathVariable String id, @RequestBody AdminVoucherRequest req) {
    return adminVoucherService.update(id, req);
  }

  @PatchMapping("/admin/vouchers/{id}/active")
  public AdminVoucherDto patchActive(
      @PathVariable String id, @RequestBody AdminVoucherActiveRequest req) {
    return adminVoucherService.patchActive(id, req);
  }

  @DeleteMapping("/admin/vouchers/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    adminVoucherService.delete(id);
    return ResponseEntity.noContent().build();
  }
}
