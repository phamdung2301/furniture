package com.mocan.shop.controller;

import com.mocan.shop.dto.FlashSaleCurrentResponse;
import com.mocan.shop.service.FlashSaleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Flash sale phía khách — FR-028 / F-022 (spec flash-sale.md §9).
 * PUBLIC (GET, khai trong SecurityConfig): trả 1 chương trình hiện hành
 * theo ưu tiên đang diễn ra -> sắp diễn ra gần nhất -> null.
 * Contract khớp FE api/flashSaleApi.getCurrentFlashSale().
 */
@RestController
@RequiredArgsConstructor
public class FlashSaleController {

  private final FlashSaleService flashSaleService;

  @GetMapping("/flash-sale/current")
  public FlashSaleCurrentResponse current() {
    return flashSaleService.current();
  }
}
