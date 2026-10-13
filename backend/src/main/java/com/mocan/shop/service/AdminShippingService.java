package com.mocan.shop.service;

import com.mocan.shop.dto.AdminShippingConfigDto;
import com.mocan.shop.dto.AdminShippingConfigRequest;
import com.mocan.shop.dto.AdminShippingPreviewRequest;
import com.mocan.shop.dto.AdminShippingPreviewResponseDto;
import com.mocan.shop.dto.AdminShippingRuleDto;
import com.mocan.shop.dto.AdminShippingRuleRequest;
import com.mocan.shop.dto.AdminShippingRulesResponseDto;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.ShippingConfig;
import com.mocan.shop.model.ShippingRule;
import com.mocan.shop.repository.ShippingConfigRepository;
import com.mocan.shop.repository.ShippingRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Quản lý phí vận chuyển (admin) — FR-029 · F-023 · US-021
 * (admin-flash-sale-shipping.md §5, §8).
 * CRUD bậc phí SHIPPING_RULE + ngưỡng miễn phí dạng CẤU HÌNH LƯU TRỮ
 * (ShippingConfig key=SHIPPING — divergence §10.3): ShippingService đọc
 * ngưỡng qua freeThreshold() nên cả checkout (POST /shipping/quote) lẫn
 * Thử tính phí dùng cùng 1 nguồn; sửa cấu hình chỉ áp cho đơn tạo mới vì
 * phí đã chốt snapshot vào Order.shippingFee (§5.5).
 * Validate bậc phí (§5.2.1, §10.5): chồng lấp giữa các bậc ACTIVE = chặn cứng
 * 422 nêu rõ bậc bị chồng; max <= min = 422; tối đa 1 bậc active "trở lên".
 * Lỗ hổng phủ KHÔNG chặn lưu (admin sửa nhiều bậc theo trình tự) — FE hiển
 * thị dải cảnh báo từ chính danh sách bậc active này.
 * MỌI endpoint nằm dưới /admin/** (role ADMIN) — tuyệt đối không đặt CRUD
 * dưới /shipping/** vì matcher public POST /shipping/quote (SecurityConfig).
 */
@Service
@RequiredArgsConstructor
public class AdminShippingService {

  private final ShippingRuleRepository ruleRepository;
  private final ShippingConfigRepository configRepository;
  private final ShippingService shippingService;

  /* ------------------------------ Danh sách + cấu hình ------------------------------ */

  /** GET /admin/shipping-rules -> { rules (min asc), config: { freeThreshold, maxAreaM2 } }. */
  public AdminShippingRulesResponseDto list() {
    AdminShippingRulesResponseDto res = new AdminShippingRulesResponseDto();
    res.setRules(ruleRepository.findAll().stream()
        .sorted(Comparator.comparing(ShippingRule::getMinAreaM2,
            Comparator.nullsLast(Comparator.naturalOrder())))
        .map(this::toDto)
        .toList());
    AdminShippingRulesResponseDto.ConfigDto config = new AdminShippingRulesResponseDto.ConfigDto();
    config.setFreeThreshold(shippingService.freeThreshold());
    config.setMaxAreaM2(ShippingService.MAX_AREA_M2);
    res.setConfig(config);
    return res;
  }

  /* ------------------------------ CRUD bậc phí ------------------------------ */

  public AdminShippingRuleDto create(AdminShippingRuleRequest req) {
    ValidatedRule in = validate(req, null);
    ShippingRule rule = new ShippingRule();
    applyFields(rule, in);
    return toDto(ruleRepository.save(rule));
  }

  /** PUT — bật/tắt bậc cũng đi qua đây với field active (§5.2.1, §8). */
  public AdminShippingRuleDto update(String id, AdminShippingRuleRequest req) {
    ShippingRule rule = findRule(id);
    ValidatedRule in = validate(req, id);
    applyFields(rule, in);
    return toDto(ruleRepository.save(rule));
  }

  public void delete(String id) {
    ruleRepository.delete(findRule(id));
  }

