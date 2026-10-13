package com.mocan.shop.service;

import com.mocan.shop.dto.CartDto;
import com.mocan.shop.dto.CartItemDto;
import com.mocan.shop.dto.MergeCartRequest;
import com.mocan.shop.dto.MergeCartResponse;
import com.mocan.shop.dto.ValidateCartRequest;
import com.mocan.shop.dto.ValidateCartResponse;
import com.mocan.shop.model.Cart;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.repository.CartRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Giỏ hàng — F-006 / FR-008.
 * Merge giỏ local vào giỏ server khi đăng nhập; tự prune item chết khi đọc giỏ;
 * validate public (không cần userId) trước khi checkout.
 */
@Service
@RequiredArgsConstructor
public class CartService {

  private static final int MAX_QTY = 99;

  private final CartRepository cartRepository;
  private final ProductVariantRepository variantRepository;
  private final ProductRepository productRepository;
  private final FlashSaleService flashSaleService;

  /** Gộp giỏ local (khách) vào giỏ server khi đăng nhập. */
  public MergeCartResponse merge(String userId, List<MergeCartRequest.MergeItem> localItems) {
    Cart cart = cartRepository.findByUserId(userId).orElseGet(() -> {
      Cart c = new Cart();
      c.setUserId(userId);
      c.setItems(new ArrayList<>());
      return c;
    });
    if (cart.getItems() == null) cart.setItems(new ArrayList<>());

    List<MergeCartResponse.SkippedItem> skipped = new ArrayList<>();
    int mergedCount = 0;

    for (MergeCartRequest.MergeItem local : localItems) {
      Optional<ProductVariant> variantOpt = variantRepository.findById(local.getVariantId());
      if (variantOpt.isEmpty()) {
        skipped.add(skip("not_found", local.getVariantId()));
        continue;
      }
      ProductVariant variant = variantOpt.get();
      Optional<Product> productOpt = productRepository.findById(variant.getProductId());
      if (productOpt.isEmpty() || !productOpt.get().isActive()) {
        skipped.add(skip("discontinued", local.getVariantId()));
        continue;
      }
      if (variant.getStock() <= 0) {
        skipped.add(skip("out_of_stock", local.getVariantId()));
        continue;
      }
      Cart.CartItem existing = cart.getItems().stream()
          .filter(i -> local.getVariantId().equals(i.getVariantId()))
          .findFirst()
          .orElse(null);
      int capped = Math.min(MAX_QTY, Math.min(variant.getStock(), Math.max(1, local.getQty())));
      // Gắn cờ flash sale theo chương trình đang diễn ra (flash-sale.md §5.2).
      String programId = flashSaleService.resolvePrice(variant).programId();
      if (existing != null) {
        existing.setQty(Math.min(MAX_QTY, Math.min(variant.getStock(), existing.getQty() + local.getQty())));
        existing.setFlashSaleProgramId(programId);
      } else {
        Cart.CartItem item = new Cart.CartItem();
        item.setVariantId(local.getVariantId());
        item.setQty(capped);
        item.setFlashSaleProgramId(programId);
        cart.getItems().add(item);
      }
      mergedCount++;
    }

    cart.setUpdatedAt(Instant.now());
    cartRepository.save(cart);

    MergeCartResponse res = new MergeCartResponse();
    res.setUserId(userId);
    res.setItems(enrich(cart.getItems()));
    res.setSubtotal(subtotal(res.getItems()));
    res.setMergedCount(mergedCount);
    res.setSkipped(skipped);
    return res;
  }

  /** Giỏ hiện tại của user; tự prune item chết (variant mất / SP ngừng bán / hết hàng). */
  public CartDto getCart(String userId) {
    Cart cart = cartRepository.findByUserId(userId).orElseGet(() -> {
      Cart c = new Cart();
      c.setUserId(userId);
      c.setItems(new ArrayList<>());
      return c;
    });
    if (cart.getItems() == null) cart.setItems(new ArrayList<>());

    int before = cart.getItems().size();
    List<Cart.CartItem> alive = new ArrayList<>();
    for (Cart.CartItem item : cart.getItems()) {
      Optional<ProductVariant> variantOpt = variantRepository.findById(item.getVariantId());
      if (variantOpt.isEmpty()) continue;
      ProductVariant variant = variantOpt.get();
      Optional<Product> productOpt = productRepository.findById(variant.getProductId());
      if (productOpt.isEmpty() || !productOpt.get().isActive() || variant.getStock() <= 0) continue;
      alive.add(item);
    }
    if (alive.size() != before) {
      cart.setItems(alive);
      cart.setUpdatedAt(Instant.now());
      cartRepository.save(cart);
    }

    CartDto dto = new CartDto();
    dto.setUserId(userId);
    dto.setItems(enrich(cart.getItems()));
    dto.setSubtotal(subtotal(dto.getItems()));
    return dto;
  }

