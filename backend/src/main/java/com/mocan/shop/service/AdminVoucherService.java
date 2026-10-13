package com.mocan.shop.service;

import com.mocan.shop.dto.AdminVoucherActiveRequest;
import com.mocan.shop.dto.AdminVoucherDto;
import com.mocan.shop.dto.AdminVoucherListResponseDto;
import com.mocan.shop.dto.AdminVoucherRequest;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Voucher;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Quản lý voucher (admin) — FR-024 · F-018 · US-017 (admin-voucher.md §6).
 * Chỉ quản lý voucher THƯỜNG (type PERCENT | FIXED): chương trình FLASH_SALE
 * dùng chung collection nhưng thuộc màn 22 — danh sách luôn loại ra, chi
 * tiết/sửa/xóa theo id của flash sale trả 404. Ngược lại, `code` là unique
 * TOÀN CỤC (02-ERD §3): tạo/sửa trùng mã của flash sale vẫn bị 409.
 * Trạng thái hiển thị SUY RA (không lưu field) theo thứ tự ưu tiên §2.3 —
 * lọc status làm ở service để phân trang đúng.
 * Convention §9.2: totalUsageLimit 0 = không giới hạn; perUserLimit (§9.1)
 * null/0 = không giới hạn.
 */
@Service
@RequiredArgsConstructor
public class AdminVoucherService {

  /** Các type thuộc màn này — còn lại (FLASH_SALE) bị loại khỏi mọi kết quả. */
  private static final Set<String> REGULAR_TYPES = Set.of("PERCENT", "FIXED");

  public static final String STATUS_RUNNING = "RUNNING";
  public static final String STATUS_UPCOMING = "UPCOMING";
  public static final String STATUS_EXPIRED = "EXPIRED";
  public static final String STATUS_EXHAUSTED = "EXHAUSTED";
  public static final String STATUS_INACTIVE = "INACTIVE";
  private static final Set<String> STATUSES =
      Set.of(STATUS_RUNNING, STATUS_UPCOMING, STATUS_EXPIRED, STATUS_EXHAUSTED, STATUS_INACTIVE);

  private final VoucherRepository voucherRepository;
  private final OrderRepository orderRepository;

  /* ------------------------------ Trạng thái suy ra (§2.3) ------------------------------ */

  /**
   * Thứ tự ưu tiên: Đã tắt → Hết hạn → Sắp chạy → Hết lượt → Đang chạy.
   * "Hết lượt" chỉ khi có giới hạn hữu hạn (limit > 0) và đã dùng hết (§9.2).
   */
  public String statusOf(Voucher v, Instant now) {
    if (!v.isActive()) return STATUS_INACTIVE;
    if (v.getEndAt() != null && now.isAfter(v.getEndAt())) return STATUS_EXPIRED;
    if (v.getStartAt() != null && now.isBefore(v.getStartAt())) return STATUS_UPCOMING;
    if (v.getTotalUsageLimit() > 0 && v.getUsedCount() >= v.getTotalUsageLimit()) {
      return STATUS_EXHAUSTED;
    }
    return STATUS_RUNNING;
  }

  /* ------------------------------ Danh sách ------------------------------ */

  /**
   * GET /admin/vouchers — lọc q (code, không phân biệt hoa thường) + status
   * (suy ra §2.3) + discountType (= field type), sort "field,dir"
   * (code | endAt | usedCount; mặc định endAt,asc), page 0-indexed.
   */
  public AdminVoucherListResponseDto list(
      String q, String status, String discountType, int page, int size, String sort) {
    Instant now = Instant.now();
    String needle = q == null ? "" : q.trim().toUpperCase(Locale.ROOT);
    String typeFilter =
        discountType == null || discountType.isBlank()
            ? null
            : discountType.trim().toUpperCase(Locale.ROOT);
    String statusFilter =
        status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
    if (statusFilter != null && !STATUSES.contains(statusFilter)) {
      throw unprocessable("Trạng thái lọc không hợp lệ.", "status");
    }
    if (typeFilter != null && !REGULAR_TYPES.contains(typeFilter)) {
      throw unprocessable("Loại giảm lọc không hợp lệ.", "discountType");
    }

    List<Voucher> filtered =
        voucherRepository.findAll().stream()
            .filter(v -> REGULAR_TYPES.contains(normalizeType(v.getType())))
            .filter(v -> needle.isEmpty() || normalizeCode(v.getCode()).contains(needle))
            .filter(v -> typeFilter == null || typeFilter.equals(normalizeType(v.getType())))
            .filter(v -> statusFilter == null || statusFilter.equals(statusOf(v, now)))
            .sorted(comparatorFor(sort))
            .toList();

    int safeSize = Math.min(50, Math.max(1, size));
    int safePage = Math.max(0, page);
    int from = Math.min(safePage * safeSize, filtered.size());
    int to = Math.min(from + safeSize, filtered.size());

    AdminVoucherListResponseDto res = new AdminVoucherListResponseDto();
    res.setItems(filtered.subList(from, to).stream().map(this::toDto).toList());
    res.setTotal(filtered.size());
    res.setPage(safePage);
    res.setSize(safeSize);
    return res;
  }

