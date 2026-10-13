package com.mocan.shop.service;

import com.mocan.shop.dto.MergeWishlistRequest;
import com.mocan.shop.dto.MergeWishlistResponse;
import com.mocan.shop.dto.WishlistItemDto;
import com.mocan.shop.dto.WishlistMutationResponse;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.model.Wishlist;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import com.mocan.shop.repository.WishlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Wishlist — F-013 / FR-018.
 * 1 cặp (user, product) duy nhất: thêm trùng idempotent (409, FE coi như đã lưu),
 * guard DuplicateKeyException cho race condition (giống ReviewService).
 * Sản phẩm ngừng bán (active=false) VẪN giữ trong wishlist kèm nhãn — F-013,
 * nên list() không prune item chết (khác giỏ hàng).
 */
@Service
@RequiredArgsConstructor
public class WishlistService {

  /** Badge MỚI cho sản phẩm tạo trong N ngày gần nhất. */
  private static final int NEW_PRODUCT_DAYS = 30;

  private final WishlistRepository wishlistRepository;
  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;

  /**
   * Thêm vào wishlist. Trùng → trả item hiện có, duplicate=true để controller trả 409.
   * Race condition double-click: bắt DuplicateKeyException từ unique index.
   */
  public AddResult add(String userId, String productId, BigDecimal priceAtSave) {
    Product product = productRepository.findById(productId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm"));

    Optional<Wishlist> existing = wishlistRepository.findByUserIdAndProductId(userId, productId);
    if (existing.isPresent()) {
      return new AddResult(toDto(existing.get(), product), true);
    }
    Wishlist item = new Wishlist();
    item.setUserId(userId);
    item.setProductId(productId);
    item.setPriceAtSave(priceAtSave);
    item.setCreatedAt(Instant.now());
    try {
      item = wishlistRepository.save(item);
    } catch (DuplicateKeyException e) {
      // Race: một request song song vừa chèn xong → trả item hiện có.
      Wishlist raced = wishlistRepository.findByUserIdAndProductId(userId, productId)
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Sản phẩm đã có trong danh sách yêu thích"));
      return new AddResult(toDto(raced, product), true);
    }
    return new AddResult(toDto(item, product), false);
  }

  /** Xóa khỏi wishlist — idempotent, không lỗi khi item không tồn tại. */
  public void remove(String userId, String productId) {
    wishlistRepository.deleteByUserIdAndProductId(userId, productId);
  }

  /** Wishlist của user kèm snapshot sản phẩm (mới nhất trước). */
  public List<WishlistItemDto> list(String userId) {
    List<Wishlist> items = wishlistRepository.findByUserIdOrderByCreatedAtDesc(userId);
    if (items.isEmpty()) return List.of();

    List<String> productIds = items.stream().map(Wishlist::getProductId).distinct().toList();
    Map<String, Product> products = productRepository.findAllById(productIds).stream()
        .collect(Collectors.toMap(Product::getId, p -> p));
    Map<String, List<ProductVariant>> variants = variantRepository.findByProductIdIn(productIds).stream()
        .collect(Collectors.groupingBy(ProductVariant::getProductId));

    List<WishlistItemDto> out = new ArrayList<>();
    for (Wishlist item : items) {
      Product product = products.get(item.getProductId());
      out.add(toDto(item, product, variants.getOrDefault(item.getProductId(), List.of())));
    }
    return out;
  }

  /**
   * Gộp wishlist local (guest) vào server khi đăng nhập — union theo productId.
   * Item đã có: giữ addedAt sớm nhất, dùng priceAtSave của bản local.
   * Item trùng trong list local: giữ bản addedAt sớm nhất.
   * Sản phẩm không tồn tại trên DB thì bỏ qua.
   */
  public MergeWishlistResponse merge(String userId, List<MergeWishlistRequest.MergeItem> localItems) {
    Map<String, MergeWishlistRequest.MergeItem> deduped = new HashMap<>();
    for (MergeWishlistRequest.MergeItem local : localItems) {
      if (local.getProductId() == null || local.getProductId().isBlank()) continue;
      MergeWishlistRequest.MergeItem prev = deduped.get(local.getProductId());
      if (prev == null || earlier(local.getAddedAt(), prev.getAddedAt())) {
        deduped.put(local.getProductId(), local);
      }
    }

    int merged = 0;
    for (MergeWishlistRequest.MergeItem local : deduped.values()) {
      if (!productRepository.existsById(local.getProductId())) continue;
      Instant addedAt = local.getAddedAt() != null ? local.getAddedAt() : Instant.now();
      Optional<Wishlist> existing = wishlistRepository.findByUserIdAndProductId(userId, local.getProductId());
      if (existing.isPresent()) {
        Wishlist e = existing.get();
        boolean touched = false;
        if (earlier(addedAt, e.getCreatedAt())) {
          e.setCreatedAt(addedAt);
          touched = true;
        }
        if (local.getPriceAtSave() != null) {
          e.setPriceAtSave(local.getPriceAtSave());
          touched = true;
        }
        if (touched) wishlistRepository.save(e);
        continue;
      }
      Wishlist item = new Wishlist();
      item.setUserId(userId);
      item.setProductId(local.getProductId());
      item.setPriceAtSave(local.getPriceAtSave());
      item.setCreatedAt(addedAt);
      try {
        wishlistRepository.save(item);
        merged++;
      } catch (DuplicateKeyException e) {
        // Race: request song song đã chèn — coi như đã gộp.
      }
    }

    MergeWishlistResponse res = new MergeWishlistResponse();
    res.setMerged(merged);
    return res;
  }

  private boolean earlier(Instant a, Instant b) {
    if (a == null) return false;
    if (b == null) return true;
    return a.isBefore(b);
  }

  private WishlistItemDto toDto(Wishlist item, Product product) {
    return toDto(item, product,
        product == null ? List.of() : variantRepository.findByProductId(product.getId()));
  }

  private WishlistItemDto toDto(Wishlist item, Product product, List<ProductVariant> variants) {
    WishlistItemDto dto = new WishlistItemDto();
    dto.setProductId(item.getProductId());
    dto.setAddedAt(item.getCreatedAt());
    dto.setPriceAtSave(item.getPriceAtSave());
    if (product != null) {
      dto.setProduct(snapshot(product, variants));
    }
    return dto;
  }

  private WishlistItemDto.ProductSnapshotDto snapshot(Product product, List<ProductVariant> variants) {
    WishlistItemDto.ProductSnapshotDto s = new WishlistItemDto.ProductSnapshotDto();
    s.setSlug(product.getSlug());
    s.setName(product.getName());
    s.setImage(firstImage(product));
    s.setActive(product.isActive());
    s.setDefaultPrice(defaultPrice(variants));
    s.setDefaultStock(variants.stream().mapToInt(ProductVariant::getStock).sum());
    s.setBadge(badge(product));
    return s;
  }

  /**
   * Giá hiển thị F-004: giá variant còn hàng rẻ nhất; không variant nào còn hàng
   * thì lấy giá rẻ nhất toàn bộ (để card vẫn render giá cho món hết hàng);
   * không có variant → null.
   */
  private BigDecimal defaultPrice(List<ProductVariant> variants) {
    List<ProductVariant> inStock = variants.stream()
        .filter(v -> v.getStock() > 0 && v.getPrice() != null)
        .toList();
    List<ProductVariant> pool = !inStock.isEmpty() ? inStock
        : variants.stream().filter(v -> v.getPrice() != null).toList();
    return pool.stream()
        .map(ProductVariant::getPrice)
        .min(Comparator.naturalOrder())
        .orElse(null);
  }

  private String firstImage(Product product) {
    if (product.getImages() == null || product.getImages().isEmpty()) return null;
    return product.getImages().get(0).getUrl();
  }

  /** Badge marketing: BÁN CHẠY (featured) ưu tiên trước MỚI (<30 ngày) — giống trang chủ. */
  private WishlistItemDto.ProductSnapshotDto.BadgeDto badge(Product product) {
    WishlistItemDto.ProductSnapshotDto.BadgeDto b = new WishlistItemDto.ProductSnapshotDto.BadgeDto();
    if (product.isFeatured()) {
      b.setType("bestseller");
      b.setLabel("BÁN CHẠY");
      return b;
    }
    if (product.getCreatedAt() != null
        && Duration.between(product.getCreatedAt(), Instant.now()).toDays() < NEW_PRODUCT_DAYS) {
      b.setType("new");
      b.setLabel("MỚI");
      return b;
    }
    return null;
  }

  /** Kết quả add: item + cờ duplicate (true → controller trả 409). */
  public record AddResult(WishlistItemDto item, boolean duplicate) {
  }

  /** Response helper cho controller: { item }. */
  public WishlistMutationResponse toMutationResponse(WishlistItemDto item) {
    WishlistMutationResponse res = new WishlistMutationResponse();
    res.setItem(item);
    return res;
  }
}
