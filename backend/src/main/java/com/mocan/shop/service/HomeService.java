package com.mocan.shop.service;

import com.mocan.shop.dto.ProductWithVariantsDto;
import com.mocan.shop.model.Banner;
import com.mocan.shop.model.Category;
import com.mocan.shop.model.Product;
import com.mocan.shop.repository.BannerRepository;
import com.mocan.shop.repository.CategoryRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import java.util.List;

/** Dữ liệu trang chủ — F-001. */
@Service
@RequiredArgsConstructor
public class HomeService {
  private final BannerRepository bannerRepository;
  private final CategoryRepository categoryRepository;
  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;
  private final FlashSaleService flashSaleService;

  public List<Banner> getActiveBanners() {
    return bannerRepository.findByActiveTrueOrderBySortOrderAsc();
  }

  public List<Category> getFeaturedCategories() {
    return categoryRepository.findTop8ByActiveTrueOrderBySortOrderAsc();
  }

  public List<ProductWithVariantsDto> getFeaturedProducts() {
    return withVariants(productRepository.findByFeaturedTrueAndActiveTrue(), null);
  }

  public List<ProductWithVariantsDto> getBestSellers() {
    return withVariants(
        productRepository.findByActiveTrueOrderBySoldCountDesc(PageRequest.of(0, 10)),
        badge("bestseller", "BÁN CHẠY"));
  }

  public List<ProductWithVariantsDto> getNewestProducts() {
    return withVariants(
        productRepository.findByActiveTrueOrderByCreatedAtDesc(PageRequest.of(0, 10)),
        badge("new", "MỚI"));
  }

  private ProductWithVariantsDto.BadgeDto badge(String type, String label) {
    ProductWithVariantsDto.BadgeDto b = new ProductWithVariantsDto.BadgeDto();
    b.setType(type);
    b.setLabel(label);
    return b;
  }

  private List<ProductWithVariantsDto> withVariants(
      List<Product> products, ProductWithVariantsDto.BadgeDto badge) {
    List<ProductWithVariantsDto> dtos = products.stream()
        .map(p -> {
          ProductWithVariantsDto dto =
              ProductWithVariantsDto.of(p, variantRepository.findByProductId(p.getId()));
          dto.setBadge(badge);
          return dto;
        })
        .toList();
    // Variant thuộc chương trình flash sale -> kèm field flashSale (flash-sale.md §5.1).
    flashSaleService.attachToProductDtos(dtos);
    return dtos;
  }
}
