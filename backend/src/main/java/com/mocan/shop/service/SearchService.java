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
 * Logic tìm kiếm — F-003 / FR-004 / US-003.
 * Mirror frontend/utils/search.js (normalizeVi, scoreRelevance, rankProducts).
 *
 * Ghi chú kiến trúc: phase 1 chấm điểm ở service-layer sau khi nạp products
 * (~10k SP, đủ nhanh). Khi scale, chuyển sang MongoDB text index:
 * {@code db.products.createIndex({ name: "text", description: "text" })}
 * và sort theo textScore thay vì công thức thủ công ở đây.
 */
@Service
@RequiredArgsConstructor
public class SearchService {

  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;
  private final CategoryRepository categoryRepository;
  private final FlashSaleService flashSaleService;

  /** Chuẩn hoá không dấu: "Bàn trà gỗ sồi" -> "ban tra go soi" (mirror normalizeVi). */
  static String normalizeVi(String s) {
    if (s == null) return "";
    String n = Normalizer.normalize(s.toLowerCase(), Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "");
    return n.replace('đ', 'd');
  }

  /**
   * Chấm điểm liên quan (§3.2 spec):
   * tên chứa nguyên cụm +100 > tên danh mục +60 > tên đủ các từ +40 >
   * mô tả +20 > tên chứa một phần +10/từ. 0 = không liên quan.
   */
  static int scoreRelevance(Product p, String qNorm, String categoryNorm) {
    String nameN = normalizeVi(p.getName());
    String descN = normalizeVi(p.getDescription());
    String catN = categoryNorm == null ? "" : categoryNorm;
    if (qNorm.isEmpty()) return 0;
    List<String> words = Arrays.stream(qNorm.split("\\s+"))
        .filter(w -> !w.isEmpty()).toList();

    if (nameN.contains(qNorm)) return 100;
    if (!catN.isEmpty() && catN.contains(qNorm)) return 60;
    if (words.size() > 1 && words.stream().allMatch(nameN::contains)) return 40;
    if (descN.contains(qNorm)) return 20;
    long hit = words.stream().filter(nameN::contains).count();
    return hit > 0 ? (int) (10 * hit) : 0;
  }

  private Map<String, List<ProductVariant>> variantsByProduct(List<String> productIds) {
    if (productIds.isEmpty()) return Map.of();
    return variantRepository.findByProductIdIn(productIds).stream()
        .collect(Collectors.groupingBy(ProductVariant::getProductId));
  }

  /** Điểm liên quan của từng sản phẩm, đã sort (điểm desc, hoà → soldCount desc). */
  private List<Map.Entry<Product, Integer>> ranked(String q) {
    String qNorm = normalizeVi(q).trim();
    if (qNorm.isEmpty()) return List.of();
    List<Product> products = productRepository.findByActiveTrue();
    Map<String, String> catNames = categoryRepository.findAll().stream()
        .collect(Collectors.toMap(Category::getId, c -> normalizeVi(c.getName()),
            (a, b) -> a));
    return products.stream()
        .map(p -> Map.entry(p,
            scoreRelevance(p, qNorm, catNames.getOrDefault(p.getCategoryId(), ""))))
        .filter(e -> e.getValue() > 0)
        .sorted(Comparator.<Map.Entry<Product, Integer>, Integer>comparing(Map.Entry::getValue)
            .reversed()
            .thenComparing(
                Comparator.comparingInt((Map.Entry<Product, Integer> e) -> e.getKey().getSoldCount())
                    .reversed()))
        .toList();
  }

  public PageResponseDto<ProductWithVariantsDto> search(
      String q,
      int page, int size,
      BigDecimal priceMin, BigDecimal priceMax,
      List<String> colors, List<String> materials, List<String> sizes,
      String sort, boolean inStock) {

    // q rỗng -> trả rỗng (F-003 edge case), không trả toàn bộ catalog
    if (q == null || q.trim().isEmpty()) {
      return PageResponseDto.of(List.of(), 0, 1, size > 0 ? size : 24);
    }

    List<Map.Entry<Product, Integer>> ranked = ranked(q);
    Map<String, Integer> scores = ranked.stream()
        .collect(Collectors.toMap(e -> e.getKey().getId(), Map.Entry::getValue));
    List<Product> candidates = ranked.stream().map(Map.Entry::getKey).toList();
    Map<String, List<ProductVariant>> byProduct = variantsByProduct(
        candidates.stream().map(Product::getId).toList());

    // Áp 5 nhóm filter (mirror CatalogService), rồi khôi phục thứ tự liên quan
    List<Product> filtered = candidates.stream()
        .filter(p -> {
          List<ProductVariant> vs = byProduct.getOrDefault(p.getId(), List.of());
          if (inStock && CatalogService.outOfStock(vs)) return false;
          BigDecimal price = CatalogService.cardPrice(p, vs);
          if (priceMin != null && price.compareTo(priceMin) < 0) return false;
          if (priceMax != null && price.compareTo(priceMax) > 0) return false;
          if (colors != null && !colors.isEmpty()
              && vs.stream().noneMatch(v -> colors.contains(v.getColor()) && v.getStock() > 0))
            return false;
          if (materials != null && !materials.isEmpty()) {
            String have = normalizeVi(
                p.getSpecs() != null ? p.getSpecs().getOrDefault("Chất liệu", "") : "")
                + " " + normalizeVi(vs.stream()
                    .map(v -> v.getMaterialNote() == null ? "" : v.getMaterialNote())
                    .collect(Collectors.joining(" ")));
            if (materials.stream().map(SearchService::normalizeVi).noneMatch(have::contains))
              return false;
          }
          if (sizes != null && !sizes.isEmpty()
              && vs.stream().noneMatch(v -> sizes.stream()
                  .anyMatch(b -> inSizeBucket(v.getLengthM(), b))))
            return false;
          return true;
        })
        .collect(Collectors.toCollection(ArrayList::new));

    String effectiveSort = sort == null ? "relevance" : sort;
    switch (effectiveSort) {
      case "price_asc" -> filtered.sort(Comparator.comparing(
          p -> CatalogService.cardPrice(p, byProduct.getOrDefault(p.getId(), List.of()))));
      case "price_desc" -> filtered.sort(Comparator.<Product, BigDecimal>comparing(
          p -> CatalogService.cardPrice(p, byProduct.getOrDefault(p.getId(), List.of())))
          .reversed());
      case "newest" -> filtered.sort(Comparator.comparing(Product::getCreatedAt,
          Comparator.nullsLast(Comparator.naturalOrder())).reversed());
      case "popular" -> filtered.sort(Comparator.comparingInt(Product::getSoldCount).reversed());
      default -> filtered.sort(Comparator
          .<Product, Integer>comparing(p -> scores.getOrDefault(p.getId(), 0)).reversed()
          .thenComparing(Comparator.comparingInt(Product::getSoldCount).reversed()));
    }

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

  /** Facets tính trên toàn bộ tập kết quả tìm kiếm (chưa áp filter). */
  public FacetsDto searchFacets(String q) {
    List<Product> candidates = ranked(q).stream().map(Map.Entry::getKey).toList();
    Map<String, List<ProductVariant>> byProduct = variantsByProduct(
        candidates.stream().map(Product::getId).toList());

    Map<String, FacetsDto.ColorOption> colorMap = new LinkedHashMap<>();
    Set<String> materials = new TreeSet<>();
    for (Product p : candidates) {
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
}
