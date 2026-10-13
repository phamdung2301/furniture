package com.mocan.shop.service;

import com.mocan.shop.dto.ValidateVoucherResponse;
import com.mocan.shop.dto.VoucherAvailableDto;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Voucher;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.VoucherRepository;
import com.mocan.shop.util.MoneyUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Voucher — F-007 rule 2 / FR-019.
 * Mỗi đơn chỉ 1 voucher. available() lọc active + trong hiệu lực + còn lượt;
 * eligible chỉ xét minOrderValue theo subtotal truyền vào (GET /vouchers/available?subtotal=...).
 *
 * Ba divergence của admin-voucher.md §9 đã xử lý ở màn 19:
 * (a) perUserLimit: validate phía chốt đơn đếm đơn của user theo voucherCode
 *     (không tính ĐÃ HỦY / HOÀN TRẢ) và từ chối khi đạt giới hạn.
 * (b) Convention totalUsageLimit: null/0 = KHÔNG giới hạn — khớp
 *     FlashSaleService (trước đây limit 0 bị coi là hết lượt ngay).
 * (c) Phạm vi áp dụng: validateForOrder chỉ tính minOrderValue + discount
 *     trên tổng các dòng THUỘC phạm vi (applicableCategories /
 *     applicableProductIds); rỗng cả hai = toàn đơn. Endpoint validate công
 *     khai không có thông tin dòng nên vẫn dùng subtotal truyền vào làm cơ
 *     số — chốt đơn ở OrderService mới là nơi ép phạm vi chính thức.
 */
@Service
@RequiredArgsConstructor
public class VoucherService {

  /** Trạng thái đơn KHÔNG tính vào lượt dùng của khách (§9.1). */
  private static final List<String> PER_USER_EXCLUDED_STATUSES = List.of("ĐÃ HỦY", "HOÀN TRẢ");

  private final VoucherRepository voucherRepository;
  private final OrderRepository orderRepository;
  private final MongoTemplate mongoTemplate;

  /**
   * 1 dòng hàng (chỉ dòng THƯỜNG, không flash sale) phục vụ tính phạm vi §9.3:
   * productId + categoryId của sản phẩm, lineTotal = giá chốt × số lượng.
   */
  public record ScopedLine(String productId, String categoryId, BigDecimal lineTotal) {}

  /** Có giới hạn tổng lượt hữu hạn hay không — convention §9.2: limit <= 0 = không giới hạn. */
  public static boolean hasUsageLimit(Voucher v) {
    return v.getTotalUsageLimit() > 0;
  }

  /** Voucher có phạm vi áp dụng (danh mục hoặc sản phẩm) hay áp toàn đơn. */
  public static boolean hasScope(Voucher v) {
    boolean byCategory =
        v.getApplicableCategories() != null && !v.getApplicableCategories().isEmpty();
    boolean byProduct =
        v.getApplicableProductIds() != null && !v.getApplicableProductIds().isEmpty();
    return byCategory || byProduct;
  }

