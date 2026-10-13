package com.mocan.shop.service;

import com.mocan.shop.dto.AdminFlashSaleActiveRequest;
import com.mocan.shop.dto.AdminFlashSaleDto;
import com.mocan.shop.dto.AdminFlashSaleListResponseDto;
import com.mocan.shop.dto.AdminFlashSaleRequest;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.model.Voucher;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import com.mocan.shop.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Quản lý chương trình flash sale (admin) — FR-028 · F-022 · US-019
 * (admin-flash-sale-shipping.md §2, §3, §4, §8).
 * Chỉ quản lý Voucher type=FLASH_SALE trong collection vouchers dùng chung:
 * danh sách màn này KHÔNG bao giờ có voucher thường (đối xứng màn 19), nhưng
 * `code` vẫn unique TOÀN CỤC (02-ERD §3) — server tự sinh FS-XXXXXX và tự
 * sinh lại khi trùng, không đẩy lỗi đó cho admin (§3.2).
 * Trạng thái hiển thị SUY RA: active=false -> INACTIVE; còn lại dùng đúng
 * FlashSaleService.statusOf (UPCOMING | ENDED | RUNNING) — lọc status làm ở
 * service để phân trang đúng. Logic resolve giá / claim suất phía khách giữ
 * nguyên ở FlashSaleService: resolve theo active + khung giờ + suất, nên
 * PATCH active=false của chương trình đang chạy có hiệu lực ngay (§4.1).
 * Ma trận khóa trường §3.5 được enforce ở tầng server khi PUT: chương trình
 * ĐANG CHẠY chỉ được đổi name/active, TĂNG giới hạn, RÚT NGẮN endAt; chương
 * trình ĐÃ KẾT THÚC chỉ-đọc toàn bộ.
 */
@Service
@RequiredArgsConstructor
public class AdminFlashSaleService {

  public static final String STATUS_RUNNING = "RUNNING";
  public static final String STATUS_UPCOMING = "UPCOMING";
  public static final String STATUS_ENDED = "ENDED";
  public static final String STATUS_INACTIVE = "INACTIVE";
  private static final Set<String> STATUSES =
      Set.of(STATUS_RUNNING, STATUS_UPCOMING, STATUS_ENDED, STATUS_INACTIVE);
  private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  private static final SecureRandom RANDOM = new SecureRandom();

  private final VoucherRepository voucherRepository;
  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;
  private final OrderRepository orderRepository;
  private final FlashSaleService flashSaleService;

  /* ------------------------------ Trạng thái suy ra (§2.3) ------------------------------ */

  /** Ưu tiên: Đã tắt (active=false) trên cùng; còn lại theo FlashSaleService.statusOf. */
  public String statusOf(Voucher v, Instant now) {
    if (!v.isActive()) return STATUS_INACTIVE;
    return flashSaleService.statusOf(v, now);
  }

  /* ------------------------------ Danh sách ------------------------------ */

  /**
   * GET /admin/flash-sales — lọc q (theo name, không phân biệt hoa thường) +
   * status (suy ra §2.3) ở service, sort "field,dir"
   * (name | startAt | usedCount; mặc định startAt,desc), page 0-indexed.
   */
  public AdminFlashSaleListResponseDto list(
      String q, String status, int page, int size, String sort) {
    Instant now = Instant.now();
    String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
    String statusFilter =
        status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
    if (statusFilter != null && !STATUSES.contains(statusFilter)) {
      throw unprocessable("Trạng thái lọc không hợp lệ.", "status");
    }

    List<Voucher> filtered =
        voucherRepository.findAll().stream()
            .filter(v -> "FLASH_SALE".equals(normalizeType(v.getType())))
            .filter(v -> needle.isEmpty()
                || (v.getName() != null && v.getName().toLowerCase(Locale.ROOT).contains(needle)))
            .filter(v -> statusFilter == null || statusFilter.equals(statusOf(v, now)))
            .sorted(comparatorFor(sort))
            .toList();

    int safeSize = Math.min(50, Math.max(1, size));
    int safePage = Math.max(0, page);
    int from = Math.min(safePage * safeSize, filtered.size());
    int to = Math.min(from + safeSize, filtered.size());

    AdminFlashSaleListResponseDto res = new AdminFlashSaleListResponseDto();
    res.setItems(filtered.subList(from, to).stream().map(this::toDto).toList());
    res.setTotal(filtered.size());
    res.setPage(safePage);
    res.setSize(safeSize);
    return res;
  }

