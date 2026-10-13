package com.mocan.shop.controller;

import com.mocan.shop.dto.AdminBannerDto;
import com.mocan.shop.dto.AdminBannerPatchRequest;
import com.mocan.shop.dto.AdminBannerReorderItemDto;
import com.mocan.shop.dto.AdminBannerReorderRequest;
import com.mocan.shop.dto.AdminBannerRequest;
import com.mocan.shop.service.AdminBannerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * Quản lý banner (admin) — FR-027 · F-021 (admin-banner.md §8).
 * Contract khớp frontend/src/api/adminBannerApi.js (api-contract-guard).
 * Toàn bộ /admin/** yêu cầu role ADMIN (SecurityConfig).
 * Endpoint public phía khách GET /banners (HomeController, chỉ banner
 * active theo sortOrder) giữ nguyên — không sửa ở controller này.
 * Banner không có startAt/endAt trong ERD/model — không nhận/trả 2 trường đó.
 * Lỗi validate: 400 { field, message } · 404 khi banner không tồn tại.
 */
@RestController
@RequiredArgsConstructor
public class AdminBannerController {

  private final AdminBannerService adminBannerService;

  @GetMapping("/admin/banners")
  public List<AdminBannerDto> list() {
    return adminBannerService.list();
  }

  @GetMapping("/admin/banners/{id}")
  public AdminBannerDto get(@PathVariable String id) {
    return adminBannerService.get(id);
  }

  @PostMapping("/admin/banners")
  @ResponseStatus(HttpStatus.CREATED)
  public AdminBannerDto create(@RequestBody AdminBannerRequest req) {
    return adminBannerService.create(req);
  }

  @PutMapping("/admin/banners/{id}")
  public AdminBannerDto update(@PathVariable String id, @RequestBody AdminBannerRequest req) {
    return adminBannerService.update(id, req);
  }

  @DeleteMapping("/admin/banners/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    adminBannerService.delete(id);
    return ResponseEntity.noContent().build();
  }

  @PatchMapping("/admin/banners/{id}")
  public AdminBannerDto patch(@PathVariable String id, @RequestBody AdminBannerPatchRequest req) {
    return adminBannerService.patch(id, req);
  }

  @PutMapping("/admin/banners/reorder")
  public List<AdminBannerReorderItemDto> reorder(@RequestBody AdminBannerReorderRequest req) {
    return adminBannerService.reorder(req);
  }

  @PostMapping(value = "/admin/banners/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public Map<String, String> uploadImage(@RequestParam("file") MultipartFile file) {
    return adminBannerService.uploadImage(file);
  }
}
