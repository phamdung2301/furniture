package com.mocan.shop.controller;

import com.mocan.shop.dto.ProductWithVariantsDto;
import com.mocan.shop.model.Banner;
import com.mocan.shop.model.Category;
import com.mocan.shop.service.HomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * Endpoints trang chủ — F-001.
 * Contract khớp frontend/src/api/homeApi.js (path + method + response shape).
 */
@RestController
@RequiredArgsConstructor
public class HomeController {
  private final HomeService homeService;

  @GetMapping("/banners")
  public List<Banner> getBanners(@RequestParam(defaultValue = "true") boolean active) {
    return active ? homeService.getActiveBanners() : List.of();
  }

  @GetMapping("/categories/featured")
  public List<Category> getFeaturedCategories() {
    return homeService.getFeaturedCategories();
  }

  @GetMapping("/products/featured")
  public List<ProductWithVariantsDto> getFeaturedProducts() {
    return homeService.getFeaturedProducts();
  }

  @GetMapping("/products/best-sellers")
  public List<ProductWithVariantsDto> getBestSellers() {
    return homeService.getBestSellers();
  }

  @GetMapping("/products/newest")
  public List<ProductWithVariantsDto> getNewestProducts() {
    return homeService.getNewestProducts();
  }
}