  /** Sort "field,dir": field thuộc {code, endAt, usedCount}; lạ → mặc định endAt,asc (§2.2). */
  private Comparator<Voucher> comparatorFor(String sort) {
    String field = "endAt";
    boolean desc = false;
    if (sort != null && !sort.isBlank()) {
      String[] parts = sort.split(",");
      if (parts.length > 0 && !parts[0].isBlank()) field = parts[0].trim();
      if (parts.length > 1) desc = "desc".equalsIgnoreCase(parts[1].trim());
    }
    Comparator<Voucher> cmp =
        switch (field) {
          case "code" ->
              Comparator.comparing(
                  (Voucher v) -> normalizeCode(v.getCode()), String.CASE_INSENSITIVE_ORDER);
          case "usedCount" -> Comparator.comparingInt(Voucher::getUsedCount);
          default ->
              Comparator.comparing(
                  Voucher::getEndAt, Comparator.nullsLast(Comparator.naturalOrder()));
        };
    return desc ? cmp.reversed() : cmp;
  }

  /* ------------------------------ Chi tiết / Tạo / Sửa ------------------------------ */

  public AdminVoucherDto get(String id) {
    return toDto(findRegularVoucher(id));
  }

  public AdminVoucherDto create(AdminVoucherRequest req) {
    ValidatedInput in = validate(req, null, 0);
    checkCodeUnique(in.code(), null);
    Voucher v = new Voucher();
    applyFields(v, in);
    v.setUsedCount(0);
    return toDto(voucherRepository.save(v));
  }

  public AdminVoucherDto update(String id, AdminVoucherRequest req) {
    Voucher v = findRegularVoucher(id);
    // Khóa mã khi đã có lượt dùng (§3.2 — Order.voucherCode tham chiếu theo chuỗi mã).
    if (req != null
        && v.getUsedCount() > 0
        && req.getCode() != null
        && !normalizeCode(req.getCode()).equals(normalizeCode(v.getCode()))) {
      throw unprocessable(
          "Không đổi được mã khi voucher đã có lượt dùng.", "code");
    }
    ValidatedInput in = validate(req, id, v.getUsedCount());
    checkCodeUnique(in.code(), id);
    applyFields(v, in);
    return toDto(voucherRepository.save(v));
  }

  /* ------------------------------ Bật/tắt · Xóa ------------------------------ */

  /** PATCH /{id}/active — bật lại voucher đã qua endAt vẫn cho phép (badge tự về Hết hạn, §4.1). */
  public AdminVoucherDto patchActive(String id, AdminVoucherActiveRequest req) {
    Voucher v = findRegularVoucher(id);
    if (req == null || req.getActive() == null) {
      throw unprocessable("Thiếu trạng thái kích hoạt.", "active");
    }
    v.setActive(req.getActive());
    return toDto(voucherRepository.save(v));
  }

