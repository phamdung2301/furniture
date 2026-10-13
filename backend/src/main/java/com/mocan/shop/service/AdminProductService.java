package com.mocan.shop.service;

import com.mocan.shop.dto.AdminProductDetailDto;
import com.mocan.shop.dto.AdminProductListItemDto;
import com.mocan.shop.dto.AdminProductPatchRequest;
import com.mocan.shop.dto.AdminProductRequest;
import com.mocan.shop.dto.PageResponseDto;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Category;
import com.mocan.shop.model.Order;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.repository.CategoryRepository;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import com.mocan.shop.service.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Quản lý sản phẩm (admin) — FR-020 · F-014 · US-013 (admin-san-pham.md §6).
 * Rule F-014: mỗi MÀU có sku unique, price > 0, stock >= 0, lengthM/widthM > 0;
 * tối thiểu 1 màu/sản phẩm; tối đa 10 ảnh/sản phẩm.
 * Sản phẩm đã có đơn liên quan → ngừng bán (active=false) thay vì xóa cứng.
 */
@Service
@RequiredArgsConstructor
public class AdminProductService {

  private static final int MAX_IMAGES = 10;
  private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
  private static final Set<String> ALLOWED_IMAGE_TYPES =
      Set.of("image/jpeg", "image/png", "image/webp");
  private static final int DEFAULT_LOW_STOCK_THRESHOLD = 5;

  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;
  private final CategoryRepository categoryRepository;
  private final OrderRepository orderRepository;
  private final StorageService storageService;

  /* ------------------------------ Danh sách ------------------------------ */

  /**
   * GET /admin/products — lọc q (tên hoặc SKU của bất kỳ màu nào) / danh mục /
   * trạng thái; sắp xếp newest|name_*|price_*|stock_*; page 1-indexed.
   */
  public PageResponseDto<AdminProductListItemDto> list(
      String q, String categoryId, Boolean active, String sort, int page, int size) {
    List<Product> products = productRepository.findAll();
    Map<String, List<ProductVariant>> variantsByProduct = variantsByProduct();
    Map<String, String> categoryNames = categoryNames();
    OrderRefs orderRefs = orderRefs();

    String needle = q == null ? "" : q.trim().toLowerCase();
    List<Product> filtered = new ArrayList<>();
    for (Product p : products) {
      if (categoryId != null && !categoryId.isBlank() && !categoryId.equals(p.getCategoryId())) {
        continue;
      }
      if (active != null && active != p.isActive()) {
        continue;
      }
      if (!needle.isEmpty()) {
        boolean nameHit = p.getName() != null && p.getName().toLowerCase().contains(needle);
        boolean skuHit =
            variantsByProduct.getOrDefault(p.getId(), List.of()).stream()
                .anyMatch(v -> v.getSku() != null && v.getSku().toLowerCase().contains(needle));
        if (!nameHit && !skuHit) {
          continue;
        }
      }
      filtered.add(p);
    }

    Comparator<Product> comparator =
        switch (sort == null ? "newest" : sort) {
          case "name_asc" ->
              Comparator.comparing((Product p) -> nullSafe(p.getName()), String.CASE_INSENSITIVE_ORDER);
          case "name_desc" ->
              Comparator.comparing((Product p) -> nullSafe(p.getName()), String.CASE_INSENSITIVE_ORDER)
                  .reversed();
          case "price_asc" ->
              Comparator.comparing((Product p) -> priceKey(variantsByProduct.get(p.getId())));
          case "price_desc" ->
              Comparator.comparing((Product p) -> priceKey(variantsByProduct.get(p.getId())))
                  .reversed();
          case "stock_asc" ->
              Comparator.comparingInt((Product p) -> totalStock(variantsByProduct.get(p.getId())));
          case "stock_desc" ->
              Comparator.comparingInt((Product p) -> totalStock(variantsByProduct.get(p.getId())))
                  .reversed();
          default -> // newest: createdAt giảm dần
              Comparator.comparing(
                      (Product p) -> p.getCreatedAt() == null ? Instant.MIN : p.getCreatedAt())
                  .reversed();
        };
    filtered.sort(comparator);

    int safeSize = Math.max(1, size);
    int safePage = Math.max(1, page);
    int from = Math.min((safePage - 1) * safeSize, filtered.size());
    int to = Math.min(from + safeSize, filtered.size());
    List<AdminProductListItemDto> content =
        filtered.subList(from, to).stream()
            .map(p -> toListItem(p, variantsByProduct.get(p.getId()), categoryNames, orderRefs))
            .toList();
    return PageResponseDto.of(content, filtered.size(), safePage, safeSize);
  }

