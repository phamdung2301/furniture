package com.mocan.shop.service;

import com.mocan.shop.dto.FacetsDto;
import com.mocan.shop.dto.PageResponseDto;
import com.mocan.shop.dto.ProductWithVariantsDto;
import com.mocan.shop.model.Category;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.repository.CategoryRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Logic catalog — F-002 / FR-002 / FR-003.
 *
 * Ghi chú kiến trúc: filter áp trên service-layer sau khi nạp products + variants
 * của danh mục (đủ nhanh ở phase 1: ~10k sản phẩm). Khi scale, chuyển sang
 * MongoDB aggregation pipeline với $lookup variants.
 */
@Service
@RequiredArgsConstructor
public class CatalogService {

  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;
  private final CategoryRepository categoryRepository;
  private final FlashSaleService flashSaleService;

  /** "Giá từ" = min giá màu còn hàng (F-002 business rule, mirror FE getCardInfo). */
  static BigDecimal cardPrice(Product p, List<ProductVariant> variants) {
    List<BigDecimal> inStock = variants.stream()
        .filter(v -> v.getStock() > 0)
        .map(ProductVariant::getPrice)
        .filter(Objects::nonNull)
        .toList();
    List<BigDecimal> priced = inStock.isEmpty()
        ? variants.stream().map(ProductVariant::getPrice).filter(Objects::nonNull).toList()
        : inStock;
    return priced.stream().min(BigDecimal::compareTo).orElse(p.getBasePrice());
  }

  static boolean outOfStock(List<ProductVariant> variants) {
    return !variants.isEmpty() && variants.stream().noneMatch(v -> v.getStock() > 0);
  }

  private static String norm(String s) {
    if (s == null) return "";
    return Normalizer.normalize(s.toLowerCase(), Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "");
  }

  private static boolean inSizeBucket(BigDecimal lengthM, String bucket) {
    if (lengthM == null) return false;
    double l = lengthM.doubleValue();
    return switch (bucket) {
      case "nho" -> l < 1;
      case "vua" -> l >= 1 && l <= 2;
      case "lon" -> l > 2;
      default -> false;
    };
  }

  private Map<String, List<ProductVariant>> variantsByProduct(List<String> productIds) {
    if (productIds.isEmpty()) return Map.of();
    return variantRepository.findByProductIdIn(productIds).stream()
        .collect(Collectors.groupingBy(ProductVariant::getProductId));
  }

  public PageResponseDto<ProductWithVariantsDto> getProducts(
      String categorySlug,
      int page, int size,
      BigDecimal priceMin, BigDecimal priceMax,
      List<String> colors, List<String> materials, List<String> sizes,
      String sort, boolean inStock) {

    String categoryId = null;
    if (categorySlug != null && !categorySlug.isBlank() && !"all".equals(categorySlug)) {
      categoryId = categoryRepository.findBySlug(categorySlug)
          .map(Category::getId).orElse(null);
      // slug lạ → coi như không lọc danh mục (FE hiện "Tất cả sản phẩm")
    }

    List<Product> products = categoryId != null
        ? productRepository.findByCategoryIdAndActiveTrue(categoryId)
        : productRepository.findByActiveTrue();

    Map<String, List<ProductVariant>> byProduct = variantsByProduct(
        products.stream().map(Product::getId).toList());

    List<Product> filtered = products.stream()
        .filter(p -> {
          List<ProductVariant> vs = byProduct.getOrDefault(p.getId(), List.of());
          if (inStock && outOfStock(vs)) return false;
          BigDecimal price = cardPrice(p, vs);
          if (priceMin != null && price.compareTo(priceMin) < 0) return false;
          if (priceMax != null && price.compareTo(priceMax) > 0) return false;
          if (colors != null && !colors.isEmpty()
              && vs.stream().noneMatch(v -> colors.contains(v.getColor()) && v.getStock() > 0))
            return false;
          if (materials != null && !materials.isEmpty()) {
            String have = norm(p.getSpecs() != null ? p.getSpecs().getOrDefault("Chất liệu", "") : "")
                + " " + norm(vs.stream().map(v -> v.getMaterialNote() == null ? "" : v.getMaterialNote())
                    .collect(Collectors.joining(" ")));
            if (materials.stream().map(CatalogService::norm).noneMatch(have::contains)) return false;
          }
          if (sizes != null && !sizes.isEmpty()
              && vs.stream().noneMatch(v -> sizes.stream().anyMatch(b -> inSizeBucket(v.getLengthM(), b))))
            return false;
          return true;
        })
        .collect(Collectors.toCollection(ArrayList::new));

    Comparator<Product> cmp = switch (sort != null ? sort : "popular") {
      case "price_asc" -> Comparator.comparing(p -> cardPrice(p, byProduct.getOrDefault(p.getId(), List.of())));
      case "price_desc" -> Comparator.<Product, BigDecimal>comparing(
          p -> cardPrice(p, byProduct.getOrDefault(p.getId(), List.of()))).reversed();
      case "newest" -> Comparator.comparing(Product::getCreatedAt,
          Comparator.nullsLast(Comparator.naturalOrder())).reversed();
      default -> Comparator.comparingInt(Product::getSoldCount).reversed();
    };
    filtered.sort(cmp);

    int safePage = Math.max(1, page);
    int safeSize = size > 0 ? size : 24;
    int total = filtered.size();
    int from = Math.min((safePage - 1) * safeSize, total);
    int to = Math.min(from + safeSize, total);

    List<ProductWithVariantsDto> content = filtered.subList(from, to).stream()
        .map(p -> ProductWithVariantsDto.of(p, byProduct.getOrDefault(p.getId(), List.of())))
        .toList();
    flashSaleService.attachToProductDtos(content);

    return PageResponseDto.of(content, total, safePage, safeSize);
  }

  public FacetsDto getFacets(String categorySlug) {
    String categoryId = null;
    if (categorySlug != null && !categorySlug.isBlank() && !"all".equals(categorySlug)) {
      categoryId = categoryRepository.findBySlug(categorySlug)
          .map(Category::getId).orElse(null);
    }
    List<Product> products = categoryId != null
        ? productRepository.findByCategoryIdAndActiveTrue(categoryId)
        : productRepository.findByActiveTrue();
    Map<String, List<ProductVariant>> byProduct = variantsByProduct(
        products.stream().map(Product::getId).toList());

    Map<String, FacetsDto.ColorOption> colorMap = new LinkedHashMap<>();
    Set<String> materials = new TreeSet<>();
    for (Product p : products) {
      List<ProductVariant> vs = byProduct.getOrDefault(p.getId(), List.of());
      for (ProductVariant v : vs) {
        if (v.getColor() == null) continue;
        FacetsDto.ColorOption opt = colorMap.computeIfAbsent(v.getColor(), k -> {
          FacetsDto.ColorOption o = new FacetsDto.ColorOption();
          o.setName(k);
          return o;
        });
        if (opt.getColorHex() == null) opt.setColorHex(v.getColorHex());
        if (v.getStock() > 0) opt.setInStock(true);
      }
      if (p.getSpecs() != null && p.getSpecs().get("Chất liệu") != null) {
        materials.add(p.getSpecs().get("Chất liệu"));
      }
    }
    FacetsDto dto = new FacetsDto();
    dto.setColors(new ArrayList<>(colorMap.values()));
    dto.setMaterials(new ArrayList<>(materials));
    return dto;
  }

  public Category getCategoryBySlug(String slug) {
    return categoryRepository.findBySlug(slug).orElse(null);
  }
}
