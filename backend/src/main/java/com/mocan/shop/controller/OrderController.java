package com.mocan.shop.controller;

import com.mocan.shop.dto.CancelOrderRequest;
import com.mocan.shop.dto.CreateOrderRequest;
import com.mocan.shop.dto.CreateOrderResponse;
import com.mocan.shop.dto.OrderDto;
import com.mocan.shop.dto.OrderListItemDto;
import com.mocan.shop.dto.PageResponseDto;
import com.mocan.shop.dto.ReorderResponse;
import com.mocan.shop.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

/**
 * Đặt hàng — F-007 + Theo dõi đơn — FR-016/F-009. Không guest checkout:
 * mọi endpoint yêu cầu đăng nhập. userId = JWT subject
 * (SecurityContextHolder), pattern như CartController.
 */
@RestController
@RequiredArgsConstructor
public class OrderController {

  private final OrderService orderService;

  @PostMapping("/orders")
  @ResponseStatus(HttpStatus.CREATED)
  public CreateOrderResponse create(@RequestBody CreateOrderRequest request) {
    return orderService.createOrder(currentUserId(), request);
  }

  /**
   * Danh sách đơn của user — ?status=MỚI,ĐÃ XÁC NHẬN (danh sách trạng thái,
   * vắng mặt = tất cả), ?page= (1-indexed) & ?size=, mới nhất trước.
   */
  @GetMapping("/orders")
  public PageResponseDto<OrderListItemDto> list(
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int size) {
    List<String> statuses = (status == null || status.isBlank())
        ? List.of()
        : Arrays.stream(status.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
    return orderService.listOrders(currentUserId(), statuses, page, size);
  }

  @GetMapping("/orders/{identifier}")
  public OrderDto get(@PathVariable String identifier) {
    return orderService.getOrder(currentUserId(), identifier);
  }

  @PostMapping("/orders/{orderNumber}/cancel")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void cancel(@PathVariable String orderNumber,
      @RequestBody(required = false) CancelOrderRequest request) {
    orderService.cancelOrder(currentUserId(), orderNumber,
        request != null ? request.getReason() : null);
  }

  /** Đặt lại đơn hàng: thêm lại món vào giỏ theo snapshot, kiểm tra tồn. */
  @PostMapping("/orders/{orderNumber}/reorder")
  public ReorderResponse reorder(@PathVariable String orderNumber) {
    return orderService.reorder(currentUserId(), orderNumber);
  }

  private String currentUserId() {
    return SecurityContextHolder.getContext().getAuthentication().getName();
  }
}
