package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Dòng wishlist kèm snapshot sản phẩm — F-013 / FR-018.
 * Contract khớp FE: { productId, addedAt, priceAtSave, product: { slug, name, image,
 * active, defaultPrice, defaultStock, badge } }.
 * defaultPrice = giá variant còn hàng rẻ nhất (F-004); defaultStock = tổng tồn các màu.
 * badge marketing: BÁN CHẠY / MỚI (null = không badge). Badge "Đã giảm giá" / "Hết hàng" /
 * "Ngừng kinh doanh" FE tự tính từ priceAtSave, defaultPrice, defaultStock, active.
 */
@Data
public class WishlistItemDto {
  private String productId;
  private Instant addedAt;
  private BigDecimal priceAtSave;
  private ProductSnapshotDto product;

  @Data
  public static class ProductSnapshotDto {
    private String slug;
    private String name;
    private String image;
    private boolean active;
    private BigDecimal defaultPrice;
    private int defaultStock;
    private BadgeDto badge;

    @Data
    public static class BadgeDto {
      private String type; // new | bestseller
      private String label; // MỚI | BÁN CHẠY
    }
  }
}
