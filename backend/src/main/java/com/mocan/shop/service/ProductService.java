package com.mocan.shop.service;

import com.mocan.shop.dto.ProductDetailDto;
import com.mocan.shop.dto.ProductWithVariantsDto;
import com.mocan.shop.dto.ReviewSummaryDto;
import com.mocan.shop.model.Category;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.model.Review;
import com.mocan.shop.repository.CategoryRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import com.mocan.shop.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Chi tiết sản phẩm — F-004 / FR-005 / FR-006.
 * slug sai hoặc active=false -> 404 (F-004 edge case).
 */
@Service
@RequiredArgsConstructor
public class ProductService {

  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;
  private final CategoryRepository categoryRepository;
  private final ReviewRepository reviewRepository;
  private final FlashSaleService flashSaleService;

  public ProductDetailDto getBySlug(String slug) {
    Product product = productRepository.findByActiveTrue().stream()
        .filter(p -> slug.equals(p.getSlug()))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm"));

    List<ProductVariant> variants = variantRepository.findByProductId(product.getId());
    Category category = categoryRepository.findById(product.getCategoryId()).orElse(null);

    // Sản phẩm liên quan: cùng danh mục, loại trừ SP hiện tại, ưu tiên bán chạy, ≤8
    List<Product> relatedSource = productRepository
        .findByCategoryIdAndActiveTrue(product.getCategoryId()).stream()
        .filter(p -> !p.getId().equals(product.getId()))
        .sorted(Comparator.comparingInt(Product::getSoldCount).reversed())
        .limit(8)
        .collect(Collectors.toList());
    List<String> relatedIds = relatedSource.stream().map(Product::getId).collect(Collectors.toList());
    Map<String, List<ProductVariant>> variantsByProduct = variantRepository.findByProductIdIn(relatedIds)
        .stream().collect(Collectors.groupingBy(ProductVariant::getProductId));
    List<ProductWithVariantsDto> related = relatedSource.stream()
        .map(p -> ProductWithVariantsDto.of(p, variantsByProduct.getOrDefault(p.getId(), List.of())))
        .collect(Collectors.toList());
    // Gắn thông tin flash sale vào từng variant (flash-sale.md §5.3) — giá flash do backend tính.
    flashSaleService.attachToVariants(variants);
    flashSaleService.attachToProductDtos(related);

    ProductDetailDto dto = new ProductDetailDto();
    dto.setId(product.getId());
    dto.setName(product.getName());
    dto.setSlug(product.getSlug());
    dto.setCategoryId(product.getCategoryId());
    dto.setCategoryName(category != null ? category.getName() : "");
    dto.setCategorySlug(category != null ? category.getSlug() : "");
    dto.setDescription(product.getDescription());
    dto.setSpecs(product.getSpecs());
    dto.setImages(product.getImages());
    dto.setRatingAvg(product.getRatingAvg());
    dto.setRatingCount(product.getRatingCount());
    dto.setSoldCount(product.getSoldCount());
    dto.setFeatured(product.isFeatured());
    dto.setActive(product.isActive());
    dto.setVariants(variants);
    dto.setReviewSummary(summarize(product));
    dto.setRelated(related);
    // badge: tái dùng logic HomeService nếu có; ở đây để null (FE fallback)
    return dto;
  }

  /** Tóm tắt đánh giá: điểm TB + tổng + phân bố % 5→1 sao. */
  public ReviewSummaryDto summarize(Product product) {
    List<Review> reviews = reviewRepository.findByProductIdOrderByCreatedAtDesc(product.getId());
    long total = product.getRatingCount() > 0 ? product.getRatingCount() : reviews.size();
    Map<Integer, Integer> dist = new HashMap<>();
    for (int s = 1; s <= 5; s++) dist.put(s, 0);
    for (Review r : reviews) {
      int star = Math.min(5, Math.max(1, r.getRating()));
      dist.put(star, dist.get(star) + 1);
    }
    if (total > 0) {
      for (int s = 1; s <= 5; s++) {
        dist.put(s, (int) Math.round(dist.get(s) * 100.0 / Math.max(1, reviews.size())));
      }
    }
    ReviewSummaryDto dto = new ReviewSummaryDto();
    dto.setAverage(product.getRatingAvg() != null ? product.getRatingAvg() : BigDecimal.ZERO);
    dto.setTotal(total);
    dto.setDistribution(dist);
    return dto;
  }
}
