package com.mocan.shop.service;

import com.mocan.shop.dto.CreateReviewRequest;
import com.mocan.shop.dto.PageResponseDto;
import com.mocan.shop.dto.ReviewDto;
import com.mocan.shop.dto.ReviewEligibilityDto;
import com.mocan.shop.dto.ReviewMutationResponse;
import com.mocan.shop.dto.ReviewSummaryDto;
import com.mocan.shop.model.Order;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.model.Review;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import com.mocan.shop.repository.ReviewRepository;
import com.mocan.shop.repository.UserRepository;
import com.mocan.shop.service.storage.ImageCompressor;
import com.mocan.shop.service.storage.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Đánh giá sản phẩm — FR-017 / F-012.
 * GET public (mới nhất trước). Ghi/sửa/xoá review yêu cầu đơn HOÀN THÀNH
 * và 1 user 1 review/sản phẩm (compound unique {productId, userId}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

  private static final String STATUS_COMPLETED = "HOÀN THÀNH";
  private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024; // 5MB
  private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
      "image/jpeg", "image/png", "image/webp");
  private static final int MAX_COMMENT_LENGTH = 1000;

  /** Từ khóa thô tục (có dấu + biến thể không dấu) — so sánh token lowercase → 422. */
  private static final Set<String> BANNED_WORDS = Set.of(
      "địt", "dit", "đụ", "lồn", "lon", "cặc", "cac", "cứt", "cut",
      "đéo", "deo", "vãi", "vai", "đm", "dm", "dcm", "cl", "cc", "vcl", "vl",
      "fuck", "shit", "bitch", "dick", "pussy", "asshole");

  private final ReviewRepository reviewRepository;
  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;
  private final OrderRepository orderRepository;
  private final UserRepository userRepository;
  private final ProductService productService;
  private final StorageService storageService;

  /** Quyết định đi pipeline S3 + Lambda (s3) hay nén tại backend (local) cho ảnh review. */
  @Value("${app.storage.type:local}")
  private String storageType;

  // ---------- Đọc: danh sách review theo slug (public) ----------

  public PageResponseDto<ReviewDto> getByProductSlug(String slug, int page, int size) {
    Product product = findProductBySlug(slug);
    List<Review> all = reviewRepository.findByProductIdOrderByCreatedAtDesc(product.getId());
    int safeSize = Math.max(1, Math.min(size, 50));
    int totalPages = Math.max(1, (int) Math.ceil((double) all.size() / safeSize));
    int safePage = Math.min(Math.max(1, page), totalPages);
    int from = (safePage - 1) * safeSize;
    int to = Math.min(from + safeSize, all.size());
    List<Review> pageContent = from < all.size() ? all.subList(from, to) : List.of();
    List<ReviewDto> content = toDtoList(pageContent);
    return PageResponseDto.of(content, all.size(), safePage, safeSize);
  }

  // ---------- Eligibility (auth optional) ----------

  public ReviewEligibilityDto eligibility(String slug, String userId) {
    Product product = findProductBySlug(slug);
    ReviewEligibilityDto dto = new ReviewEligibilityDto();
    dto.setCanReview(false);
    dto.setHasReviewed(false);
    dto.setPurchasedColors(List.of());

    if (userId == null) {
      dto.setReason("NOT_LOGGED_IN");
      return dto;
    }

    var existing = reviewRepository.findByProductIdAndUserId(product.getId(), userId);
    if (existing.isPresent()) {
      dto.setReason("ALREADY_REVIEWED");
      dto.setHasReviewed(true);
      dto.setReviewId(existing.get().getId());
      return dto;
    }

    Set<String> variantIds = variantIdsOf(product.getId());
    Set<String> skus = skusOf(product.getId());
    List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);

    List<Order> containing = orders.stream()
        .filter(o -> orderContainsProduct(o, variantIds, skus))
        .toList();
    List<Order> completed = containing.stream()
        .filter(o -> STATUS_COMPLETED.equals(o.getStatus()))
        .toList();

    if (!completed.isEmpty()) {
      Order newest = completed.get(0); // findByUserIdOrderByCreatedAtDesc → mới nhất trước
      dto.setCanReview(true);
      dto.setReason("OK");
      dto.setOrderId(newest.getId());
      dto.setPurchasedColors(purchasedColors(completed, variantIds, skus));
      return dto;
    }
    if (!containing.isEmpty()) {
      dto.setReason("NOT_COMPLETED");
      return dto;
    }
    dto.setReason("NOT_PURCHASED");
    return dto;
  }

  // ---------- Tạo review (auth) ----------

  public ReviewMutationResponse create(String slug, String userId, CreateReviewRequest req) {
    validateInput(req);
    Product product = findProductBySlug(slug);

    ReviewEligibilityDto elig = eligibility(slug, userId);
    if ("ALREADY_REVIEWED".equals(elig.getReason())
        || reviewRepository.existsByProductIdAndUserId(product.getId(), userId)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đã đánh giá sản phẩm này.");
    }
    if (!elig.isCanReview()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN,
          "Bạn cần mua và nhận hàng trước khi đánh giá.");
    }

    Review r = new Review();
    r.setProductId(product.getId());
    r.setUserId(userId);
    r.setUserName(resolveUserName(userId, null));
    r.setOrderId(resolveOrderId(product.getId(), userId, req.getOrderId()));
    r.setColor(req.getColor());
    r.setRating(req.getRating());
    r.setComment(trim(req.getComment()));
    r.setImages(req.getImageUrls() != null ? List.copyOf(req.getImageUrls()) : List.of());
    r.setVerifiedPurchase(true);
    r.setCreatedAt(Instant.now());
    try {
      r = reviewRepository.save(r);
    } catch (DuplicateKeyException e) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đã đánh giá sản phẩm này.");
    }

    recalcProductRating(product.getId());
    return mutationResponse(r, product.getId());
  }

  // ---------- Sửa review (auth, chỉ chủ sở hữu) ----------

  public ReviewMutationResponse update(String reviewId, String userId, CreateReviewRequest req) {
    validateInput(req);
    Review r = reviewRepository.findById(reviewId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đánh giá"));
    if (!userId.equals(r.getUserId())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền sửa đánh giá này.");
    }
    r.setRating(req.getRating());
    r.setComment(trim(req.getComment()));
    r.setImages(req.getImageUrls() != null ? List.copyOf(req.getImageUrls()) : List.of());
    r.setColor(req.getColor());
    r = reviewRepository.save(r);

    recalcProductRating(r.getProductId());
    return mutationResponse(r, r.getProductId());
  }

  // ---------- Xoá review (auth, chỉ chủ sở hữu) ----------

  public void delete(String reviewId, String userId) {
    Review r = reviewRepository.findById(reviewId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đánh giá"));
    if (!userId.equals(r.getUserId())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xoá đánh giá này.");
    }
    reviewRepository.delete(r);
    recalcProductRating(r.getProductId());
  }

  // ---------- Upload ảnh review ----------

  /**
   * Upload ảnh review — 2 đường theo STORAGE_TYPE (validate giữ nguyên như cũ:
   * ≤5MB, chỉ JPG/PNG/WebP, kiểm tra TRƯỚC mọi bước lưu/nén):
   *
   * s3 (production) — pipeline S3 + Lambda nén: backend chỉ upload ảnh GỐC lên
   * key reviews/original/<uuid>.<ext>. Sự kiện S3 ObjectCreated kích hoạt Lambda
   * (infra/lambda-image-compressor/) nén/resize rồi ghi bản tối ưu tại
   * reviews/optimized/<uuid>.jpg trên CÙNG bucket và xóa ảnh gốc. Vì key đích
   * cố định theo uuid nên URL bản tối ưu ĐOÁN TRƯỚC ĐƯỢC ngay tại đây — đó là
   * URL lưu vào review.images; app không giữ binary nào cả. Lambda chạy async
   * (~1 giây) nên ảnh có thể chưa mở được trong khoảnh khắc đầu sau khi đăng.
   *
   * local (dev) — mô phỏng pipeline ngay tại backend để dev chạy end-to-end
   * không cần AWS: nén bằng Thumbnailator (≤1600px, JPEG 0.82) rồi lưu qua
   * LocalStorageService (subdir "reviews" → URL /uploads/reviews/...).
   */
  public List<String> uploadImages(List<MultipartFile> files) {
    if (files == null || files.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chọn ít nhất một ảnh.");
    }
    List<String> urls = new ArrayList<>();
    for (MultipartFile file : files) {
      if (file == null || file.isEmpty()) continue;
      if (file.getSize() > MAX_IMAGE_BYTES) {
        throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
            "Mỗi ảnh không được vượt quá 5MB.");
      }
      String contentType = file.getContentType();
      if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType.toLowerCase())) {
        throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.");
      }
      urls.add(storeReviewImage(file, contentType.toLowerCase()));
    }
    return urls;
  }

  private String storeReviewImage(MultipartFile file, String contentType) {
    if ("s3".equalsIgnoreCase(storageType)) {
      String uuid = UUID.randomUUID().toString();
      String originalKey = "reviews/original/" + uuid + StorageService.extensionFor(contentType);
      storageService.storeAt(file, originalKey);
      // URL bản TỐI ƯU do Lambda sắp tạo — đoán trước theo đúng quy ước key của Lambda.
      return storageService.urlFor("reviews/optimized/" + uuid + ".jpg");
    }
    // Dev local: nén tại backend (mô phỏng Lambda) rồi lưu qua LocalStorageService.
    try {
      byte[] raw = file.getBytes();
      byte[] jpeg = ImageCompressor.compressToJpeg(raw);
      if (jpeg != null) {
        return storageService.storeBytes(jpeg, ImageCompressor.OUTPUT_CONTENT_TYPE, "reviews");
      }
      // JDK không giải mã được WebP (thiếu plugin ImageIO) → lưu nguyên bản đã validate.
      log.warn("ReviewService: không giải mã được ảnh {} để nén, lưu nguyên bản.", contentType);
      return storageService.storeBytes(raw, contentType, "reviews");
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không lưu được ảnh.");
    }
  }

  // ---------- Helpers ----------

  private Product findProductBySlug(String slug) {
    return productRepository.findByActiveTrue().stream()
        .filter(p -> slug.equals(p.getSlug()))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm"));
  }

  /** OrderItem không lưu productId — khớp qua variantId (fallback SKU). */
  private Set<String> variantIdsOf(String productId) {
    return variantRepository.findByProductId(productId).stream()
        .map(ProductVariant::getId)
        .collect(Collectors.toSet());
  }

  private Set<String> skusOf(String productId) {
    return variantRepository.findByProductId(productId).stream()
        .map(ProductVariant::getSku)
        .filter(s -> s != null && !s.isBlank())
        .collect(Collectors.toSet());
  }

  private boolean orderContainsProduct(Order o, Set<String> variantIds, Set<String> skus) {
    if (o.getItems() == null) return false;
    return o.getItems().stream().anyMatch(it ->
        (it.getVariantId() != null && variantIds.contains(it.getVariantId()))
            || (it.getSku() != null && skus.contains(it.getSku())));
  }

  private boolean itemMatchesProduct(Order.OrderItem it, Set<String> variantIds, Set<String> skus) {
    return (it.getVariantId() != null && variantIds.contains(it.getVariantId()))
        || (it.getSku() != null && skus.contains(it.getSku()));
  }

  /** Màu các OrderItem của SP trong các đơn HOÀN THÀNH (giữ thứ tự, loại trùng). */
  private List<String> purchasedColors(List<Order> completed,
      Set<String> variantIds, Set<String> skus) {
    Set<String> colors = new LinkedHashSet<>();
    for (Order o : completed) {
      if (o.getItems() == null) continue;
      for (Order.OrderItem it : o.getItems()) {
        if (itemMatchesProduct(it, variantIds, skus)
            && it.getColor() != null && !it.getColor().isBlank()) {
          colors.add(it.getColor());
        }
      }
    }
    return new ArrayList<>(colors);
  }

  private String resolveOrderId(String productId, String userId, String requestedOrderId) {
    Set<String> variantIds = variantIdsOf(productId);
    Set<String> skus = skusOf(productId);
    List<Order> completed = orderRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
        .filter(o -> STATUS_COMPLETED.equals(o.getStatus())
            && orderContainsProduct(o, variantIds, skus))
        .toList();
    if (requestedOrderId != null && completed.stream().anyMatch(o -> requestedOrderId.equals(o.getId()))) {
      return requestedOrderId;
    }
    return completed.isEmpty() ? null : completed.get(0).getId();
  }

  private String resolveUserName(String userId, String snapshot) {
    if (snapshot != null && !snapshot.isBlank()) return snapshot;
    return userRepository.findById(userId)
        .map(u -> u.getFullName() != null && !u.getFullName().isBlank() ? u.getFullName() : "Khách hàng")
        .orElse("Khách hàng");
  }

  private List<ReviewDto> toDtoList(List<Review> reviews) {
    List<String> needLookup = reviews.stream()
        .filter(r -> r.getUserName() == null || r.getUserName().isBlank())
        .map(Review::getUserId)
        .distinct()
        .toList();
    Map<String, String> names = userRepository.findAllById(needLookup).stream()
        .collect(Collectors.toMap(
            u -> u.getId(),
            u -> u.getFullName() != null && !u.getFullName().isBlank() ? u.getFullName() : "Khách hàng",
            (a, b) -> a));
    return reviews.stream()
        .map(r -> {
          String name = (r.getUserName() != null && !r.getUserName().isBlank())
              ? r.getUserName()
              : names.getOrDefault(r.getUserId(), "Khách hàng");
          return ReviewDto.of(r, name);
        })
        .toList();
  }

  /** Tính lại Product.ratingAvg/ratingCount sau mỗi lần ghi/xoá review. */
  private void recalcProductRating(String productId) {
    Product product = productRepository.findById(productId).orElse(null);
    if (product == null) return;
    List<Review> reviews = reviewRepository.findByProductIdOrderByCreatedAtDesc(productId);
    product.setRatingCount(reviews.size());
    BigDecimal avg = reviews.isEmpty()
        ? BigDecimal.ZERO
        : BigDecimal.valueOf(reviews.stream().mapToInt(Review::getRating).average().orElse(0))
            .setScale(1, RoundingMode.HALF_UP);
    product.setRatingAvg(avg);
    productRepository.save(product);
  }

  private ReviewMutationResponse mutationResponse(Review r, String productId) {
    Product product = productRepository.findById(productId).orElse(null);
    ReviewMutationResponse res = new ReviewMutationResponse();
    res.setReview(ReviewDto.of(r, resolveUserName(r.getUserId(), r.getUserName())));
    res.setSummary(product != null ? productService.summarize(product)
        : emptySummary());
    return res;
  }

  private ReviewSummaryDto emptySummary() {
    ReviewSummaryDto s = new ReviewSummaryDto();
    s.setAverage(BigDecimal.ZERO);
    s.setTotal(0);
    Map<Integer, Integer> dist = new HashMap<>();
    for (int star = 1; star <= 5; star++) dist.put(star, 0);
    s.setDistribution(dist);
    return s;
  }

  // ---------- Validation ----------

  private void validateInput(CreateReviewRequest req) {
    if (req == null || req.getRating() < 1 || req.getRating() > 5) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Điểm đánh giá phải từ 1 đến 5.");
    }
    String comment = req.getComment();
    if (comment != null && comment.length() > MAX_COMMENT_LENGTH) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bình luận tối đa 1000 ký tự.");
    }
    if (containsProfanity(comment)) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
          "Bình luận chứa từ ngữ không phù hợp. Vui lòng chỉnh sửa lại.");
    }
  }

  private boolean containsProfanity(String text) {
    if (text == null || text.isBlank()) return false;
    for (String token : text.toLowerCase().split("[^\\p{L}0-9]+")) {
      if (!token.isEmpty() && BANNED_WORDS.contains(token)) return true;
    }
    return false;
  }

  private String trim(String s) {
    return s == null ? null : s.trim();
  }
}