  /**
   * Cơ số tính của voucher trên các dòng thường: toàn đơn khi không có phạm
   * vi; có phạm vi thì chỉ cộng các dòng thuộc danh mục/sản phẩm đã chọn (§9.3).
   */
  public static BigDecimal scopedSubtotal(Voucher v, List<ScopedLine> nonFlashLines) {
    if (nonFlashLines == null) return BigDecimal.ZERO;
    if (!hasScope(v)) {
      return nonFlashLines.stream()
          .map(l -> l.lineTotal() != null ? l.lineTotal() : BigDecimal.ZERO)
          .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    List<String> cats = v.getApplicableCategories() != null ? v.getApplicableCategories() : List.of();
    List<String> prods = v.getApplicableProductIds() != null ? v.getApplicableProductIds() : List.of();
    return nonFlashLines.stream()
        .filter(l -> (l.productId() != null && prods.contains(l.productId()))
            || (l.categoryId() != null && cats.contains(l.categoryId())))
        .map(l -> l.lineTotal() != null ? l.lineTotal() : BigDecimal.ZERO)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  /** Danh sách mã khả dụng; eligible=false khi chưa đạt đơn tối thiểu (kèm reason "còn thiếu bao nhiêu"). */
  public List<VoucherAvailableDto> available(BigDecimal subtotal) {
    Instant now = Instant.now();
    return voucherRepository.findByActiveTrueOrderByEndAtAsc().stream()
        .filter(v -> inValidity(v, now))
        // §9.2: limit 0 = không giới hạn — không lọc ra theo lượt.
        .filter(v -> !hasUsageLimit(v) || v.getUsedCount() < v.getTotalUsageLimit())
        .map(v -> toAvailable(v, subtotal))
        .toList();
  }

  /**
   * Kiểm tra mã với từng case lỗi riêng:
   * NOT_FOUND | EXPIRED | USED_UP | MIN_NOT_MET.
   * Dùng cho POST /vouchers/validate (không có user, không có thông tin dòng):
   * subtotal truyền vào được dùng thẳng làm cơ số.
   */
  public ValidateVoucherResponse validate(String code, BigDecimal subtotal) {
    Voucher v = findByCode(code);
    if (v == null) {
      return invalid("NOT_FOUND", "Mã ưu đãi không tồn tại.");
    }
    return checkVoucher(v, null, subtotal != null ? subtotal : BigDecimal.ZERO, false);
  }

  /**
   * Kiểm tra mã khi CHỐT ĐƠN (OrderService gọi) — ép đủ 3 divergence §9:
   * cơ số = scopedSubtotal trên các dòng thường thuộc phạm vi (§9.3);
   * voucher có phạm vi mà không dòng nào thuộc phạm vi -> NOT_APPLICABLE;
   * perUserLimit đếm theo user (§9.1); limit 0 = không giới hạn (§9.2).
   */
  public ValidateVoucherResponse validateForOrder(
      String code, String userId, List<ScopedLine> nonFlashLines) {
    Voucher v = findByCode(code);
    if (v == null || !v.isActive()) {
      return invalid("NOT_FOUND", "Mã ưu đãi không tồn tại.");
    }
    BigDecimal base = scopedSubtotal(v, nonFlashLines);
    // Thứ tự case giữ như validate thường (hết hạn/hết lượt trước); "không
    // dòng nào thuộc phạm vi" chỉ xét khi voucher vẫn còn hiệu lực — xem
    // tham số outOfScope của checkVoucher.
    boolean outOfScope = hasScope(v) && base.compareTo(BigDecimal.ZERO) <= 0;
    return checkVoucher(v, userId, base, outOfScope);
  }

  /** Chuỗi kiểm tra dùng chung sau khi đã có voucher + cơ số tính. */
  private ValidateVoucherResponse checkVoucher(
      Voucher v, String userId, BigDecimal base, boolean outOfScope) {
    if (!v.isActive()) {
      return invalid("NOT_FOUND", "Mã ưu đãi không tồn tại.");
    }
    Instant now = Instant.now();
    if (!inValidity(v, now)) {
      return invalid("EXPIRED", "Mã đã hết hạn.");
    }
    // §9.2: chỉ xét hết lượt khi có giới hạn hữu hạn.
    if (hasUsageLimit(v) && v.getUsedCount() >= v.getTotalUsageLimit()) {
      return invalid("USED_UP", "Mã đã hết lượt sử dụng.");
    }
    // §9.1: giới hạn mỗi khách — đếm đơn đã dùng mã của chính user này.
    Integer perUser = v.getPerUserLimit();
    if (perUser != null && perUser > 0 && userId != null) {
      long usedByUser = orderRepository.countByUserIdAndVoucherCodeAndStatusNotIn(
          userId, v.getCode(), PER_USER_EXCLUDED_STATUSES);
      if (usedByUser >= perUser) {
        return invalid("PER_USER_LIMIT",
            "Bạn đã dùng mã này tối đa " + perUser + " lần.");
      }
    }
    if (outOfScope) {
      return invalid("NOT_APPLICABLE",
          "Mã này không áp dụng cho các sản phẩm trong đơn của bạn.");
    }
    BigDecimal min = v.getMinOrderValue() != null ? v.getMinOrderValue() : BigDecimal.ZERO;
    if (base.compareTo(min) < 0) {
      return invalid("MIN_NOT_MET",
          "Đơn hàng chưa đạt giá trị tối thiểu " + MoneyUtil.vnd(min)
              + " (còn thiếu " + MoneyUtil.vnd(min.subtract(base)) + ").");
    }
    ValidateVoucherResponse res = new ValidateVoucherResponse();
    res.setValid(true);
    res.setDiscount(calcDiscount(v, base));
    return res;
  }

  /**
   * Tăng usedCount NGUYÊN TỬ. Điều kiện usedCount < totalUsageLimit CHỈ thêm
   * khi voucher có giới hạn hữu hạn — limit 0 (không giới hạn, §9.2) thì chỉ
   * cần mã tồn tại + đang bật. Trả về lỗi nếu mã vừa hết lượt giữa lúc
   * validate và apply (race).
   */
  public void apply(String code) {
    String norm = normalize(code);
    Voucher v = voucherRepository.findByCode(norm)
        .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "NOT_FOUND",
            "Mã ưu đãi không tồn tại."));
    Criteria criteria = Criteria.where("code").is(norm).and("active").is(true);
    if (hasUsageLimit(v)) {
      criteria = criteria.and("usedCount").lt(v.getTotalUsageLimit());
    }
    Query q = Query.query(criteria);
    Update u = new Update().inc("usedCount", 1);
    Voucher updated = mongoTemplate.findAndModify(q, u,
        FindAndModifyOptions.options().returnNew(true), Voucher.class);
    if (updated == null) {
      throw new ApiException(HttpStatus.CONFLICT, "USED_UP",
          "Mã " + norm + " vừa hết lượt sử dụng. Vui lòng chọn mã khác.");
    }
  }

