package com.mocan.shop.controller;

import com.mocan.shop.dto.MomoCreateRequest;
import com.mocan.shop.dto.MomoCreateResponse;
import com.mocan.shop.dto.PaymentStatusResponse;
import com.mocan.shop.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Thanh toán MoMo — F-008.
 * - POST /payments/momo/create, GET /payments/status/{orderNumber}: yêu cầu đăng nhập,
 *   user chỉ thao tác đơn của mình.
 * - POST /payments/momo/ipn: PUBLIC (MoMo server gọi) — permitAll trong SecurityConfig;
 *   an toàn nhờ verify chữ ký HMAC-SHA256 trước mọi cập nhật.
 */
@RestController
@RequiredArgsConstructor
public class PaymentController {

  private final PaymentService paymentService;

  @PostMapping("/payments/momo/create")
  @ResponseStatus(HttpStatus.CREATED)
  public MomoCreateResponse create(@RequestBody MomoCreateRequest request) {
    return paymentService.createMomoPayment(currentUserId(), request.getOrderNumber());
  }

  @PostMapping("/payments/momo/ipn")
  public ResponseEntity<Void> ipn(@RequestBody Map<String, Object> body) {
    paymentService.handleIpn(body);
    return ResponseEntity.ok().build();
  }

  @GetMapping("/payments/status/{orderNumber}")
  public PaymentStatusResponse status(@PathVariable String orderNumber) {
    return paymentService.queryStatus(currentUserId(), orderNumber);
  }

  private String currentUserId() {
    return SecurityContextHolder.getContext().getAuthentication().getName();
  }
}