  /* ------------------------------ Ngưỡng miễn phí (§5.3) ------------------------------ */

  public AdminShippingConfigDto getConfig() {
    AdminShippingConfigDto dto = new AdminShippingConfigDto();
    dto.setFreeThreshold(shippingService.freeThreshold());
    return dto;
  }

  /** PUT /admin/shipping-config — upsert document đơn nhất key=SHIPPING. */
  public AdminShippingConfigDto updateConfig(AdminShippingConfigRequest req) {
    if (req == null || req.getFreeThreshold() == null) {
      throw unprocessable("Ngưỡng miễn phí vận chuyển là bắt buộc.", "freeThreshold");
    }
    if (req.getFreeThreshold().compareTo(BigDecimal.ZERO) < 0) {
      throw unprocessable("Ngưỡng miễn phí vận chuyển không được âm.", "freeThreshold");
    }
    ShippingConfig config = configRepository.findByKey(ShippingConfig.KEY_SHIPPING)
        .orElseGet(() -> {
          ShippingConfig c = new ShippingConfig();
          c.setKey(ShippingConfig.KEY_SHIPPING);
          return c;
        });
    config.setFreeThreshold(req.getFreeThreshold());
    configRepository.save(config);
    AdminShippingConfigDto dto = new AdminShippingConfigDto();
    dto.setFreeThreshold(config.getFreeThreshold());
    return dto;
  }

  /* ------------------------------ Thử tính phí (§5.4) ------------------------------ */

  /** POST /admin/shipping-rules/preview — dùng lại ShippingService.preview (không chế công thức). */
  public AdminShippingPreviewResponseDto preview(AdminShippingPreviewRequest req) {
    if (req == null || req.getAreaM2() == null
        || req.getAreaM2().compareTo(BigDecimal.ZERO) <= 0) {
      throw unprocessable("Tổng diện tích đơn phải lớn hơn 0.", "areaM2");
    }
    if (req.getSubtotal() != null && req.getSubtotal().compareTo(BigDecimal.ZERO) < 0) {
      throw unprocessable("Tạm tính đơn không được âm.", "subtotal");
    }
    ShippingService.PreviewResult r = shippingService.preview(req.getAreaM2(), req.getSubtotal());
    AdminShippingPreviewResponseDto dto = new AdminShippingPreviewResponseDto();
    if (r.tier() != null) {
      AdminShippingPreviewResponseDto.TierDto tier = new AdminShippingPreviewResponseDto.TierDto();
      tier.setMin(r.tier().getMinAreaM2());
      tier.setMax(r.tier().getMaxAreaM2());
      dto.setTier(tier);
    }
    dto.setOriginalFee(r.originalFee());
    dto.setFee(r.fee());
    dto.setFreeShipping(r.freeShipping());
    dto.setOverLimit(r.overLimit());
    return dto;
  }

  /* ------------------------------ Validate (§5.2.1) ------------------------------ */

  private record ValidatedRule(BigDecimal min, BigDecimal max, BigDecimal fee, boolean active) {}

