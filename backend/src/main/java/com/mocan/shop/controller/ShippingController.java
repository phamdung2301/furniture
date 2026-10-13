package com.mocan.shop.controller;

import com.mocan.shop.dto.ShippingQuoteRequest;
import com.mocan.shop.dto.ShippingQuoteResponse;
import com.mocan.shop.service.ShippingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Báo giá phí ship — F-023 / FR-029.
 * POST /shipping/quote là PUBLIC (FE cần báo giá từ giỏ trước khi login);
 * các endpoint /shipping/** khác vẫn giữ hasRole ADMIN (SecurityConfig).
 */
@RestController
@RequiredArgsConstructor
public class ShippingController {

  private final ShippingService shippingService;

  @PostMapping("/shipping/quote")
  public ShippingQuoteResponse quote(@RequestBody ShippingQuoteRequest request) {
    List<ShippingQuoteRequest.QuoteItem> items =
        request.getItems() != null ? request.getItems() : List.of();
    return shippingService.quote(items);
  }
}
