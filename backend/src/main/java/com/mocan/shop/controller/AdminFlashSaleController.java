package com.mocan.shop.controller;

import com.mocan.shop.dto.AdminFlashSaleActiveRequest;
import com.mocan.shop.dto.AdminFlashSaleDto;
import com.mocan.shop.dto.AdminFlashSaleListResponseDto;
import com.mocan.shop.dto.AdminFlashSaleRequest;
import com.mocan.shop.service.AdminFlashSaleService;
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
 * Quản lý chương trình flash sale (admin) — FR-028 · F-022 · US-019
 * (admin-flash-sale-shipping.md §8).
 * Contract khớp frontend/src/api/adminPromoApi.js (api-contract-guard).
 * Toàn bộ /admin/** yêu cầu role ADMIN (SecurityConfig) — không thêm matcher
 * public nào cho khu vực này. Chỉ chương trình type=FLASH_SALE; voucher
 * thường thuộc AdminVoucherController (màn 19) và không bao giờ lọt vào đây.
 * Lỗi: 422 { code: "VALIDATION_ERROR", field?, message } vi phạm validate §3
 * (kèm case trùng lịch §3.2) · 409 khi xóa chương trình không thỏa §4.2 ·
 * 404 khi id không phải chương trình flash sale.
 */
@RestController
@RequiredArgsConstructor
public class AdminFlashSaleController {

  private final AdminFlashSaleService adminFlashSaleService;

  /** Danh sách: lọc q (theo tên)/status (suy ra §2.3) ở service, page 0-indexed, sort mặc định startAt,desc. */
  @GetMapping("/admin/flash-sales")
  public AdminFlashSaleListResponseDto list(
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(defaultValue = "startAt,desc") String sort) {
    return adminFlashSaleService.list(q, status, page, size, sort);
  }

  @GetMapping("/admin/flash-sales/{id}")
  public AdminFlashSaleDto get(@PathVariable String id) {
    return adminFlashSaleService.get(id);
  }

  /** Tạo: server tự sinh code FS-XXXXXX + gán type=FLASH_SALE -> 201. */
  @PostMapping("/admin/flash-sales")
  @ResponseStatus(HttpStatus.CREATED)
  public AdminFlashSaleDto create(@RequestBody AdminFlashSaleRequest req) {
    return adminFlashSaleService.create(req);
  }

  @PutMapping("/admin/flash-sales/{id}")
  public AdminFlashSaleDto update(@PathVariable String id, @RequestBody AdminFlashSaleRequest req) {
    return adminFlashSaleService.update(id, req);
  }

  /** Bật/tắt nhanh { active } -> tắt chương trình đang chạy có hiệu lực ngay phía khách. */
  @PatchMapping("/admin/flash-sales/{id}/active")
  public AdminFlashSaleDto patchActive(
      @PathVariable String id, @RequestBody AdminFlashSaleActiveRequest req) {
    return adminFlashSaleService.patchActive(id, req);
  }

  /** Xóa -> 204 · 409 khi đã chạy / đã có lượt bán (§4.2). */
  @DeleteMapping("/admin/flash-sales/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    adminFlashSaleService.delete(id);
    return ResponseEntity.noContent().build();
  }
}
