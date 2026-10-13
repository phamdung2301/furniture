package com.mocan.shop.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

/**
 * Yêu cầu kiểm tra tồn kho/giá trước khi checkout — public, không cần đăng nhập.
 * Contract khớp FE: POST /cart/validate {items:[{variantId,qty,price}]}.
 */
@Data
public class ValidateCartRequest {
  private List<ValidateItem> items;

  @Data
  public static class ValidateItem {
    private String variantId;
    private int qty;
    private BigDecimal price; // giá FE đang thấy — để đối chiếu thay đổi
  }
}
