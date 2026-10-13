package com.mocan.shop.controller;

import com.mocan.shop.dto.AdminCategoryDetailDto;
import com.mocan.shop.dto.AdminCategoryDto;
import com.mocan.shop.dto.AdminCategoryMoveItemDto;
import com.mocan.shop.dto.AdminCategoryMoveRequest;
import com.mocan.shop.dto.AdminCategoryPatchRequest;
import com.mocan.shop.dto.AdminCategoryRequest;
import com.mocan.shop.service.AdminCategoryService;
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
 * Quản lý danh mục (admin) — FR-021 · F-015 (admin-danh-muc.md §7).
 * Contract khớp frontend/src/api/adminCategoryApi.js (api-contract-guard).
 * Toàn bộ /admin/** yêu cầu role ADMIN (SecurityConfig).
 * Endpoint này chính thức hoá GET /admin/categories mà màn 15 đang dùng cho
 * dropdown — shape giữ tương thích (id, name, parentId).
 * Lỗi nghiệp vụ: 409 { field: "slug" } trùng slug · 409 { code: "HAS_CHILDREN",
 * childCount } / { code: "HAS_PRODUCTS", productCount } khi xóa ·
 * 422 vi phạm cây 2 cấp.
 */
@RestController
@RequiredArgsConstructor
public class AdminCategoryController {

  private final AdminCategoryService adminCategoryService;

  @GetMapping("/admin/categories")
  public List<AdminCategoryDto> list() {
    return adminCategoryService.list();
  }

  @GetMapping("/admin/categories/{id}")
  public AdminCategoryDetailDto get(@PathVariable String id) {
    return adminCategoryService.get(id);
  }

  @PostMapping("/admin/categories")
  @ResponseStatus(HttpStatus.CREATED)
  public AdminCategoryDetailDto create(@RequestBody AdminCategoryRequest req) {
    return adminCategoryService.create(req);
  }

  @PutMapping("/admin/categories/{id}")
  public AdminCategoryDetailDto update(
      @PathVariable String id, @RequestBody AdminCategoryRequest req) {
    return adminCategoryService.update(id, req);
  }

  @DeleteMapping("/admin/categories/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    adminCategoryService.delete(id);
    return ResponseEntity.noContent().build();
  }

  @PatchMapping("/admin/categories/{id}")
  public AdminCategoryDto patch(
      @PathVariable String id, @RequestBody AdminCategoryPatchRequest req) {
    return adminCategoryService.patch(id, req);
  }

  @PatchMapping("/admin/categories/{id}/move")
  public List<AdminCategoryMoveItemDto> move(
      @PathVariable String id, @RequestBody AdminCategoryMoveRequest req) {
    return adminCategoryService.move(id, req);
  }

  @PostMapping(value = "/admin/categories/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public Map<String, String> uploadImage(@RequestParam("file") MultipartFile file) {
    return adminCategoryService.uploadImage(file);
  }
}
