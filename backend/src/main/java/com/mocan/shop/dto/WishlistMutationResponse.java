package com.mocan.shop.dto;

import lombok.Data;

/** Response POST /wishlist — contract { item }. */
@Data
public class WishlistMutationResponse {
  private WishlistItemDto item;
}
