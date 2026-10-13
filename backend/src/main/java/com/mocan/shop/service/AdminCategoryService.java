package com.mocan.shop.service;

import com.mocan.shop.dto.AdminCategoryDetailDto;
import com.mocan.shop.dto.AdminCategoryDto;
import com.mocan.shop.dto.AdminCategoryMoveItemDto;
import com.mocan.shop.dto.AdminCategoryMoveRequest;
import com.mocan.shop.dto.AdminCategoryPatchRequest;
import com.mocan.shop.dto.AdminCategoryRequest;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Category;
import com.mocan.shop.repository.CategoryRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.service.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Quản lý danh mục (admin) — FR-021 · F-015 (admin-danh-muc.md §7).
 * Rule F-015: cây đúng 2 cấp qua parentId (cha phải là danh mục gốc; danh mục
 * đang có con không được gán cha — sẽ sinh cấp 3); slug unique toàn hệ thống;
 * không xóa danh mục còn sản phẩm. Spec §5 bổ sung lớp chặn còn danh mục con,
 * thứ tự kiểm: con trước → sản phẩm sau.
 * sortOrder chỉ so trong cùng nhóm anh em (cùng parentId); move hoán đổi với
 * anh em kề rồi chuẩn hoá cả nhóm thành dãy liên tục 1..n (§4).
 */
@Service
@RequiredArgsConstructor
public class AdminCategoryService {

  private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
  private static final Set<String> ALLOWED_IMAGE_TYPES =
      Set.of("image/jpeg", "image/png", "image/webp");

  /** Thứ tự hiển thị: sortOrder tăng dần, hoà thì theo tên A–Z (giả định §3). */
  private static final Comparator<Category> BY_ORDER_THEN_NAME =
      Comparator.comparingInt(Category::getSortOrder)
          .thenComparing(c -> c.getName() == null ? "" : c.getName(), String.CASE_INSENSITIVE_ORDER);

  private final CategoryRepository categoryRepository;
  private final ProductRepository productRepository;
  private final StorageService storageService;

  /* ------------------------------ Danh sách ------------------------------ */

  /** GET /admin/categories — toàn bộ phẳng, sortOrder tăng dần, kèm productCount + hasChildren. */
  public List<AdminCategoryDto> list() {
    List<Category> categories = categoryRepository.findAll();
    Map<String, Long> productCounts = new HashMap<>();
    for (Category c : categories) {
      productCounts.put(c.getId(), productRepository.countByCategoryId(c.getId()));
    }
    return categories.stream()
        .sorted(BY_ORDER_THEN_NAME)
        .map(c -> toDto(c, productCounts.getOrDefault(c.getId(), 0L)))
        .toList();
  }

  /* ------------------------------ Chi tiết ------------------------------ */

  public AdminCategoryDetailDto get(String id) {
    return toDetail(findCategory(id));
  }

  /* ------------------------------ Tạo / Sửa ------------------------------ */

  public AdminCategoryDetailDto create(AdminCategoryRequest req) {
    validateRules(req, null);
    checkSlugUnique(req.getSlug(), null);
    Category c = new Category();
    applyFields(c, req);
    c.setCreatedAt(Instant.now());
    return toDetail(categoryRepository.save(c));
  }

  public AdminCategoryDetailDto update(String id, AdminCategoryRequest req) {
    Category c = findCategory(id);
    validateRules(req, id);
    checkSlugUnique(req.getSlug(), id);
    applyFields(c, req);
    return toDetail(categoryRepository.save(c));
  }

  /* ------------------------------ Xóa / Patch / Move ------------------------------ */

