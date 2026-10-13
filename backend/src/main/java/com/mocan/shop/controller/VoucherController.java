package com.mocan.shop.controller;

import com.mocan.shop.dto.ValidateVoucherRequest;
import com.mocan.shop.dto.ValidateVoucherResponse;
import com.mocan.shop.dto.VoucherAvailableDto;
import com.mocan.shop.service.VoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Voucher — F-007 rule 2 / FR-019.
 * GET /vouchers/available yêu cầu đăng nhập; POST /vouchers/validate là PUBLIC
 * (FE có thể kiểm tra mã trước khi login).
 */
@RestController
@RequiredArgsConstructor
public class VoucherController {

  private final VoucherService voucherService;

  @GetMapping("/vouchers/available")
  public List<VoucherAvailableDto> available(
      @RequestParam(required = false) BigDecimal subtotal) {
    return voucherService.available(subtotal);
  }

  @PostMapping("/vouchers/validate")
  public ValidateVoucherResponse validate(@RequestBody ValidateVoucherRequest request) {
    return voucherService.validate(request.getCode(), request.getSubtotal());
  }
}