  /* ------------------------------ Chi tiết ------------------------------ */

  public AdminProductDetailDto get(String id) {
    Product p = findProduct(id);
    return toDetail(p, variantRepository.findByProductId(id));
  }

  /* ------------------------------ Tạo / Sửa ------------------------------ */

  public AdminProductDetailDto create(AdminProductRequest req) {
    validateRules(req);
    checkSlugUnique(req.getSlug(), null);
    checkSkuUnique(req, null);

    Product p = new Product();
    applyProductFields(p, req);
    p.setRatingAvg(BigDecimal.ZERO);
    p.setRatingCount(0);
    p.setSoldCount(0);
    p.setCreatedAt(Instant.now());
    p = productRepository.save(p);

    List<ProductVariant> saved = saveVariants(p.getId(), req.getVariants(), List.of());
    return toDetail(p, saved);
  }

  public AdminProductDetailDto update(String id, AdminProductRequest req) {
    Product p = findProduct(id);
    validateRules(req);
    checkSlugUnique(req.getSlug(), id);
    checkSkuUnique(req, id);

    List<ProductVariant> existing = variantRepository.findByProductId(id);
    Set<String> keptIds =
        req.getVariants().stream()
            .map(AdminProductRequest.VariantRequest::getId)
            .filter(java.util.Objects::nonNull)
            .collect(Collectors.toSet());
    // Xóa màu đã có trong đơn → từ chối (F-014: ngừng bán thay vì xóa cứng).
    for (ProductVariant old : existing) {
      if (!keptIds.contains(old.getId()) && variantHasOrders(old)) {
        throw new ApiException(
            HttpStatus.CONFLICT,
            "VARIANT_HAS_ORDERS",
            "Màu " + old.getColor()
                + " đã có trong đơn hàng, không thể xóa. Hãy đặt tồn kho = 0 hoặc ngừng bán sản phẩm.",
            "variant");
      }
    }

    applyProductFields(p, req);
    p = productRepository.save(p);
    List<ProductVariant> saved = saveVariants(id, req.getVariants(), existing);
    return toDetail(p, saved);
  }

  /* ------------------------------ Xóa / Patch ------------------------------ */