  private ValidatedRule validate(AdminShippingRuleRequest req, String excludeId) {
    if (req == null) {
      throw unprocessable("Dữ liệu bậc phí không hợp lệ.", null);
    }
    if (req.getMinAreaM2() == null) {
      throw unprocessable("Diện tích \"từ\" là bắt buộc.", "minAreaM2");
    }
    if (req.getMinAreaM2().compareTo(BigDecimal.ZERO) < 0) {
      throw unprocessable("Diện tích \"từ\" không được âm.", "minAreaM2");
    }
    if (req.getMaxAreaM2() != null
        && req.getMaxAreaM2().compareTo(req.getMinAreaM2()) <= 0) {
      throw unprocessable("Diện tích \"đến\" phải lớn hơn diện tích \"từ\".", "maxAreaM2");
    }
    if (req.getFee() == null) {
      throw unprocessable("Phí vận chuyển là bắt buộc.", "fee");
    }
    if (req.getFee().compareTo(BigDecimal.ZERO) < 0) {
      throw unprocessable("Phí vận chuyển không được âm.", "fee");
    }
    boolean active = req.getActive() == null || req.getActive();
    if (active) {
      for (ShippingRule other : ruleRepository.findByActiveTrue()) {
        if (excludeId != null && excludeId.equals(other.getId())) continue;
        // Chỉ 1 bậc active được "trở lên" và đó là bậc min lớn nhất (§5.2.1).
        if (req.getMaxAreaM2() == null && other.getMaxAreaM2() == null) {
          throw unprocessable(
              "Đã có bậc \"trở lên\" đang áp dụng (từ " + formatArea(other.getMinAreaM2()) + " m²).",
              "maxAreaM2");
        }
        if (overlaps(req.getMinAreaM2(), req.getMaxAreaM2(),
            other.getMinAreaM2(), other.getMaxAreaM2())) {
          throw unprocessable(
              "Khoảng " + rangeLabel(req.getMinAreaM2(), req.getMaxAreaM2())
                  + " đang chồng với bậc " + rangeLabel(other.getMinAreaM2(), other.getMaxAreaM2())
                  + " (phí " + formatMoney(other.getFee()) + "). Hãy chỉnh lại khoảng.",
              null);
        }
      }
    }
    return new ValidatedRule(req.getMinAreaM2(), req.getMaxAreaM2(), req.getFee(), active);
  }

  /**
   * Chồng lấp khoảng theo đúng cách findTier xử lý biên ([min, max], biên chung
   * thuộc bậc thấp hơn): hai khoảng chỉ chồng khi giao nhau có phần trong thực
   * sự — chạm nhau đúng 1 điểm biên (max của bậc thấp = min của bậc cao) KHÔNG
   * tính là chồng, khớp bảng mẫu 0–1 / 1–3 / 3–6 / 6–10 phủ liên tục.
   */
  private boolean overlaps(BigDecimal minA, BigDecimal maxA, BigDecimal minB, BigDecimal maxB) {
    BigDecimal lo = minA.max(minB);
    BigDecimal hiA = maxA == null ? null : maxA;
    BigDecimal hiB = maxB == null ? null : maxB;
    BigDecimal hi = hiA == null ? hiB : (hiB == null ? hiA : hiA.min(hiB));
    return hi == null || lo.compareTo(hi) < 0;
  }

  /* ------------------------------ Mapping / helpers ------------------------------ */

  private ShippingRule findRule(String id) {
    return ruleRepository.findById(id)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SHIPPING_RULE_NOT_FOUND",
            "Không tìm thấy bậc phí."));
  }

  private void applyFields(ShippingRule rule, ValidatedRule in) {
    rule.setMinAreaM2(in.min());
    rule.setMaxAreaM2(in.max());
    rule.setFee(in.fee());
    rule.setActive(in.active());
  }

  private AdminShippingRuleDto toDto(ShippingRule rule) {
    AdminShippingRuleDto dto = new AdminShippingRuleDto();
    dto.setId(rule.getId());
    dto.setMinAreaM2(rule.getMinAreaM2());
    dto.setMaxAreaM2(rule.getMaxAreaM2());
    dto.setFee(rule.getFee());
    dto.setActive(rule.isActive());
    return dto;
  }

  private ApiException unprocessable(String message, String field) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message, field);
  }

  private String rangeLabel(BigDecimal min, BigDecimal max) {
    return formatArea(min) + " – " + (max == null ? "trở lên" : formatArea(max)) + " m²";
  }

  private String formatArea(BigDecimal v) {
    if (v == null) return "";
    BigDecimal s = v.stripTrailingZeros();
    return s.toPlainString().replace('.', ',');
  }

  private String formatMoney(BigDecimal v) {
    if (v == null) return "0đ";
    return new java.text.DecimalFormat("#,##0",
        new java.text.DecimalFormatSymbols(Locale.forLanguageTag("vi-VN"))).format(v) + "đ";
  }
}