  /** Validate tồn kho/giá cho giỏ — public, không cần userId. */
  public ValidateCartResponse validate(List<ValidateCartRequest.ValidateItem> items) {
    List<ValidateCartResponse.ValidateResult> results = new ArrayList<>();
    for (ValidateCartRequest.ValidateItem item : items) {
      ValidateCartResponse.ValidateResult r = new ValidateCartResponse.ValidateResult();
      r.setVariantId(item.getVariantId());
      Optional<ProductVariant> variantOpt = variantRepository.findById(item.getVariantId());
      if (variantOpt.isEmpty()) {
        r.setExists(false);
        r.setActive(false);
        r.setStock(0);
        r.setCurrentPrice(null);
        results.add(r);
        continue;
      }
      ProductVariant variant = variantOpt.get();
      Product product = productRepository.findById(variant.getProductId()).orElse(null);
      r.setExists(true);
      r.setActive(product != null && product.isActive());
      r.setStock(variant.getStock());
      // Giá hiệu lực = giá flash nếu đang trong chương trình + còn suất (flash-sale.md §5.4):
      // hết hạn/hết suất -> trả giá thường để FE hiện cảnh báo đổi giá (pattern F-005).
      r.setCurrentPrice(flashSaleService.resolvePrice(variant).price());
      r.setProductId(variant.getProductId());
      r.setProductName(product != null ? product.getName() : null);
      r.setColor(variant.getColor());
      r.setColorHex(variant.getColorHex());
      r.setImage(firstImage(product));
      results.add(r);
    }
    ValidateCartResponse res = new ValidateCartResponse();
    res.setResults(results);
    return res;
  }

  private MergeCartResponse.SkippedItem skip(String reason, String variantId) {
    MergeCartResponse.SkippedItem s = new MergeCartResponse.SkippedItem();
    s.setVariantId(variantId);
    s.setReason(reason);
    return s;
  }

  /** Làm giàu dòng giỏ với thông tin hiển thị từ variant + product. */
  private List<CartItemDto> enrich(List<Cart.CartItem> items) {
    List<CartItemDto> out = new ArrayList<>();
    for (Cart.CartItem item : items) {
      ProductVariant variant = variantRepository.findById(item.getVariantId())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
              "Không tìm thấy biến thể: " + item.getVariantId()));
      Product product = productRepository.findById(variant.getProductId())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
              "Không tìm thấy sản phẩm: " + variant.getProductId()));
      // Giá dòng giỏ = giá flash khi variant thuộc chương trình đang diễn ra + còn suất
      // (flash-sale.md §5.2) — backend resolve, FE không tự tính.
      FlashSaleService.ResolvedPrice resolved = flashSaleService.resolvePrice(variant);
      CartItemDto dto = new CartItemDto();
      dto.setVariantId(variant.getId());
      dto.setProductId(variant.getProductId());
      dto.setProductName(product.getName());
      dto.setColor(variant.getColor());
      dto.setColorHex(variant.getColorHex());
      dto.setPrice(resolved.price());
      dto.setFlashSaleProgramId(resolved.programId());
      dto.setImage(firstImage(product));
      dto.setStock(variant.getStock());
      dto.setQty(item.getQty());
      out.add(dto);
    }
    return out;
  }

  private String firstImage(Product product) {
    if (product == null || product.getImages() == null || product.getImages().isEmpty()) return null;
    return product.getImages().get(0).getUrl();
  }

  private BigDecimal subtotal(List<CartItemDto> items) {
    BigDecimal sum = BigDecimal.ZERO;
    for (CartItemDto i : items) {
      if (i.getPrice() != null) sum = sum.add(i.getPrice().multiply(BigDecimal.valueOf(i.getQty())));
    }
    return sum;
  }
}
