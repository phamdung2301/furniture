package com.mocan.shop.controller;

import com.mocan.shop.dto.FacetsDto;
import com.mocan.shop.dto.PageResponseDto;
import com.mocan.shop.dto.ProductWithVariantsDto;
import com.mocan.shop.model.Category;
import com.mocan.shop.service.CatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Endpoints catalog — F-002 / FR-002 / FR-003.
 * Contract khớp frontend/src/api/catalogApi.js (path + params + response shape).
 * page: 1-indexed. Mảng colors/materials/sizes: cách nhau dấu phẩy.
 */
@RestController
@RequiredArgsConstructor
public class CatalogController {

  private final CatalogService catalogService;

  @GetMapping("/products")
  public PageResponseDto<ProductWithVariantsDto> getProducts(
      @RequestParam(required = false) String categorySlug,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "24") int size,
      @RequestParam(required = false) BigDecimal priceMin,
      @RequestParam(required = false) BigDecimal priceMax,
      @RequestParam(required = false) List<String> colors,
      @RequestParam(required = false) List<String> materials,
      @RequestParam(required = false) List<String> sizes,
      @RequestParam(defaultValue = "popular") String sort,
      @RequestParam(defaultValue = "false") boolean inStock) {
    // Spring tách "a,b" thành List tự động khi dùng @RequestParam List<String>
    return catalogService.getProducts(
        categorySlug, page, size, priceMin, priceMax,
        colors, materials, sizes, sort, inStock);
  }

  @GetMapping("/products/facets")
  public FacetsDto getFacets(@RequestParam(required = false) String categorySlug) {
    return catalogService.getFacets(categorySlug);
  }

  @GetMapping("/categories/by-slug")
  public Category getCategoryBySlug(@RequestParam String slug) {
    return catalogService.getCategoryBySlug(slug);
  }
}
