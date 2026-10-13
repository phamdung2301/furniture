package com.mocan.shop.controller;

import com.mocan.shop.dto.MergeWishlistRequest;
import com.mocan.shop.dto.MergeWishlistResponse;
import com.mocan.shop.dto.WishlistItemDto;
import com.mocan.shop.dto.WishlistMutationResponse;
import com.mocan.shop.service.WishlistService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Wishlist — F-013 / FR-018.
 * Contract khớp FE (spec wishlist §6):
 *   POST   /wishlist          {productId, priceAtSave} → 201 {item} (trùng → 409, FE coi như đã lưu)
 *   DELETE /wishlist/{productId}                      → 204
 *   GET    /wishlist                                   → [{productId, addedAt, priceAtSave, product}]
 *   POST   /wishlist/merge    {items:[{productId, priceAtSave, addedAt}]} → {merged: N}
 * userId = JWT subject (SecurityContextHolder) — xem JwtAuthFilter.
 */
@RestController
@RequiredArgsConstructor
public class WishlistController {

  private final WishlistService wishlistService;

  @PostMapping("/wishlist")
  public ResponseEntity<WishlistMutationResponse> add(@RequestBody AddWishlistRequest request) {
    String userId = SecurityContextHolder.getContext().getAuthentication().getName();
    WishlistService.AddResult result = wishlistService.add(
        userId, request.getProductId(), request.getPriceAtSave());
    return ResponseEntity
        .status(result.duplicate() ? HttpStatus.CONFLICT : HttpStatus.CREATED)
        .body(wishlistService.toMutationResponse(result.item()));
  }

  @DeleteMapping("/wishlist/{productId}")
  public ResponseEntity<Void> remove(@PathVariable String productId) {
    String userId = SecurityContextHolder.getContext().getAuthentication().getName();
    wishlistService.remove(userId, productId);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/wishlist")
  public List<WishlistItemDto> list() {
    String userId = SecurityContextHolder.getContext().getAuthentication().getName();
    return wishlistService.list(userId);
  }

  @PostMapping("/wishlist/merge")
  public MergeWishlistResponse merge(@RequestBody MergeWishlistRequest request) {
    String userId = SecurityContextHolder.getContext().getAuthentication().getName();
    List<MergeWishlistRequest.MergeItem> items = request.getItems() != null ? request.getItems() : List.of();
    return wishlistService.merge(userId, items);
  }

  /** Body POST /wishlist — spec §6. */
  @Data
  public static class AddWishlistRequest {
    private String productId;
    private BigDecimal priceAtSave;
  }
}
