package com.mocan.shop.controller;

import com.mocan.shop.dto.CartDto;
import com.mocan.shop.dto.MergeCartRequest;
import com.mocan.shop.dto.MergeCartResponse;
import com.mocan.shop.dto.ValidateCartRequest;
import com.mocan.shop.dto.ValidateCartResponse;
import com.mocan.shop.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Giỏ hàng — F-006 / FR-008.
 * Contract khớp FE: POST /cart/merge {items:[{variantId,qty}]}, GET /cart,
 * POST /cart/validate {items:[{variantId,qty,price}]}.
 * userId = JWT subject (SecurityContextHolder) — xem JwtAuthFilter.
 */
@RestController
@RequiredArgsConstructor
public class CartController {

  private final CartService cartService;

  @PostMapping("/cart/merge")
  public MergeCartResponse merge(@RequestBody MergeCartRequest request) {
    String userId = SecurityContextHolder.getContext().getAuthentication().getName();
    List<MergeCartRequest.MergeItem> items = request.getItems() != null ? request.getItems() : List.of();
    return cartService.merge(userId, items);
  }

  @GetMapping("/cart")
  public CartDto getCart() {
    String userId = SecurityContextHolder.getContext().getAuthentication().getName();
    return cartService.getCart(userId);
  }

  @PostMapping("/cart/validate")
  public ValidateCartResponse validate(@RequestBody ValidateCartRequest request) {
    List<ValidateCartRequest.ValidateItem> items = request.getItems() != null ? request.getItems() : List.of();
    return cartService.validate(items);
  }
}
