package com.mocan.shop.controller;

import com.mocan.shop.dto.ProductDetailDto;
import com.mocan.shop.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Chi tiết sản phẩm — F-004 / FR-005 / FR-006.
 * Contract khớp frontend/src/api/productApi.getProduct().
 */
@RestController
@RequiredArgsConstructor
public class ProductController {

  private final ProductService productService;

  @GetMapping("/products/{slug}")
  public ProductDetailDto getBySlug(@PathVariable String slug) {
    return productService.getBySlug(slug);
  }
}
