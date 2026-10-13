package com.mocan.shop.controller;

import com.mocan.shop.dto.FacetsDto;
import com.mocan.shop.dto.PageResponseDto;
import com.mocan.shop.dto.ProductWithVariantsDto;
import com.mocan.shop.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Endpoints tìm kiếm — F-003 / FR-004 / US-003.
 * Contract khớp frontend/src/api/searchApi.js (path + params + response shape).
 * page: 1-indexed. sort: relevance (mặc định) | popular | price_asc | price_desc | newest.
 * q rỗng -> trả rỗng (F-003 edge case), không trả toàn bộ catalog.
 */
@RestController
@RequiredArgsConstructor
public class SearchController {

  private final SearchService searchService;

  @GetMapping("/products/search")
  public PageResponseDto<ProductWithVariantsDto> search(
      @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "24") int size,
      @RequestParam(required = false) BigDecimal priceMin,
      @RequestParam(required = false) BigDecimal priceMax,
      @RequestParam(required = false) List<String> colors,
      @RequestParam(required = false) List<String> materials,
      @RequestParam(required = false) List<String> sizes,
      @RequestParam(defaultValue = "relevance") String sort,
      @RequestParam(defaultValue = "false") boolean inStock) {
    // Spring tách "a,b" thành List tự động khi dùng @RequestParam List<String>
    return searchService.search(
        q, page, size, priceMin, priceMax,
        colors, materials, sizes, sort, inStock);
  }

  @GetMapping("/products/search/facets")
  public FacetsDto searchFacets(@RequestParam(required = false) String q) {
    return searchService.searchFacets(q);
  }
}