  /** Sort "field,dir": field thuộc {name, startAt, usedCount}; mặc định startAt,desc (§2.2). */
  private Comparator<Voucher> comparatorFor(String sort) {
    String field = "startAt";
    boolean desc = true;
    if (sort != null && !sort.isBlank()) {
      String[] parts = sort.split(",");
      if (parts.length > 0 && !parts[0].isBlank()) field = parts[0].trim();
      desc = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim());
      if (parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())) desc = false;
      if (parts.length == 1) desc = false;
    }
    Comparator<Voucher> cmp =
        switch (field) {
          case "name" ->
              Comparator.comparing(
                  (Voucher v) -> v.getName() == null ? "" : v.getName(),
                  String.CASE_INSENSITIVE_ORDER);
          case "usedCount" -> Comparator.comparingInt(Voucher::getUsedCount);
          default ->
              Comparator.comparing(
                  Voucher::getStartAt, Comparator.nullsLast(Comparator.naturalOrder()));
        };
    return desc ? cmp.reversed() : cmp;
  }

  /* ------------------------------ Chi tiết / Tạo / Sửa ------------------------------ */

  public AdminFlashSaleDto get(String id) {
    return toDto(findProgram(id));
  }

  public AdminFlashSaleDto create(AdminFlashSaleRequest req) {
    ValidatedInput in = validate(req, null);
    checkScheduleOverlap(in, null);
    Voucher v = new Voucher();
    v.setCode(generateUniqueCode());
    v.setType("FLASH_SALE");
    applyFields(v, in);
    v.setUsedCount(0);
    return toDto(voucherRepository.save(v));
  }

  public AdminFlashSaleDto update(String id, AdminFlashSaleRequest req) {
    Voucher v = findProgram(id);
    String status = statusOf(v, Instant.now());
    if (STATUS_ENDED.equals(status)) {
      throw unprocessable("Chương trình đã kết thúc — chỉ xem, không sửa được.", null);
    }
    ValidatedInput in = validate(req, v);
    if (STATUS_RUNNING.equals(status)
        || (STATUS_INACTIVE.equals(status) && v.getUsedCount() > 0)) {
      enforceRunningLocks(v, in);
    }
    checkScheduleOverlap(in, id);
    // itemSoldCount là số liệu bán hàng — giữ nguyên theo khóa (productId, variantId)
    // của chương trình hiện tại, không nhận từ client.
    preserveSoldCounts(v, in.items());
    applyFields(v, in);
    return toDto(voucherRepository.save(v));
  }

  /* ------------------------------ Bật/tắt · Xóa (§4) ------------------------------ */

  /** PATCH /{id}/active — tắt chương trình đang chạy có hiệu lực ngay phía khách. */
  public AdminFlashSaleDto patchActive(String id, AdminFlashSaleActiveRequest req) {
    Voucher v = findProgram(id);
    if (req == null || req.getActive() == null) {
      throw unprocessable("Thiếu trạng thái kích hoạt.", "active");
    }
    if (Boolean.TRUE.equals(req.getActive())) {
      // Bật lại 1 chương trình đang bật khác đang chồng lịch -> 422 như khi lưu (§3.2).
      ValidatedInput self = new ValidatedInput(
          v.getName(), v.getStartAt(), v.getEndAt(), v.getTotalUsageLimit(), true, List.of());
      checkScheduleOverlap(self, id);
    }
    v.setActive(req.getActive());
    return toDto(voucherRepository.save(v));
  }

  /**
   * DELETE — chỉ khi CHƯA bắt đầu (now < startAt, kể cả đang tắt) VÀ
   * usedCount = 0 VÀ mọi itemSoldCount = 0 VÀ không đơn nào tham chiếu
   * chương trình (§4.2). Không thỏa -> 409 kèm lý do đúng case.
   */
  public void delete(String id) {
    Voucher v = findProgram(id);
    Instant now = Instant.now();
    boolean sold = v.getUsedCount() > 0
        || flashSaleService.effectiveItems(v).stream().anyMatch(i -> i.getItemSoldCount() > 0)
        || orderRepository.existsByItemFlashSaleProgramId(id);
    if (sold) {
      throw new ApiException(HttpStatus.CONFLICT, "FLASH_SALE_USED",
          "Chương trình đã có lượt bán — chỉ có thể tắt, không thể xóa.");
    }
    if (v.getStartAt() != null && !now.isBefore(v.getStartAt())) {
      if (v.getEndAt() != null && !now.isBefore(v.getEndAt())) {
        throw new ApiException(HttpStatus.CONFLICT, "FLASH_SALE_ENDED",
            "Chương trình đã kết thúc — giữ lại làm lịch sử, không thể xóa.");
      }
      throw new ApiException(HttpStatus.CONFLICT, "FLASH_SALE_RUNNING",
          "Chương trình đang chạy — hãy tắt chương trình thay vì xóa.");
    }
    voucherRepository.delete(v);
  }

  /* ------------------------------ Validate (§3) ------------------------------ */

  private record ValidatedInput(
      String name,
      Instant startAt,
      Instant endAt,
      int totalUsageLimit,
      boolean active,
      List<Voucher.FlashSaleItem> items) {}

  private ValidatedInput validate(AdminFlashSaleRequest req, Voucher current) {
    if (req == null) {
      throw unprocessable("Dữ liệu chương trình không hợp lệ.", null);
    }
    // Tên nội bộ: bắt buộc 3–80 ký tự (§3.2).
    String name = req.getName() == null ? "" : req.getName().trim();
    if (name.length() < 3 || name.length() > 80) {
      throw unprocessable("Tên chương trình phải từ 3 đến 80 ký tự.", "name");
    }
    // Khung giờ: bắt buộc, endAt > startAt (§3.2, như F-018).
    if (req.getStartAt() == null) {
      throw unprocessable("Thời gian bắt đầu là bắt buộc.", "startAt");
    }
    if (req.getEndAt() == null) {
      throw unprocessable("Thời gian kết thúc là bắt buộc.", "endAt");
    }
    if (!req.getEndAt().isAfter(req.getStartAt())) {
      throw unprocessable("Thời gian kết thúc phải sau thời gian bắt đầu.", "endAt");
    }
    // Tổng suất: null/0 = không giới hạn; có giới hạn thì >= 1 và không nhỏ
    // hơn usedCount hiện tại khi sửa (§3.2).
    int totalUsageLimit = req.getTotalUsageLimit() != null ? req.getTotalUsageLimit() : 0;
    if (totalUsageLimit < 0) {
      throw unprocessable("Tổng suất không được âm.", "totalUsageLimit");
    }
    int usedCount = current != null ? current.getUsedCount() : 0;
    if (totalUsageLimit > 0 && totalUsageLimit < usedCount) {
      throw unprocessable(
          "Tổng suất phải từ " + usedCount + " trở lên (đã bán " + usedCount + ").",
          "totalUsageLimit");
    }
    // Sản phẩm tham gia: ít nhất 1 món (§3.4).
    if (req.getItems() == null || req.getItems().isEmpty()) {
      throw unprocessable("Chương trình cần ít nhất 1 sản phẩm.", "items");
    }
    List<Voucher.FlashSaleItem> items = new ArrayList<>();
    Set<String> keys = new HashSet<>();
    for (AdminFlashSaleRequest.ItemRequest ir : req.getItems()) {
      items.add(validateItem(ir, keys));
    }
    return new ValidatedInput(
        name,
        req.getStartAt(),
        req.getEndAt(),
        totalUsageLimit,
        req.getActive() == null || req.getActive(),
        items);
  }

  private Voucher.FlashSaleItem validateItem(
      AdminFlashSaleRequest.ItemRequest ir, Set<String> keys) {
    if (ir == null || ir.getProductId() == null || ir.getProductId().isBlank()) {
      throw unprocessable("Sản phẩm tham gia là bắt buộc.", "items");
    }
    Product product = productRepository.findById(ir.getProductId())
        .orElseThrow(() -> unprocessable("Không tìm thấy sản phẩm tham gia.", "items"));
    if (!product.isActive()) {
      throw unprocessable("Sản phẩm \"" + product.getName() + "\" đang ngừng bán.", "items");
    }
    List<ProductVariant> variants = variantRepository.findByProductId(product.getId());
    ProductVariant scoped = null;
    if (ir.getVariantId() != null) {
      scoped = variants.stream()
          .filter(pv -> ir.getVariantId().equals(pv.getId()))
          .findFirst()
          .orElseThrow(() -> unprocessable(
              "Màu đã chọn không thuộc sản phẩm \"" + product.getName() + "\".", "items"));
    }
    // Không trùng khóa (productId, variantId) — thẻ "mọi màu" khóa cả sản phẩm (§3.4).
    String key = ir.getProductId() + "|" + (ir.getVariantId() == null ? "*" : ir.getVariantId());
    boolean dup;
    if (ir.getVariantId() == null) {
      dup = keys.stream().anyMatch(k -> k.startsWith(ir.getProductId() + "|"));
    } else {
      dup = keys.contains(key) || keys.contains(ir.getProductId() + "|*");
    }
    keys.add(key);
    if (dup) {
      throw unprocessable("Sản phẩm/màu này đã có trong chương trình.", "items");
    }
    // Đúng 1 kiểu giảm: flashPrice XOR discountPercent (§3.4).
    boolean hasFixed = ir.getFlashPrice() != null;
    boolean hasPercent = ir.getDiscountPercent() != null;
    if (hasFixed == hasPercent) {
      throw unprocessable(
          "Mỗi sản phẩm chỉ chọn 1 kiểu giảm: giá flash cố định hoặc giảm %.", "items");
    }
    // Giá tham chiếu của phạm vi áp dụng: màu đã chọn, hoặc giá THẤP NHẤT
    // trong các màu khi áp mọi màu (§3.4).
    BigDecimal refPrice = scoped != null
        ? scoped.getPrice()
        : variants.stream().map(ProductVariant::getPrice)
            .filter(p -> p != null).min(Comparator.naturalOrder()).orElse(null);
    if (hasFixed) {
      if (ir.getFlashPrice().compareTo(BigDecimal.ZERO) <= 0) {
        throw unprocessable("Giá flash phải lớn hơn 0đ.", "items");
      }
      if (refPrice != null && ir.getFlashPrice().compareTo(refPrice) >= 0) {
        throw unprocessable(
            "Giá flash phải nhỏ hơn giá bán (" + formatMoney(refPrice) + ").", "items");
      }
    } else {
      BigDecimal pct = ir.getDiscountPercent();
      if (pct.compareTo(BigDecimal.ONE) < 0 || pct.compareTo(BigDecimal.valueOf(99)) > 0
          || pct.stripTrailingZeros().scale() > 0) {
        throw unprocessable("% giảm phải từ 1 đến 99.", "items");
      }
      if (ir.getMaxDiscount() != null && ir.getMaxDiscount().compareTo(BigDecimal.ZERO) <= 0) {
        throw unprocessable("Mức giảm tối đa phải lớn hơn 0đ.", "items");
      }
    }
    if (ir.getItemQuota() != null && ir.getItemQuota() < 1) {
      throw unprocessable("Suất riêng của món phải từ 1 trở lên.", "items");
    }
    Voucher.FlashSaleItem item = new Voucher.FlashSaleItem();
    item.setProductId(ir.getProductId());
    item.setVariantId(ir.getVariantId());
    item.setFlashPrice(hasFixed ? ir.getFlashPrice() : null);
    item.setDiscountPercent(hasPercent ? ir.getDiscountPercent() : null);
    item.setMaxDiscount(hasPercent ? ir.getMaxDiscount() : null);
    item.setItemQuota(ir.getItemQuota());
    item.setItemSoldCount(0);
    return item;
  }

  /**
   * Ma trận khóa §3.5 cho chương trình ĐANG CHẠY (hoặc đã tắt nhưng đã bán):
   * khóa startAt, danh sách món, phạm vi màu, kiểu giảm/giá/% của món đã có;
   * giới hạn chỉ được TĂNG (không giảm xuống dưới đã bán — validate() đã chặn
   * dưới usedCount, ở đây chặn mọi chiều giảm so với giá trị hiện tại).
   */
  private void enforceRunningLocks(Voucher v, ValidatedInput in) {
    if (v.getStartAt() != null && !v.getStartAt().equals(in.startAt())) {
      throw unprocessable(
          "Chương trình đang chạy nên không đổi được thời gian bắt đầu.", "startAt");
    }
    if (in.totalUsageLimit() != 0
        && v.getTotalUsageLimit() != 0
        && in.totalUsageLimit() < v.getTotalUsageLimit()) {
      throw unprocessable(
          "Chương trình đang chạy nên chỉ tăng được tổng suất, không giảm.", "totalUsageLimit");
    }
    if (in.totalUsageLimit() == 0 && v.getTotalUsageLimit() != 0 && v.getUsedCount() > 0) {
      // Bỏ giới hạn = nới trần — được phép (tương đương tăng lên vô hạn).
    }
    List<Voucher.FlashSaleItem> currentItems = flashSaleService.effectiveItems(v);
    if (in.items().size() != currentItems.size()) {
      throw unprocessable(
          "Chương trình đang chạy nên không thêm/xóa được sản phẩm.", "items");
    }
    for (Voucher.FlashSaleItem next : in.items()) {
      Voucher.FlashSaleItem cur = currentItems.stream()
          .filter(i -> i.getProductId().equals(next.getProductId())
              && java.util.Objects.equals(i.getVariantId(), next.getVariantId()))
          .findFirst()
          .orElseThrow(() -> unprocessable(
              "Chương trình đang chạy nên không đổi được danh sách sản phẩm/màu.", "items"));
      if (!sameMoney(cur.getFlashPrice(), next.getFlashPrice())
          || !sameMoney(cur.getDiscountPercent(), next.getDiscountPercent())
          || !sameMoney(cur.getMaxDiscount(), next.getMaxDiscount())) {
        throw unprocessable(
            "Chương trình đang chạy nên giá flash của sản phẩm đã khóa.", "items");
      }
      if (next.getItemQuota() != null && cur.getItemQuota() != null
          && next.getItemQuota() < cur.getItemQuota()) {
        throw unprocessable(
            "Chương trình đang chạy nên chỉ tăng được suất riêng của món.", "items");
      }
      if (next.getItemQuota() != null && cur.getItemQuota() == null) {
        throw unprocessable(
            "Chương trình đang chạy nên không đặt thêm suất riêng cho món đang không giới hạn.",
            "items");
      }
    }
  }

  /** Giữ itemSoldCount theo khóa (productId, variantId) khi lưu form sửa. */
  private void preserveSoldCounts(Voucher v, List<Voucher.FlashSaleItem> nextItems) {
    List<Voucher.FlashSaleItem> currentItems =
        v.getItems() != null ? v.getItems() : List.of();
    for (Voucher.FlashSaleItem next : nextItems) {
      currentItems.stream()
          .filter(i -> i.getProductId().equals(next.getProductId())
              && java.util.Objects.equals(i.getVariantId(), next.getVariantId()))
          .findFirst()
          .ifPresent(cur -> next.setItemSoldCount(cur.getItemSoldCount()));
    }
  }

  /**
   * Trùng lịch (§3.2): chương trình đang active không được chồng [startAt, endAt)
   * với chương trình FLASH_SALE active nào khác — phía khách chỉ hiện 1 chương
   * trình hiện hành. Chương trình đã tắt không tham gia kiểm tra.
   */
  private void checkScheduleOverlap(ValidatedInput in, String excludeId) {
    if (!in.active() || in.startAt() == null || in.endAt() == null) return;
    for (Voucher other : voucherRepository.findByTypeAndActiveTrue("FLASH_SALE")) {
      if (excludeId != null && excludeId.equals(other.getId())) continue;
      if (other.getStartAt() == null || other.getEndAt() == null) continue;
      boolean overlap = in.startAt().isBefore(other.getEndAt())
          && other.getStartAt().isBefore(in.endAt());
      if (overlap) {
        throw unprocessable(
            "Khung giờ trùng với chương trình \"" + other.getName() + "\" ("
                + formatDateTime(other.getStartAt()) + " – " + formatDateTime(other.getEndAt())
                + "). Hãy đổi khung giờ hoặc tắt chương trình đó trước.",
            "startAt");
      }
    }
  }

  /** Mã tự sinh FS-XXXXXX, unique toàn cục — trùng thì sinh lại (§3.2, §8). */
  private String generateUniqueCode() {
    for (int attempt = 0; attempt < 20; attempt++) {
      StringBuilder sb = new StringBuilder("FS-");
      for (int i = 0; i < 6; i++) {
        sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
      }
      String code = sb.toString();
      if (voucherRepository.findByCode(code).isEmpty()) return code;
    }
    throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "CODE_GENERATION_FAILED",
        "Không sinh được mã chương trình. Vui lòng thử lại.");
  }

  /* ------------------------------ Mapping / helpers ------------------------------ */

  private Voucher findProgram(String id) {
    Voucher v = voucherRepository.findById(id)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "FLASH_SALE_NOT_FOUND",
            "Không tìm thấy chương trình flash sale."));
    if (!"FLASH_SALE".equals(normalizeType(v.getType()))) {
      throw new ApiException(HttpStatus.NOT_FOUND, "FLASH_SALE_NOT_FOUND",
          "Không tìm thấy chương trình flash sale.");
    }
    return v;
  }

  private void applyFields(Voucher v, ValidatedInput in) {
    v.setName(in.name());
    v.setStartAt(in.startAt());
    v.setEndAt(in.endAt());
    v.setTotalUsageLimit(in.totalUsageLimit());
    v.setActive(in.active());
    v.setItems(in.items());
    // Đồng bộ fallback legacy (§10.7): danh sách sản phẩm suy từ items[].
    v.setApplicableProductIds(
        in.items().stream().map(Voucher.FlashSaleItem::getProductId).distinct().toList());
  }

  private AdminFlashSaleDto toDto(Voucher v) {
    AdminFlashSaleDto dto = new AdminFlashSaleDto();
    dto.setId(v.getId());
    dto.setCode(v.getCode());
    dto.setName(v.getName());
    dto.setStartAt(v.getStartAt());
    dto.setEndAt(v.getEndAt());
    dto.setTotalUsageLimit(v.getTotalUsageLimit());
    dto.setUsedCount(v.getUsedCount());
    dto.setActive(v.isActive());
    dto.setStatus(statusOf(v, Instant.now()));
    // items hiệu lực: chương trình legacy chưa có items[] -> suy từ fallback
    // (§10.7) để form sửa luôn nhận đủ cấu trúc.
    List<Voucher.FlashSaleItem> items = flashSaleService.effectiveItems(v);
    dto.setItemCount(items.size());
    dto.setItems(items.stream().map(this::toItemDto).toList());
    return dto;
  }

  private AdminFlashSaleDto.ItemDto toItemDto(Voucher.FlashSaleItem item) {
    AdminFlashSaleDto.ItemDto d = new AdminFlashSaleDto.ItemDto();
    d.setProductId(item.getProductId());
    d.setVariantId(item.getVariantId());
    d.setFlashPrice(item.getFlashPrice());
    d.setDiscountPercent(item.getDiscountPercent());
    d.setMaxDiscount(item.getMaxDiscount());
    d.setItemQuota(item.getItemQuota());
    d.setItemSoldCount(item.getItemSoldCount());
    Product product = item.getProductId() != null
        ? productRepository.findById(item.getProductId()).orElse(null) : null;
    if (product != null) {
      d.setProductName(product.getName());
      if (product.getImages() != null && !product.getImages().isEmpty()) {
        d.setImage(product.getImages().stream()
            .min(Comparator.comparingInt(Product.ProductImage::getSortOrder))
            .map(Product.ProductImage::getUrl).orElse(null));
      }
      List<ProductVariant> variants = variantRepository.findByProductId(product.getId());
      if (item.getVariantId() != null) {
        variants.stream().filter(pv -> item.getVariantId().equals(pv.getId())).findFirst()
            .ifPresent(pv -> {
              d.setColor(pv.getColor());
              d.setOriginalPrice(pv.getPrice());
            });
      } else {
        // Variant mặc định F-004: màu còn hàng rẻ nhất, không còn hàng thì rẻ nhất.
        ProductVariant def = variants.stream().filter(pv -> pv.getStock() > 0)
            .min(Comparator.comparing(ProductVariant::getPrice,
                Comparator.nullsLast(Comparator.naturalOrder())))
            .orElseGet(() -> variants.stream()
                .min(Comparator.comparing(ProductVariant::getPrice,
                    Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null));
        if (def != null) d.setOriginalPrice(def.getPrice());
      }
    }
    return d;
  }

  private ApiException unprocessable(String message, String field) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message, field);
  }

  private boolean sameMoney(BigDecimal a, BigDecimal b) {
    if (a == null || b == null) return a == b;
    return a.compareTo(b) == 0;
  }

  private String normalizeType(String type) {
    return type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
  }

  private String formatMoney(BigDecimal v) {
    return new java.text.DecimalFormat("#,##0", new java.text.DecimalFormatSymbols(Locale.forLanguageTag("vi-VN")))
        .format(v) + "đ";
  }

  private String formatDateTime(Instant instant) {
    return java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
        .withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
        .format(instant);
  }
}