  /**
   * DELETE — chỉ khi usedCount = 0 VÀ không đơn nào (kể cả đơn đã hủy) còn
   * tham chiếu mã (§4.2, F-018: đã dùng thì chỉ được tắt, không xóa).
   */
  public void delete(String id) {
    Voucher v = findRegularVoucher(id);
    if (v.getUsedCount() > 0 || orderRepository.existsByVoucherCode(v.getCode())) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "VOUCHER_USED",
          "Voucher đã có lượt dùng — chỉ có thể vô hiệu hóa, không thể xóa.");
    }
    voucherRepository.delete(v);
  }

  /* ------------------------------ Validate F-018 (§3) ------------------------------ */

  /** Dữ liệu đã chuẩn hoá sau validate — applyFields dùng đúng bộ này. */
  private record ValidatedInput(
      String code,
      String type,
      BigDecimal value,
      BigDecimal maxDiscount,
      BigDecimal minOrderValue,
      List<String> applicableCategories,
      List<String> applicableProductIds,
      Integer perUserLimit,
      Instant startAt,
      Instant endAt,
      int totalUsageLimit,
      boolean active) {}

  private ValidatedInput validate(AdminVoucherRequest req, String excludeId, int currentUsedCount) {
    if (req == null) {
      throw unprocessable("Dữ liệu voucher không hợp lệ.", null);
    }
    // Mã: bắt buộc, uppercase, 3–30 ký tự A–Z 0–9 - _ (§3.2).
    if (req.getCode() == null || req.getCode().isBlank()) {
      throw unprocessable("Mã voucher là bắt buộc.", "code");
    }
    String code = normalizeCode(req.getCode());
    if (!code.matches("^[A-Z0-9_-]{3,30}$")) {
      throw unprocessable("Mã chỉ gồm chữ in hoa, số, dấu - và _.", "code");
    }
    // Loại giảm: chỉ PERCENT | FIXED ở màn này (FLASH_SALE thuộc màn 22).
    String type = normalizeType(req.getType());
    if (!REGULAR_TYPES.contains(type)) {
      throw unprocessable("Loại giảm phải là Giảm % hoặc Giảm số tiền.", "type");
    }
    // Giá trị giảm (§3.3).
    if (req.getValue() == null) {
      throw unprocessable("Giá trị giảm là bắt buộc.", "value");
    }
    if ("PERCENT".equals(type)) {
      if (req.getValue().compareTo(BigDecimal.ONE) < 0
          || req.getValue().compareTo(BigDecimal.valueOf(100)) > 0) {
        throw unprocessable("Phần trăm giảm phải từ 1 đến 100.", "value");
      }
    } else if (req.getValue().compareTo(BigDecimal.ZERO) <= 0) {
      throw unprocessable("Số tiền giảm phải lớn hơn 0đ.", "value");
    }
    // Trần giảm: bắt buộc khi PERCENT; FIXED luôn gửi null (§3.3).
    BigDecimal maxDiscount = null;
    if ("PERCENT".equals(type)) {
      if (req.getMaxDiscount() == null) {
        throw unprocessable("Nhập mức giảm tối đa khi giảm theo %.", "maxDiscount");
      }
      if (req.getMaxDiscount().compareTo(BigDecimal.ZERO) <= 0) {
        throw unprocessable("Mức giảm tối đa phải lớn hơn 0đ.", "maxDiscount");
      }
      maxDiscount = req.getMaxDiscount();
    }
    // Đơn tối thiểu (§3.4).
    BigDecimal minOrderValue =
        req.getMinOrderValue() != null ? req.getMinOrderValue() : BigDecimal.ZERO;
    if (minOrderValue.compareTo(BigDecimal.ZERO) < 0) {
      throw unprocessable("Giá trị đơn tối thiểu không được âm.", "minOrderValue");
    }
    // Thời gian hiệu lực: bắt buộc, endAt > startAt (§3.5, F-018).
    if (req.getStartAt() == null) {
      throw unprocessable("Thời gian bắt đầu là bắt buộc.", "startAt");
    }
    if (req.getEndAt() == null) {
      throw unprocessable("Thời gian kết thúc là bắt buộc.", "endAt");
    }
    if (!req.getEndAt().isAfter(req.getStartAt())) {
      throw unprocessable("Thời gian kết thúc phải sau thời gian bắt đầu.", "endAt");
    }
    // Tổng giới hạn lượt: null/0 = không giới hạn (§9.2); có giới hạn thì
    // không được nhỏ hơn số lượt đã dùng (§3.5).
    int totalUsageLimit = req.getTotalUsageLimit() != null ? req.getTotalUsageLimit() : 0;
    if (totalUsageLimit < 0) {
      throw unprocessable("Tổng giới hạn lượt không được âm.", "totalUsageLimit");
    }
    if (totalUsageLimit > 0 && totalUsageLimit < currentUsedCount) {
      throw unprocessable(
          "Giới hạn phải từ " + currentUsedCount + " lượt trở lên (đã dùng "
              + currentUsedCount + ").",
          "totalUsageLimit");
    }
    // Giới hạn mỗi khách (§9.1): null/0 = không giới hạn.
    Integer perUserLimit = req.getPerUserLimit();
    if (perUserLimit != null && perUserLimit < 0) {
      throw unprocessable("Giới hạn mỗi khách không được âm.", "perUserLimit");
    }
    return new ValidatedInput(
        code,
        type,
        req.getValue(),
        maxDiscount,
        minOrderValue,
        cleanIds(req.getApplicableCategories()),
        cleanIds(req.getApplicableProductIds()),
        perUserLimit,
        req.getStartAt(),
        req.getEndAt(),
        totalUsageLimit,
        req.getActive() == null || req.getActive());
  }

  /** Unique TOÀN CỤC gồm cả flash sale (§0.1) — không loại trừ theo type. */
  private void checkCodeUnique(String code, String excludeId) {
    boolean dup =
        voucherRepository.findByCode(code)
            .filter(v -> excludeId == null || !excludeId.equals(v.getId()))
            .isPresent();
    if (dup) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "CODE_EXISTS",
          "Mã này đã tồn tại. Hãy chọn mã khác.",
          "code");
    }
  }

  private ApiException unprocessable(String message, String field) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message, field);
  }

  /* ------------------------------ Mapping / helpers ------------------------------ */

  /** Tìm voucher THƯỜNG theo id — id của flash sale coi như không tồn tại ở màn này. */
  private Voucher findRegularVoucher(String id) {
    Voucher v =
        voucherRepository
            .findById(id)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND, "VOUCHER_NOT_FOUND", "Không tìm thấy voucher."));
    if (!REGULAR_TYPES.contains(normalizeType(v.getType()))) {
      throw new ApiException(
          HttpStatus.NOT_FOUND, "VOUCHER_NOT_FOUND", "Không tìm thấy voucher.");
    }
    return v;
  }

  private void applyFields(Voucher v, ValidatedInput in) {
    v.setCode(in.code());
    v.setType(in.type());
    v.setValue(in.value());
    v.setMaxDiscount(in.maxDiscount());
    v.setMinOrderValue(in.minOrderValue());
    v.setApplicableCategories(in.applicableCategories());
    v.setApplicableProductIds(in.applicableProductIds());
    v.setPerUserLimit(in.perUserLimit());
    v.setStartAt(in.startAt());
    v.setEndAt(in.endAt());
    v.setTotalUsageLimit(in.totalUsageLimit());
    v.setActive(in.active());
    v.setItems(null); // voucher thường không mang cấu hình flash sale
  }

  private AdminVoucherDto toDto(Voucher v) {
    AdminVoucherDto dto = new AdminVoucherDto();
    dto.setId(v.getId());
    dto.setCode(v.getCode());
    dto.setType(v.getType());
    dto.setValue(v.getValue());
    dto.setMaxDiscount(v.getMaxDiscount());
    dto.setMinOrderValue(v.getMinOrderValue());
    dto.setApplicableCategories(
        v.getApplicableCategories() != null ? v.getApplicableCategories() : List.of());
    dto.setApplicableProductIds(
        v.getApplicableProductIds() != null ? v.getApplicableProductIds() : List.of());
    dto.setPerUserLimit(v.getPerUserLimit());
    dto.setStartAt(v.getStartAt());
    dto.setEndAt(v.getEndAt());
    dto.setTotalUsageLimit(v.getTotalUsageLimit());
    dto.setUsedCount(v.getUsedCount());
    dto.setActive(v.isActive());
    return dto;
  }

  private List<String> cleanIds(List<String> ids) {
    if (ids == null) return new ArrayList<>();
    return ids.stream().filter(s -> s != null && !s.isBlank()).map(String::trim).distinct().toList();
  }

  private String normalizeCode(String code) {
    return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
  }

  private String normalizeType(String type) {
    return type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
  }
}