  public void delete(String id) {
    Product p = findProduct(id);
    List<ProductVariant> variants = variantRepository.findByProductId(id);
    if (productHasOrders(variants)) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "HAS_ORDERS",
          "Sản phẩm đã có trong đơn hàng nên không thể xóa. Hãy ngừng bán sản phẩm thay vì xóa.");
    }
    variantRepository.deleteByProductId(id);
    productRepository.delete(p);
  }

  /** PATCH: { active } (ngừng bán / bán lại) hoặc { featured } (toggle ★). */
  public AdminProductListItemDto patch(String id, AdminProductPatchRequest req) {
    Product p = findProduct(id);
    if (req != null && req.getActive() != null) {
      p.setActive(req.getActive());
    }
    if (req != null && req.getFeatured() != null) {
      p.setFeatured(req.getFeatured());
    }
    p = productRepository.save(p);
    List<ProductVariant> variants = variantRepository.findByProductId(id);
    return toListItem(p, variants, categoryNames(), orderRefs());
  }

  /* ------------------------------ Upload ảnh ------------------------------ */

  /**
   * POST /admin/products/images — lưu file qua StorageService (subdir "products"),
   * trả [{ url }] (admin-san-pham.md §6). Giới hạn 10 ảnh/SP áp khi LƯU sản phẩm.
   * URL dạng /uploads/products/... ở chế độ local, URL S3/CDN ở chế độ s3.
   */
  public List<Map<String, String>> uploadImages(List<MultipartFile> files) {
    if (files == null || files.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "NO_FILE", "Vui lòng chọn ít nhất một ảnh.");
    }
    List<Map<String, String>> urls = new ArrayList<>();
    for (MultipartFile file : files) {
      if (file == null || file.isEmpty()) {
        continue;
      }
      if (file.getSize() > MAX_IMAGE_BYTES) {
        throw new ApiException(
            HttpStatus.PAYLOAD_TOO_LARGE,
            "FILE_TOO_LARGE",
            "Mỗi ảnh không được vượt quá 5MB.");
      }
      String contentType = file.getContentType();
      if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType.toLowerCase())) {
        throw new ApiException(
            HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            "INVALID_FILE_TYPE",
            "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.");
      }
      urls.add(Map.of("url", storageService.store(file, "products")));
    }
    return urls;
  }

  /* ------------------------------ Validate F-014 ------------------------------ */

  private void validateRules(AdminProductRequest req) {
    if (req == null) {
      throw unprocessable("Dữ liệu sản phẩm không hợp lệ.", null);
    }
    if (req.getName() == null || req.getName().isBlank()) {
      throw unprocessable("Tên sản phẩm là bắt buộc.", "name");
    }
    if (req.getName().trim().length() > 120) {
      throw unprocessable("Tên sản phẩm tối đa 120 ký tự.", "name");
    }
    if (req.getSlug() == null || req.getSlug().isBlank()) {
      throw unprocessable("Slug là bắt buộc.", "slug");
    }
    if (req.getCategoryId() == null || req.getCategoryId().isBlank()
        || !categoryRepository.existsById(req.getCategoryId())) {
      throw unprocessable("Danh mục không hợp lệ.", "categoryId");
    }
    if (req.getBasePrice() != null && req.getBasePrice().signum() < 0) {
      throw unprocessable("Giá niêm yết phải lớn hơn hoặc bằng 0.", "basePrice");
    }
    if (req.getImages() != null && req.getImages().size() > MAX_IMAGES) {
      throw unprocessable("Sản phẩm tối đa 10 ảnh.", "images");
    }
    if (req.getVariants() == null || req.getVariants().isEmpty()) {
      throw unprocessable("Sản phẩm cần ít nhất 1 màu.", "variants");
    }
    for (AdminProductRequest.VariantRequest v : req.getVariants()) {
      if (v.getColor() == null || v.getColor().isBlank()) {
        throw unprocessable("Tên màu là bắt buộc.", "variant");
      }
      if (v.getColorHex() == null || !v.getColorHex().matches("^#[0-9A-Fa-f]{6}$")) {
        throw unprocessable("Mã màu phải đúng dạng #RRGGBB.", "variant");
      }
      if (v.getSku() == null || v.getSku().isBlank()) {
        throw unprocessable("SKU là bắt buộc cho mỗi màu.", "sku");
      }
      if (v.getPrice() == null || v.getPrice().signum() <= 0) {
        throw unprocessable("Giá bán của mỗi màu phải lớn hơn 0.", "variant");
      }
      if (v.getStock() == null || v.getStock() < 0) {
        throw unprocessable("Tồn kho của mỗi màu phải lớn hơn hoặc bằng 0.", "variant");
      }
      if (v.getLowStockThreshold() != null && v.getLowStockThreshold() < 0) {
        throw unprocessable("Ngưỡng cảnh báo phải lớn hơn hoặc bằng 0.", "variant");
      }
      if (v.getLengthM() == null || v.getLengthM().signum() <= 0
          || v.getWidthM() == null || v.getWidthM().signum() <= 0) {
        throw unprocessable(
            "Kích thước dài/rộng của mỗi màu phải lớn hơn 0 (dùng để tính phí ship).", "variant");
      }
    }
  }

  private void checkSlugUnique(String slug, String excludeProductId) {
    boolean dup =
        excludeProductId == null
            ? productRepository.existsBySlug(slug)
            : productRepository.existsBySlugAndIdNot(slug, excludeProductId);
    if (dup) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "SLUG_EXISTS",
          "Slug đã được dùng bởi sản phẩm khác.",
          "slug");
    }
  }

  private void checkSkuUnique(AdminProductRequest req, String excludeProductId) {
    Set<String> seen = new HashSet<>();
    for (AdminProductRequest.VariantRequest v : req.getVariants()) {
      String sku = v.getSku() == null ? "" : v.getSku().trim();
      if (!seen.add(sku.toLowerCase())) {
        throw skuExists(sku);
      }
      boolean dup =
          excludeProductId == null
              ? variantRepository.existsBySku(sku)
              : variantRepository.existsBySkuAndProductIdNot(sku, excludeProductId);
      if (dup) {
        throw skuExists(sku);
      }
    }
  }

  private ApiException skuExists(String sku) {
    return new ApiException(
        HttpStatus.CONFLICT, "SKU_EXISTS", "SKU " + sku + " đã tồn tại.", "sku");
  }

  private ApiException unprocessable(String message, String field) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message, field);
  }

  /* ------------------------------ Mapping / helpers ------------------------------ */

  private Product findProduct(String id) {
    return productRepository
        .findById(id)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm."));
  }

  private void applyProductFields(Product p, AdminProductRequest req) {
    p.setName(req.getName().trim());
    p.setSlug(req.getSlug().trim());
    p.setCategoryId(req.getCategoryId());
    p.setDescription(req.getDescription());
    p.setSpecs(req.getSpecs() == null ? Map.of() : req.getSpecs());
    p.setBasePrice(req.getBasePrice() == null ? BigDecimal.ZERO : req.getBasePrice());
    if (req.getBadge() == null || req.getBadge().getType() == null) {
      p.setBadge(null);
    } else {
      Product.Badge badge = new Product.Badge();
      badge.setType(req.getBadge().getType());
      badge.setLabel(req.getBadge().getLabel());
      p.setBadge(badge);
    }
    List<Product.ProductImage> images = new ArrayList<>();
    if (req.getImages() != null) {
      int order = 1;
      for (AdminProductRequest.ImageRequest img : req.getImages()) {
        Product.ProductImage pi = new Product.ProductImage();
        pi.setUrl(img.getUrl());
        pi.setSortOrder(img.getSortOrder() > 0 ? img.getSortOrder() : order);
        order++;
        images.add(pi);
      }
      images.sort(Comparator.comparingInt(Product.ProductImage::getSortOrder));
    }
    p.setImages(images);
    p.setFeatured(req.isFeatured());
    p.setActive(req.isActive());
  }

  /**
   * Ghi biến thể: id khớp biến thể cũ → cập nhật; còn lại → tạo mới.
   * Biến thể cũ không còn trong request → xóa (đã kiểm tra đơn ở update()).
   */
  private List<ProductVariant> saveVariants(
      String productId,
      List<AdminProductRequest.VariantRequest> requests,
      List<ProductVariant> existing) {
    Map<String, ProductVariant> existingById =
        existing.stream().collect(Collectors.toMap(ProductVariant::getId, v -> v));
    Set<String> keptIds = new HashSet<>();
    List<ProductVariant> saved = new ArrayList<>();
    for (AdminProductRequest.VariantRequest r : requests) {
      ProductVariant v =
          r.getId() != null && existingById.containsKey(r.getId())
              ? existingById.get(r.getId())
              : new ProductVariant();
      v.setProductId(productId);
      v.setSku(r.getSku().trim());
      v.setColor(r.getColor().trim());
      v.setColorHex(r.getColorHex());
      v.setPrice(r.getPrice());
      v.setStock(r.getStock());
      v.setLowStockThreshold(
          r.getLowStockThreshold() == null
              ? DEFAULT_LOW_STOCK_THRESHOLD
              : r.getLowStockThreshold());
      v.setLengthM(r.getLengthM());
      v.setWidthM(r.getWidthM());
      v.setSizeLabel(r.getSizeLabel());
      v.setMaterialNote(r.getMaterialNote());
      v = variantRepository.save(v);
      keptIds.add(v.getId());
      saved.add(v);
    }
    for (ProductVariant old : existing) {
      if (!keptIds.contains(old.getId())) {
        variantRepository.delete(old);
      }
    }
    return saved;
  }

  private AdminProductListItemDto toListItem(
      Product p,
      List<ProductVariant> variants,
      Map<String, String> categoryNames,
      OrderRefs orderRefs) {
    List<ProductVariant> vs = variants == null ? List.of() : variants;
    AdminProductListItemDto dto = new AdminProductListItemDto();
    dto.setId(p.getId());
    dto.setName(p.getName());
    dto.setSlug(p.getSlug());
    dto.setImage(
        p.getImages() == null || p.getImages().isEmpty()
            ? null
            : p.getImages().stream()
                .sorted(Comparator.comparingInt(Product.ProductImage::getSortOrder))
                .map(Product.ProductImage::getUrl)
                .findFirst()
                .orElse(null));
    dto.setCategoryId(p.getCategoryId());
    dto.setCategoryName(categoryNames.getOrDefault(p.getCategoryId(), ""));
    dto.setVariantCount(vs.size());
    dto.setColorHexes(vs.stream().map(ProductVariant::getColorHex).toList());
    dto.setMinPrice(minPrice(vs));
    dto.setTotalStock(totalStock(vs));
    dto.setLowStockVariantCount(
        (int)
            vs.stream()
                .filter(v -> v.getStock() <= v.getLowStockThreshold())
                .count());
    dto.setActive(p.isActive());
    dto.setFeatured(p.isFeatured());
    dto.setHasOrders(
        vs.stream()
            .anyMatch(
                v ->
                    orderRefs.variantIds().contains(v.getId())
                        || orderRefs.skus().contains(v.getSku())));
    dto.setCreatedAt(p.getCreatedAt());
    return dto;
  }

  private AdminProductDetailDto toDetail(Product p, List<ProductVariant> variants) {
    AdminProductDetailDto dto = new AdminProductDetailDto();
    dto.setId(p.getId());
    dto.setName(p.getName());
    dto.setSlug(p.getSlug());
    dto.setCategoryId(p.getCategoryId());
    dto.setDescription(p.getDescription());
    dto.setSpecs(p.getSpecs() == null ? Map.of() : p.getSpecs());
    dto.setBasePrice(p.getBasePrice());
    if (p.getBadge() != null) {
      AdminProductDetailDto.BadgeDto badge = new AdminProductDetailDto.BadgeDto();
      badge.setType(p.getBadge().getType());
      badge.setLabel(p.getBadge().getLabel());
      dto.setBadge(badge);
    }
    dto.setImages(p.getImages() == null ? List.of() : p.getImages());
    dto.setFeatured(p.isFeatured());
    dto.setActive(p.isActive());
    dto.setVariants(
        variants.stream()
            .map(
                v -> {
                  AdminProductDetailDto.VariantDto vd = new AdminProductDetailDto.VariantDto();
                  vd.setId(v.getId());
                  vd.setSku(v.getSku());
                  vd.setColor(v.getColor());
                  vd.setColorHex(v.getColorHex());
                  vd.setPrice(v.getPrice());
                  vd.setStock(v.getStock());
                  vd.setLowStockThreshold(v.getLowStockThreshold());
                  vd.setLengthM(v.getLengthM());
                  vd.setWidthM(v.getWidthM());
                  vd.setSizeLabel(v.getSizeLabel());
                  vd.setMaterialNote(v.getMaterialNote());
                  return vd;
                })
            .toList());
    return dto;
  }

  private Map<String, List<ProductVariant>> variantsByProduct() {
    Map<String, List<ProductVariant>> map = new HashMap<>();
    for (ProductVariant v : variantRepository.findAll()) {
      map.computeIfAbsent(v.getProductId(), k -> new ArrayList<>()).add(v);
    }
    return map;
  }

  private Map<String, String> categoryNames() {
    Map<String, String> map = new HashMap<>();
    for (Category c : categoryRepository.findAll()) {
      map.put(c.getId(), c.getName());
    }
    return map;
  }

  /** Tập variantId + sku đã xuất hiện trong snapshot đơn hàng (nạp 1 lần). */
  private record OrderRefs(Set<String> variantIds, Set<String> skus) {}

  private OrderRefs orderRefs() {
    Set<String> variantIds = new HashSet<>();
    Set<String> skus = new HashSet<>();
    for (Order o : orderRepository.findAll()) {
      if (o.getItems() == null) {
        continue;
      }
      for (Order.OrderItem item : o.getItems()) {
        if (item.getVariantId() != null) {
          variantIds.add(item.getVariantId());
        }
        if (item.getSku() != null) {
          skus.add(item.getSku());
        }
      }
    }
    return new OrderRefs(variantIds, skus);
  }

  private boolean productHasOrders(List<ProductVariant> variants) {
    if (variants == null || variants.isEmpty()) {
      return false;
    }
    List<String> ids = variants.stream().map(ProductVariant::getId).toList();
    List<String> skus = variants.stream().map(ProductVariant::getSku).toList();
    return orderRepository.existsByItemVariantIdInOrItemSkuIn(ids, skus);
  }

  private boolean variantHasOrders(ProductVariant v) {
    return orderRepository.existsByItemVariantIdInOrItemSkuIn(
        List.of(v.getId()), v.getSku() == null ? List.of() : List.of(v.getSku()));
  }

  private static BigDecimal minPrice(List<ProductVariant> variants) {
    if (variants == null || variants.isEmpty()) {
      return null;
    }
    return variants.stream()
        .map(ProductVariant::getPrice)
        .filter(java.util.Objects::nonNull)
        .min(Comparator.naturalOrder())
        .orElse(null);
  }

  /** Khóa sắp xếp theo giá: sản phẩm chưa có màu tính 0 để comparator không gặp null. */
  private static BigDecimal priceKey(List<ProductVariant> variants) {
    BigDecimal min = minPrice(variants);
    return min == null ? BigDecimal.ZERO : min;
  }

  private static int totalStock(List<ProductVariant> variants) {
    if (variants == null) {
      return 0;
    }
    return variants.stream().mapToInt(ProductVariant::getStock).sum();
  }

  private static String nullSafe(String s) {
    return s == null ? "" : s;
  }
}
