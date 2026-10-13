package com.mocan.shop.controller;

import com.mocan.shop.dto.AdminShippingConfigDto;
import com.mocan.shop.dto.AdminShippingRuleRequest;
import com.mocan.shop.dto.AdminShippingConfigRequest;
import com.mocan.shop.dto.AdminShippingPreviewRequest;
import com.mocan.shop.dto.AdminShippingPreviewResponseDto;
import com.mocan.shop.dto.AdminShippingRuleDto;
import com.mocan.shop.dto.AdminShippingRulesResponseDto;
import com.mocan.shop.service.AdminShippingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Quản lý phí vận chuyển (admin) — FR-029 · F-023 · US-021
 * (admin-flash-sale-shipping.md §5, §8).
 * Contract khớp frontend/src/api/adminPromoApi.js (api-contract-guard).
 * TẤT CẢ endpoint nằm dưới /admin/** (role ADMIN trong SecurityConfig) —
 * TUYỆT ĐỐI không đặt CRUD dưới /shipping/**: ở đó có matcher public
 * POST /shipping/quote phải đứng trước matcher ADMIN (bẫy thứ tự màn 7).
 * Lỗi: 422 { code: "VALIDATION_ERROR", field?, message } chồng lấp bậc /
 * max <= min / 2 bậc "trở lên" (§5.2.1) · 404 bậc phí không tồn tại.
 */
@RestController
@RequiredArgsConstructor
public class AdminShippingController {

  private final AdminShippingService adminShippingService;

  /** GET -> { rules (sort minAreaM2 asc), config: { freeThreshold, maxAreaM2 } }. */
  @GetMapping("/admin/shipping-rules")
  public AdminShippingRulesResponseDto list() {
    return adminShippingService.list();
  }

  @PostMapping("/admin/shipping-rules")
  @ResponseStatus(HttpStatus.CREATED)
  public AdminShippingRuleDto create(@RequestBody AdminShippingRuleRequest req) {
    return adminShippingService.create(req);
  }

  /** PUT — sửa bậc, gồm cả bật/tắt qua field active (không có PATCH riêng). */
  @PutMapping("/admin/shipping-rules/{id}")
  public AdminShippingRuleDto update(
      @PathVariable String id, @RequestBody AdminShippingRuleRequest req) {
    return adminShippingService.update(id, req);
  }

  @DeleteMapping("/admin/shipping-rules/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    adminShippingService.delete(id);
    return ResponseEntity.noContent().build();
  }

  /** Thử tính phí — dùng lại logic ShippingService qua AdminShippingService (§5.4). */
  @PostMapping("/admin/shipping-rules/preview")
  public AdminShippingPreviewResponseDto preview(@RequestBody AdminShippingPreviewRequest req) {
    return adminShippingService.preview(req);
  }

  @GetMapping("/admin/shipping-config")
  public AdminShippingConfigDto getConfig() {
    return adminShippingService.getConfig();
  }

  /** Ngưỡng miễn phí: lưu vào ShippingConfig (key=SHIPPING) — §5.3, §10.3. */
  @PutMapping("/admin/shipping-config")
  public AdminShippingConfigDto updateConfig(@RequestBody AdminShippingConfigRequest req) {
    return adminShippingService.updateConfig(req);
  }
}
