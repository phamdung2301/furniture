package com.mocan.shop.service;

import com.mocan.shop.dto.ShippingQuoteRequest;
import com.mocan.shop.dto.ShippingQuoteResponse;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.model.ShippingConfig;
import com.mocan.shop.model.ShippingRule;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import com.mocan.shop.repository.ShippingConfigRepository;
import com.mocan.shop.repository.ShippingRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Báo giá phí ship theo diện tích — F-023 / FR-029.
 * totalArea = Σ(variant.lengthM × variant.widthM × qty) → tra nấc SHIPPING_RULE đang active.
 * Đơn đạt ngưỡng miễn phí (tạm tính, chưa trừ voucher) → miễn phí [Giả định: 02-ERD §4];
 * đơn > 10 m² → overLimit, checkout bị chặn ở OrderService (F-023 [Giả định]: liên hệ báo giá riêng).
 * Ngưỡng miễn phí KHÔNG còn hardcode: từ màn 22 (admin-flash-sale-shipping.md §10.3)
 * nó là cấu hình lưu trữ trong collection shipping_configs (ShippingConfig,
 * key=SHIPPING) do admin sửa qua /admin/shipping-config; FREE_SHIPPING_THRESHOLD
 * chỉ còn là giá trị MẶC ĐỊNH khi chưa có cấu hình. Checkout (quote) và công cụ
 * Thử tính phí (preview) đều đọc qua freeThreshold() — cùng 1 nguồn.
 */
@Service
@RequiredArgsConstructor
public class ShippingService {

  /** Ngưỡng miễn phí ship MẶC ĐỊNH khi chưa có cấu hình lưu trữ — [Giả định] 02-ERD §4. */
  public static final BigDecimal FREE_SHIPPING_THRESHOLD = new BigDecimal("10000000");
  /** Vượt giới hạn này → chặn checkout online. Giữ hardcode, chỉ-đọc ở màn 22 (§10.6). */
  public static final BigDecimal MAX_AREA_M2 = new BigDecimal("10");

  private final ProductVariantRepository variantRepository;
  private final ProductRepository productRepository;
  private final ShippingRuleRepository ruleRepository;
  private final ShippingConfigRepository configRepository;

  /** Ngưỡng miễn phí ship hiệu lực: cấu hình admin đã lưu, mặc định 10.000.000đ. */
  public BigDecimal freeThreshold() {
    return configRepository.findByKey(ShippingConfig.KEY_SHIPPING)
        .map(ShippingConfig::getFreeThreshold)
        .filter(t -> t != null)
        .orElse(FREE_SHIPPING_THRESHOLD);
  }

  /** Kết quả tính thử phí cho 1 (diện tích, tạm tính) — dùng bởi AdminShippingService (§5.4). */
  public record PreviewResult(ShippingRule tier, BigDecimal originalFee, BigDecimal fee,
      boolean freeShipping, boolean overLimit) {}

  /**
   * Tính thử phí bằng ĐÚNG logic của quote(): tra bậc active (findTier) + ngưỡng
   * cấu hình + trần 10 m². Không tự chế công thức riêng cho màn admin (§5.4/§8).
   */
  public PreviewResult preview(BigDecimal areaM2, BigDecimal subtotal) {
    BigDecimal area = areaM2 != null ? areaM2 : BigDecimal.ZERO;
    BigDecimal sub = subtotal != null ? subtotal : BigDecimal.ZERO;
    boolean overLimit = area.compareTo(MAX_AREA_M2) > 0;
    ShippingRule rule = findTier(area);
    BigDecimal originalFee = rule != null ? rule.getFee() : null;
    boolean freeShipping = !overLimit && sub.compareTo(freeThreshold()) >= 0;
    BigDecimal fee = overLimit ? null : (freeShipping ? BigDecimal.ZERO : originalFee);
    return new PreviewResult(overLimit ? null : rule, originalFee, fee, freeShipping, overLimit);
  }

  public ShippingQuoteResponse quote(List<ShippingQuoteRequest.QuoteItem> items) {
    List<ShippingQuoteResponse.LineDto> breakdown = new ArrayList<>();
    BigDecimal totalArea = BigDecimal.ZERO;
    BigDecimal subtotal = BigDecimal.ZERO;

    for (ShippingQuoteRequest.QuoteItem item : items) {
      if (item.getQty() <= 0) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_QUANTITY",
            "Số lượng phải lớn hơn 0.");
      }
      ProductVariant variant = variantRepository.findById(item.getVariantId())
          .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "VARIANT_NOT_FOUND",
              "Không tìm thấy biến thể: " + item.getVariantId()));
      Product product = productRepository.findById(variant.getProductId()).orElse(null);

      BigDecimal lineArea = nn(variant.getLengthM())
          .multiply(nn(variant.getWidthM()))
          .multiply(BigDecimal.valueOf(item.getQty()))
          .setScale(2, RoundingMode.HALF_UP);
      totalArea = totalArea.add(lineArea);
      if (variant.getPrice() != null) {
        subtotal = subtotal.add(variant.getPrice().multiply(BigDecimal.valueOf(item.getQty())));
      }

      ShippingQuoteResponse.LineDto line = new ShippingQuoteResponse.LineDto();
      line.setVariantId(variant.getId());
      line.setProductName(product != null ? product.getName() : null);
      line.setColor(variant.getColor());
      line.setQty(item.getQty());
      line.setAreaM2(lineArea);
      breakdown.add(line);
    }
    totalArea = totalArea.setScale(2, RoundingMode.HALF_UP);

    ShippingRule rule = findTier(totalArea);
    boolean overLimit = totalArea.compareTo(MAX_AREA_M2) > 0;
    boolean freeShipping = !overLimit && subtotal.compareTo(freeThreshold()) >= 0;

    BigDecimal originalFee = rule != null ? rule.getFee() : null;
    BigDecimal fee = overLimit ? null : (freeShipping ? BigDecimal.ZERO : originalFee);

    ShippingQuoteResponse res = new ShippingQuoteResponse();
    res.setTotalAreaM2(totalArea);
    if (rule != null) {
      ShippingQuoteResponse.TierDto tier = new ShippingQuoteResponse.TierDto();
      tier.setMin(rule.getMinAreaM2());
      tier.setMax(rule.getMaxAreaM2());
      res.setTier(tier);
    }
    res.setFee(fee);
    res.setOriginalFee(originalFee);
    res.setFreeShipping(freeShipping);
    res.setOverLimit(overLimit);
    res.setBreakdown(breakdown);
    return res;
  }

  /**
   * Tìm nấc active khớp diện tích. Nấc nửa kín hai đầu [min, max], sắp xếp theo min tăng dần
   * nên biên trùng (vd: đúng 1 m²) rơi vào nấc thấp hơn — khớp bảng demo 02-ERD §4.
   */
  private ShippingRule findTier(BigDecimal area) {
    return ruleRepository.findByActiveTrue().stream()
        .filter(r -> r.getMinAreaM2() != null)
        .filter(r -> area.compareTo(r.getMinAreaM2()) >= 0
            && (r.getMaxAreaM2() == null || area.compareTo(r.getMaxAreaM2()) <= 0))
        .min(Comparator.comparing(ShippingRule::getMinAreaM2))
        .orElse(null);
  }

  private BigDecimal nn(BigDecimal v) {
    return v != null ? v : BigDecimal.ZERO;
  }
}