  /** Thứ tự kiểm §5: còn danh mục con → 409 HAS_CHILDREN; còn sản phẩm → 409 HAS_PRODUCTS. */
  public void delete(String id) {
    Category c = findCategory(id);
    long childCount = categoryRepository.countByParentId(id);
    if (childCount > 0) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "HAS_CHILDREN",
          "Danh mục đang có danh mục con nên chưa thể xóa.",
          null,
          Map.of("childCount", childCount));
    }
    long productCount = productRepository.countByCategoryId(id);
    if (productCount > 0) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "HAS_PRODUCTS",
          "Danh mục đang có sản phẩm nên không thể xóa.",
          null,
          Map.of("productCount", productCount));
    }
    categoryRepository.delete(c);
  }

  /** PATCH: { active } — ẩn/hiện phía khách hàng, không ảnh hưởng sản phẩm. */
  public AdminCategoryDto patch(String id, AdminCategoryPatchRequest req) {
    Category c = findCategory(id);
    if (req != null && req.getActive() != null) {
      c.setActive(req.getActive());
      c = categoryRepository.save(c);
    }
    return toDto(c, productRepository.countByCategoryId(id));
  }

  /**
   * PATCH /{id}/move — hoán đổi sortOrder với anh em kề trên/dưới trong CÙNG
   * nhóm parentId, rồi chuẩn hoá cả nhóm thành 1..n. Ở biên nhóm: không lỗi,
   * trả lại nhóm đã chuẩn hoá (FE đã disabled nút tương ứng).
   */
  public List<AdminCategoryMoveItemDto> move(String id, AdminCategoryMoveRequest req) {
    Category c = findCategory(id);
    String direction = req == null ? null : req.getDirection();
    if (!"up".equals(direction) && !"down".equals(direction)) {
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "VALIDATION_ERROR",
          "Hướng di chuyển phải là \"up\" hoặc \"down\".",
          "direction");
    }
    List<Category> siblings = siblingsOf(c.getParentId());
    int idx = -1;
    for (int i = 0; i < siblings.size(); i++) {
      if (siblings.get(i).getId().equals(id)) {
        idx = i;
        break;
      }
    }
    int swapIdx = "up".equals(direction) ? idx - 1 : idx + 1;
    if (idx >= 0 && swapIdx >= 0 && swapIdx < siblings.size()) {
      // Thao tác trên instance TRONG danh sách anh em (instance của findCategory
      // là bản khác — sửa nhầm bản đó sẽ không được lưu khi chuẩn hoá).
      Category target = siblings.get(idx);
      Category other = siblings.get(swapIdx);
      int tmp = target.getSortOrder();
      target.setSortOrder(other.getSortOrder());
      other.setSortOrder(tmp);
      categoryRepository.save(target);
      categoryRepository.save(other);
      siblings.sort(BY_ORDER_THEN_NAME);
    }
    // Chuẩn hoá dãy liên tục 1..n cho cả nhóm (§4).
    List<AdminCategoryMoveItemDto> result = new ArrayList<>();
    for (int i = 0; i < siblings.size(); i++) {
      Category s = siblings.get(i);
      if (s.getSortOrder() != i + 1) {
        s.setSortOrder(i + 1);
        categoryRepository.save(s);
      }
      result.add(new AdminCategoryMoveItemDto(s.getId(), s.getSortOrder()));
    }
    return result;
  }

  /* ------------------------------ Upload ảnh ------------------------------ */

  /**
   * POST /admin/categories/images — lưu file qua StorageService (subdir "categories"),
   * trả { url } (≤5MB; JPG/PNG/WebP) — pattern upload dùng chung với màn 15.
   * URL dạng /uploads/categories/... ở chế độ local, URL S3/CDN ở chế độ s3.
   */
  public Map<String, String> uploadImage(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "NO_FILE", "Vui lòng chọn một ảnh.");
    }
    if (file.getSize() > MAX_IMAGE_BYTES) {
      throw new ApiException(
          HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Mỗi ảnh không được vượt quá 5MB.");
    }
    String contentType = file.getContentType();
    if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType.toLowerCase())) {
      throw new ApiException(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          "INVALID_FILE_TYPE",
          "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.");
    }
    return Map.of("url", storageService.store(file, "categories"));
  }

  /* ------------------------------ Validate F-015 ------------------------------ */

  private void validateRules(AdminCategoryRequest req, String excludeId) {
    if (req == null) {
      throw unprocessable("Dữ liệu danh mục không hợp lệ.", null);
    }
    if (req.getName() == null || req.getName().isBlank()) {
      throw unprocessable("Tên danh mục là bắt buộc.", "name");
    }
    if (req.getName().trim().length() > 60) {
      throw unprocessable("Tên danh mục tối đa 60 ký tự.", "name");
    }
    if (req.getSlug() == null || req.getSlug().isBlank()) {
      throw unprocessable("Slug là bắt buộc.", "slug");
    }
    if (!req.getSlug().trim().matches("^[a-z0-9-]+$")) {
      throw unprocessable("Slug chỉ gồm chữ thường, số và dấu gạch ngang.", "slug");
    }
    if (req.getSortOrder() != null && req.getSortOrder() < 0) {
      throw unprocessable("Thứ tự hiển thị phải lớn hơn hoặc bằng 0.", "sortOrder");
    }
    String parentId = req.getParentId();
    if (parentId != null && !parentId.isBlank()) {
      if (parentId.equals(excludeId)) {
        throw unprocessable("Danh mục cha không hợp lệ.", "parentId");
      }
      Category parent =
          categoryRepository
              .findById(parentId)
              .orElseThrow(() -> unprocessable("Danh mục cha không hợp lệ.", "parentId"));
      // Cha phải là danh mục GỐC — cha là danh mục con sẽ sinh cấp 3 (F-015).
      if (parent.getParentId() != null) {
        throw unprocessable(
            "Danh mục cha phải là danh mục gốc. Cây danh mục chỉ có 2 cấp.", "parentId");
      }
      // Danh mục đang có con mà bị gán cha → các con thành cấp 3.
      if (excludeId != null && categoryRepository.countByParentId(excludeId) > 0) {
        throw unprocessable(
            "Danh mục đang có danh mục con nên không thể chuyển thành danh mục con.", "parentId");
      }
    }
  }

  private void checkSlugUnique(String slug, String excludeId) {
    String normalized = slug.trim();
    boolean dup =
        excludeId == null
            ? categoryRepository.existsBySlug(normalized)
            : categoryRepository.existsBySlugAndIdNot(normalized, excludeId);
    if (dup) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "SLUG_EXISTS",
          "Slug đã được dùng bởi danh mục khác.",
          "slug");
    }
  }

  private ApiException unprocessable(String message, String field) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message, field);
  }

  /* ------------------------------ Mapping / helpers ------------------------------ */

  private Category findCategory(String id) {
    return categoryRepository
        .findById(id)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Không tìm thấy danh mục."));
  }

  private void applyFields(Category c, AdminCategoryRequest req) {
    c.setName(req.getName().trim());
    c.setSlug(req.getSlug().trim());
    c.setParentId(
        req.getParentId() == null || req.getParentId().isBlank() ? null : req.getParentId());
    c.setImageUrl(req.getImageUrl());
    // Thêm mới chưa nhập thứ tự → gợi ý cuối nhóm anh em (max + 1, §3).
    if (req.getSortOrder() != null) {
      c.setSortOrder(req.getSortOrder());
    } else if (c.getId() == null) {
      c.setSortOrder(
          siblingsOf(c.getParentId()).stream().mapToInt(Category::getSortOrder).max().orElse(0) + 1);
    }
    c.setActive(req.isActive());
  }

  /** Nhóm anh em cùng parentId (null = các danh mục gốc), đã sort theo thứ tự hiển thị. */
  private List<Category> siblingsOf(String parentId) {
    List<Category> siblings =
        parentId == null
            ? categoryRepository.findAll().stream().filter(c -> c.getParentId() == null).toList()
            : categoryRepository.findByParentId(parentId);
    List<Category> sorted = new ArrayList<>(siblings);
    sorted.sort(BY_ORDER_THEN_NAME);
    return sorted;
  }

  private AdminCategoryDto toDto(Category c, long productCount) {
    AdminCategoryDto dto = new AdminCategoryDto();
    dto.setId(c.getId());
    dto.setName(c.getName());
    dto.setSlug(c.getSlug());
    dto.setParentId(c.getParentId());
    dto.setImageUrl(c.getImageUrl());
    dto.setSortOrder(c.getSortOrder());
    dto.setActive(c.isActive());
    dto.setProductCount(productCount);
    dto.setHasChildren(categoryRepository.countByParentId(c.getId()) > 0);
    dto.setCreatedAt(c.getCreatedAt());
    return dto;
  }

  private AdminCategoryDetailDto toDetail(Category c) {
    AdminCategoryDetailDto dto = new AdminCategoryDetailDto();
    dto.setId(c.getId());
    dto.setName(c.getName());
    dto.setSlug(c.getSlug());
    dto.setParentId(c.getParentId());
    dto.setImageUrl(c.getImageUrl());
    dto.setSortOrder(c.getSortOrder());
    dto.setActive(c.isActive());
    return dto;
  }
}
