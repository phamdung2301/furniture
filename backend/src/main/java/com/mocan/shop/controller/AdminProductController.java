package com.mocan.shop.controller;

import com.mocan.shop.dto.AdminProductDetailDto;
import com.mocan.shop.dto.AdminProductListItemDto;
import com.mocan.shop.dto.AdminProductPatchRequest;
import com.mocan.shop.dto.AdminProductRequest;
import com.mocan.shop.dto.PageResponseDto;
import com.mocan.shop.service.AdminProductService;
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
 * Quản lý sản phẩm (admin) — FR-020 · F-014 · US-013 (admin-san-pham.md §6).
 * Contract khớp frontend/src/api/adminProductApi.js (api-contract-guard).
 * Toàn bộ /admin/** yêu cầu role ADMIN (SecurityConfig); page 1-indexed.
 * Lỗi nghiệp vụ: 409 { code, field, message } trùng slug/SKU / xóa màu đã có đơn /
 * HAS_ORDERS khi xóa; 422 { code, message } vi phạm rule F-014.
 */
@RestController
@RequiredArgsConstructor
public class AdminProductController {

  private final AdminProductService adminProductService;

  @GetMapping("/admin/products")
  public PageResponseDto<AdminProductListItemDto> list(
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String categoryId,
      @RequestParam(required = false) Boolean active,
      @RequestParam(defaultValue = "newest") String sort,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int size) {
    return adminProductService.list(q, categoryId, active, sort, page, size);
  }

  @GetMapping("/admin/products/{id}")
  public AdminProductDetailDto get(@PathVariable String id) {
    return adminProductService.get(id);
  }

  @PostMapping("/admin/products")
  @ResponseStatus(HttpStatus.CREATED)
  public AdminProductDetailDto create(@RequestBody AdminProductRequest req) {
    return adminProductService.create(req);
  }

  @PutMapping("/admin/products/{id}")
  public AdminProductDetailDto update(
      @PathVariable String id, @RequestBody AdminProductRequest req) {
    return adminProductService.update(id, req);
  }

  @DeleteMapping("/admin/products/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    adminProductService.delete(id);
    return ResponseEntity.noContent().build();
  }

  @PatchMapping("/admin/products/{id}")
  public AdminProductListItemDto patch(
      @PathVariable String id, @RequestBody AdminProductPatchRequest req) {
    return adminProductService.patch(id, req);
  }

  @PostMapping(value = "/admin/products/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public List<Map<String, String>> uploadImages(@RequestParam("files") List<MultipartFile> files) {
    return adminProductService.uploadImages(files);
  }
}