  /**
   * Hoàn 1 lượt voucher khi đơn bị hủy (F-009): giảm usedCount nguyên tử, chặn dưới 0.
   * Không throw nếu mã không còn tồn tại — hủy đơn vẫn phải thành công.
   */
  public void release(String code) {
    String norm = normalize(code);
    if (norm.isEmpty()) return;
    Query q = Query.query(Criteria.where("code").is(norm).and("usedCount").gt(0));
    Update u = new Update().inc("usedCount", -1);
    mongoTemplate.findAndModify(q, u,
        FindAndModifyOptions.options().returnNew(true), Voucher.class);
  }

  /** Tính discount: PERCENT/FLASH_SALE = % subtotal, chặn trần maxDiscount; FIXED = value, không vượt subtotal. */
  public BigDecimal calcDiscount(Voucher v, BigDecimal subtotal) {
    BigDecimal sub = subtotal != null ? subtotal : BigDecimal.ZERO;
    BigDecimal discount;
    if ("FIXED".equalsIgnoreCase(v.getType())) {
      discount = v.getValue() != null ? v.getValue() : BigDecimal.ZERO;
      if (discount.compareTo(sub) > 0) discount = sub;
    } else { // PERCENT | FLASH_SALE
      BigDecimal pct = v.getValue() != null ? v.getValue() : BigDecimal.ZERO;
      discount = sub.multiply(pct).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
      if (v.getMaxDiscount() != null && discount.compareTo(v.getMaxDiscount()) > 0) {
        discount = v.getMaxDiscount();
      }
    }
    return discount.max(BigDecimal.ZERO);
  }

  private VoucherAvailableDto toAvailable(Voucher v, BigDecimal subtotal) {
    VoucherAvailableDto d = new VoucherAvailableDto();
    d.setCode(v.getCode());
    d.setType(v.getType());
    d.setValue(v.getValue());
    d.setMaxDiscount(v.getMaxDiscount());
    d.setMinOrderValue(v.getMinOrderValue());
    d.setDescription(describe(v));
    BigDecimal sub = subtotal != null ? subtotal : BigDecimal.ZERO;
    BigDecimal min = v.getMinOrderValue() != null ? v.getMinOrderValue() : BigDecimal.ZERO;
    boolean eligible = subtotal == null || sub.compareTo(min) >= 0;
    d.setEligible(eligible);
    if (!eligible) {
      d.setReason("Cần thêm " + MoneyUtil.vnd(min.subtract(sub)) + " để dùng mã này.");
    }
    return d;
  }

  /** Mô tả như khách thấy ở checkout — format giữ nguyên từ trước (màn 7, §3.6). */
  public String describe(Voucher v) {
    StringBuilder sb = new StringBuilder();
    if ("FIXED".equalsIgnoreCase(v.getType())) {
      sb.append("Giảm ").append(MoneyUtil.vnd(v.getValue()));
    } else {
      sb.append("Giảm ").append(strip(v.getValue())).append("%");
      if (v.getMaxDiscount() != null) sb.append(" tối đa ").append(MoneyUtil.vnd(v.getMaxDiscount()));
    }
    BigDecimal min = v.getMinOrderValue() != null ? v.getMinOrderValue() : BigDecimal.ZERO;
    if (min.compareTo(BigDecimal.ZERO) > 0) {
      sb.append(" — đơn từ ").append(MoneyUtil.vnd(min));
    }
    return sb.toString();
  }

  private String strip(BigDecimal v) {
    return v != null ? v.stripTrailingZeros().toPlainString() : "0";
  }

  private ValidateVoucherResponse invalid(String errorCode, String message) {
    ValidateVoucherResponse res = new ValidateVoucherResponse();
    res.setValid(false);
    res.setDiscount(BigDecimal.ZERO);
    res.setErrorCode(errorCode);
    res.setMessage(message);
    return res;
  }

  private Voucher findByCode(String code) {
    if (code == null) return null;
    Optional<Voucher> opt = voucherRepository.findByCode(normalize(code));
    return opt.orElse(null);
  }

  private String normalize(String code) {
    return code == null ? "" : code.trim().toUpperCase();
  }

  private boolean inValidity(Voucher v, Instant now) {
    boolean afterStart = v.getStartAt() == null || !now.isBefore(v.getStartAt());
    boolean beforeEnd = v.getEndAt() == null || !now.isAfter(v.getEndAt());
    return afterStart && beforeEnd;
  }
}
