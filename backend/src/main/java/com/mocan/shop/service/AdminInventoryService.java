package com.mocan.shop.service;

import com.mocan.shop.dto.AdminInventoryAdjustRequest;
import com.mocan.shop.dto.AdminInventoryCountsDto;
import com.mocan.shop.dto.AdminInventoryItemDto;
import com.mocan.shop.dto.AdminInventoryListResponseDto;
import com.mocan.shop.dto.AdminInventoryThresholdRequest;
import com.mocan.shop.dto.AdminInventoryUpdateResponseDto;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Category;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.repository.CategoryRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Quản lý tồn kho (admin) — FR-023 · F-017 · US-015 (admin-ton-kho.md §9).
 *
 * Đơn vị dữ liệu: 1 biến thể màu (tồn kho theo dõi đến cấp màu — QĐ 2026-10-10).
 * Trạng thái theo §2.1, tính từ stock + lowStockThreshold CỦA TỪNG variant:
 * stock = 0 → hết hàng · 0 < stock <= ngưỡng → sắp hết · còn lại → còn hàng.
 * Nhóm "sắp hết" cho counts/KPI = stock <= ngưỡng (GỒM cả hết hàng).
 *
 * Điều chỉnh tồn (§5): 3 chế độ RECEIVE/REMOVE/SET, tồn không bao giờ âm,
 * chống ghi đè bằng expectedStock (không khớp → 409 STOCK_CHANGED kèm
 * currentStock — cùng nguyên tắc nguyên tử FR-011/NFR-002).
 * Lịch sử biến động: ERD chưa có entity log (F-017 mới ở mức [Giả định]) nên
 * CHỈ ghi log ở mức service log, KHÔNG tạo collection mới ngoài docs (§8).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminInventoryService {

  private static final Set<String> MODES = Set.of("RECEIVE", "REMOVE", "SET");
  private static final Set<String> REASONS =
      Set.of("RESTOCK", "STOCKTAKE", "DAMAGED", "RETURN", "DISPOSAL", "OTHER");
  private static final int MAX_NOTE_LENGTH = 200;

  private final ProductVariantRepository variantRepository;
  private final ProductRepository productRepository;
  private final CategoryRepository categoryRepository;

  /* ------------------------------ Danh sách ------------------------------ */

  /**
   * GET /admin/inventory — lọc status/q/categoryId, sort, phân trang 1-indexed.
   * `counts` tính trên tập đã lọc bởi q + categoryId (bỏ qua status) — §9.
   * Lọc theo danh mục cha gồm cả sản phẩm thuộc danh mục con (cây 2 cấp F-015).
   */
  public AdminInventoryListResponseDto list(
      String status, String q, String categoryId, String sort, int page, int size) {
    Map<String, Product> products = new HashMap<>();
    productRepository.findAll().forEach(p -> products.put(p.getId(), p));
    Map<String, Category> categories = new HashMap<>();
    categoryRepository.findAll().forEach(c -> categories.put(c.getId(), c));

    Set<String> categoryScope = null;
    if (categoryId != null && !categoryId.isBlank()) {
      categoryScope = new HashSet<>();
      categoryScope.add(categoryId);
      for (Category c : categories.values()) {
        if (categoryId.equals(c.getParentId())) {
          categoryScope.add(c.getId());
        }
      }
    }

    String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
    List<ProductVariant> base = new ArrayList<>();
    for (ProductVariant v : variantRepository.findAll()) {
      Product p = products.get(v.getProductId());
      if (categoryScope != null && (p == null || !categoryScope.contains(p.getCategoryId()))) {
        continue;
      }
      if (!needle.isEmpty()) {
        String name = p != null && p.getName() != null ? p.getName().toLowerCase(Locale.ROOT) : "";
        String color = v.getColor() != null ? v.getColor().toLowerCase(Locale.ROOT) : "";
        String sku = v.getSku() != null ? v.getSku().toLowerCase(Locale.ROOT) : "";
        if (!name.contains(needle) && !color.contains(needle) && !sku.contains(needle)) {
          continue;
        }
      }
      base.add(v);
    }

    AdminInventoryCountsDto counts = new AdminInventoryCountsDto();
    counts.setAll(base.size());
    counts.setLow(base.stream().filter(v -> v.getStock() <= v.getLowStockThreshold()).count());
    counts.setOut(base.stream().filter(v -> v.getStock() == 0).count());

    String st = status == null ? "all" : status.trim().toLowerCase(Locale.ROOT);
    List<ProductVariant> filtered = new ArrayList<>();
    for (ProductVariant v : base) {
      if ("low".equals(st) && v.getStock() > v.getLowStockThreshold()) {
        continue;
      }
      if ("out".equals(st) && v.getStock() != 0) {
        continue;
      }
      filtered.add(v);
    }

    filtered.sort(comparator(sort, products));

    int safeSize = Math.min(100, Math.max(1, size));
    int totalPages = Math.max(1, (int) Math.ceil((double) filtered.size() / safeSize));
    int safePage = Math.min(Math.max(1, page), totalPages);
    int from = Math.min((safePage - 1) * safeSize, filtered.size());
    int to = Math.min(from + safeSize, filtered.size());
    List<AdminInventoryItemDto> content = new ArrayList<>();
    for (ProductVariant v : filtered.subList(from, to)) {
      content.add(toItem(v, products.get(v.getProductId()), categories));
    }

    AdminInventoryListResponseDto res = new AdminInventoryListResponseDto();
    res.setContent(content);
    res.setTotalElements(filtered.size());
    res.setTotalPages(totalPages);
    res.setPage(safePage);
    res.setSize(safeSize);
    res.setCounts(counts);
    return res;
  }

  /** Mặc định stock_asc (khẩn cấp nhất lên đầu); hoà tồn → tên sản phẩm A–Z (§3.2). */
  private Comparator<ProductVariant> comparator(String sort, Map<String, Product> products) {
    Comparator<ProductVariant> byName =
        Comparator.comparing(
            (ProductVariant v) -> {
              Product p = products.get(v.getProductId());
              return p != null && p.getName() != null ? p.getName() : "";
            },
            String.CASE_INSENSITIVE_ORDER);
    String s = sort == null ? "stock_asc" : sort.trim().toLowerCase(Locale.ROOT);
    return switch (s) {
      case "stock_desc" ->
          Comparator.comparingInt(ProductVariant::getStock).reversed().thenComparing(byName);
      case "price_asc" ->
          Comparator.comparing(
                  ProductVariant::getPrice,
                  Comparator.nullsLast(Comparator.<BigDecimal>naturalOrder()))
              .thenComparing(byName);
      case "price_desc" ->
          Comparator.comparing(
                  ProductVariant::getPrice,
                  Comparator.nullsLast(Comparator.<BigDecimal>reverseOrder()))
              .thenComparing(byName);
      case "name_asc" -> byName.thenComparing(ProductVariant::getColor,
          Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
      case "name_desc" -> byName.reversed().thenComparing(ProductVariant::getColor,
          Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
      default -> Comparator.comparingInt(ProductVariant::getStock).thenComparing(byName);
    };
  }

  /* --------------------------- Điều chỉnh tồn (§5) --------------------------- */

  public AdminInventoryUpdateResponseDto adjust(String variantId, AdminInventoryAdjustRequest req) {
    ProductVariant v = findVariant(variantId);
    if (req == null) {
      throw unprocessable("Dữ liệu điều chỉnh không hợp lệ.", null);
    }
    String mode = req.getMode() == null ? "" : req.getMode().trim().toUpperCase(Locale.ROOT);
    if (!MODES.contains(mode)) {
      throw unprocessable("Chế độ điều chỉnh phải là RECEIVE, REMOVE hoặc SET.", "mode");
    }
    String reason = req.getReason() == null ? "" : req.getReason().trim().toUpperCase(Locale.ROOT);
    if (!REASONS.contains(reason)) {
      throw unprocessable("Vui lòng chọn lý do điều chỉnh.", "reason");
    }
    String note = req.getNote() == null ? "" : req.getNote().trim();
    if (note.length() > MAX_NOTE_LENGTH) {
      throw unprocessable("Ghi chú tối đa 200 ký tự.", "note");
    }
    if ("OTHER".equals(reason) && note.isEmpty()) {
      throw unprocessable("Vui lòng ghi rõ lý do trong ô ghi chú.", "note");
    }

    int stock = v.getStock();
    int newStock;
    switch (mode) {
      case "RECEIVE" -> {
        if (req.getQty() == null || req.getQty() <= 0) {
          throw unprocessable("Số lượng nhập phải là số nguyên lớn hơn 0.", "qty");
        }
        newStock = stock + req.getQty();
      }
      case "REMOVE" -> {
        if (req.getQty() == null || req.getQty() <= 0) {
          throw unprocessable("Số lượng giảm phải là số nguyên lớn hơn 0.", "qty");
        }
        if (req.getQty() > stock) {
          throw unprocessable(
              "Số lượng giảm không được lớn hơn tồn hiện tại (" + stock + ").", "qty");
        }
        newStock = stock - req.getQty();
      }
      default -> { // SET
        if (req.getNewStock() == null || req.getNewStock() < 0) {
          throw unprocessable("Tồn thực tế phải là số nguyên lớn hơn hoặc bằng 0.", "newStock");
        }
        newStock = req.getNewStock();
      }
    }
    if (newStock < 0) {
      throw unprocessable("Tồn kho không được âm.", "qty");
    }

    // Chống ghi đè: tồn đã bị giao dịch khác thay đổi từ lúc admin mở modal.
    if (req.getExpectedStock() == null) {
      throw unprocessable("Thiếu số tồn tại thời điểm mở điều chỉnh.", "expectedStock");
    }
    if (req.getExpectedStock() != stock) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "STOCK_CHANGED",
          "Tồn kho vừa thay đổi do giao dịch khác.",
          null,
          Map.of("currentStock", stock));
    }

    v.setStock(newStock);
    variantRepository.save(v);
    // [Giả định theo F-017] Chưa có entity log biến động trong ERD — chỉ ghi
    // service log, không tạo collection mới (admin-ton-kho.md §8).
    log.info(
        "[Inventory] adjust variantId={} sku={} mode={} stockBefore={} stockAfter={} reason={} note={}",
        v.getId(), v.getSku(), mode, stock, newStock, reason, note.isEmpty() ? "-" : note);
    return toUpdateResponse(v);
  }

  /* ---------------------------- Sửa ngưỡng (§6) ---------------------------- */

  public AdminInventoryUpdateResponseDto updateThreshold(
      String variantId, AdminInventoryThresholdRequest req) {
    ProductVariant v = findVariant(variantId);
    if (req == null || req.getLowStockThreshold() == null || req.getLowStockThreshold() < 0) {
      throw unprocessable("Ngưỡng phải là số nguyên ≥ 0.", "lowStockThreshold");
    }
    int before = v.getLowStockThreshold();
    v.setLowStockThreshold(req.getLowStockThreshold());
    variantRepository.save(v);
    log.info(
        "[Inventory] threshold variantId={} sku={} thresholdBefore={} thresholdAfter={}",
        v.getId(), v.getSku(), before, v.getLowStockThreshold());
    return toUpdateResponse(v);
  }

  /* -------------------------------- Helpers -------------------------------- */

  private ProductVariant findVariant(String variantId) {
    return variantRepository
        .findById(variantId)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "VARIANT_NOT_FOUND", "Không tìm thấy biến thể."));
  }

  private ApiException unprocessable(String message, String field) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message, field);
  }

  private AdminInventoryItemDto toItem(
      ProductVariant v, Product p, Map<String, Category> categories) {
    AdminInventoryItemDto dto = new AdminInventoryItemDto();
    dto.setVariantId(v.getId());
    dto.setProductId(v.getProductId());
    dto.setProductName(p != null ? p.getName() : "");
    dto.setProductActive(p != null && p.isActive());
    dto.setCategoryId(p != null ? p.getCategoryId() : null);
    Category c = p != null ? categories.get(p.getCategoryId()) : null;
    dto.setCategoryName(c != null ? c.getName() : "");
    dto.setImage(firstImage(p));
    dto.setColor(v.getColor());
    dto.setColorHex(v.getColorHex());
    dto.setSku(v.getSku());
    dto.setPrice(v.getPrice());
    dto.setStock(v.getStock());
    dto.setLowStockThreshold(v.getLowStockThreshold());
    return dto;
  }

  private String firstImage(Product p) {
    if (p == null || p.getImages() == null || p.getImages().isEmpty()) {
      return null;
    }
    return p.getImages().stream()
        .sorted(Comparator.comparingInt(Product.ProductImage::getSortOrder))
        .findFirst()
        .map(Product.ProductImage::getUrl)
        .orElse(null);
  }

  private AdminInventoryUpdateResponseDto toUpdateResponse(ProductVariant v) {
    AdminInventoryUpdateResponseDto dto = new AdminInventoryUpdateResponseDto();
    dto.setVariantId(v.getId());
    dto.setStock(v.getStock());
    dto.setLowStockThreshold(v.getLowStockThreshold());
    return dto;
  }
}
