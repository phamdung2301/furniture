package com.mocan.shop.service;

import com.mocan.shop.dto.CreateOrderRequest;
import com.mocan.shop.dto.CreateOrderResponse;
import com.mocan.shop.dto.MergeCartRequest;
import com.mocan.shop.dto.MergeCartResponse;
import com.mocan.shop.dto.OrderDto;
import com.mocan.shop.dto.OrderListItemDto;
import com.mocan.shop.dto.PageResponseDto;
import com.mocan.shop.dto.ReorderResponse;
import com.mocan.shop.dto.ShippingQuoteRequest;
import com.mocan.shop.dto.ShippingQuoteResponse;
import com.mocan.shop.dto.ValidateVoucherResponse;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Address;
import com.mocan.shop.model.Cart;
import com.mocan.shop.model.Order;
import com.mocan.shop.model.Payment;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.model.User;
import com.mocan.shop.repository.AddressRepository;
import com.mocan.shop.repository.CartRepository;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.PaymentRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import com.mocan.shop.repository.ReviewRepository;
import com.mocan.shop.repository.UserRepository;
import com.mocan.shop.util.MoneyUtil;
import com.mocan.shop.util.PhoneUtil;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Đặt hàng — F-007 / FR-009, FR-010, FR-011, FR-019, FR-029, FR-030.
 * Tạo đơn từ GIỎ của user (không guest checkout): re-validate từng variant (khớp logic
 * validateCart FE) → hết hàng: từ chối cả đơn + liệt kê món; snapshot giá/tên/màu/sku/areaM2;
 * trừ stock NGUYÊN TỬ theo màu (stock >= qty); voucher validate lại + tăng usedCount nguyên tử;
 * phí ship theo diện tích (F-023); chặn cứng khi chưa xác thực SĐT (F-007 rule 1).
 * Chỉ lưu paymentMethod — MoMo thật xử lý ở màn 8 (F-008), KHÔNG gọi MoMo ở đây.
 */
@Service
@RequiredArgsConstructor
public class OrderService {

  private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final Set<String> PAYMENT_METHODS = Set.of("COD", "BANK_TRANSFER", "MOMO");

  private final OrderRepository orderRepository;
  private final PaymentRepository paymentRepository;
  private final CartRepository cartRepository;
  private final ProductVariantRepository variantRepository;
  private final ProductRepository productRepository;
  private final AddressRepository addressRepository;
  private final UserRepository userRepository;
  private final VoucherService voucherService;
  private final FlashSaleService flashSaleService;
  private final ShippingService shippingService;
  private final CartService cartService;
  private final ReviewRepository reviewRepository;
  private final MongoTemplate mongoTemplate;

  public CreateOrderResponse createOrder(String userId, CreateOrderRequest req) {
    // 1. Chặn cứng nếu chưa xác thực SĐT — F-007 rule 1 / FR-030.
    User user = userRepository.findById(userId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
            "Không tìm thấy người dùng."));
    if (!user.isPhoneVerified()) {
      throw new ApiException(HttpStatus.FORBIDDEN, "PHONE_NOT_VERIFIED",
          "Bạn cần xác thực số điện thoại trước khi đặt hàng.");
    }

    // 2. Phương thức thanh toán hợp lệ — fail fast trước khi trừ kho.
    String paymentMethod = req.getPaymentMethod() != null ? req.getPaymentMethod().trim().toUpperCase() : null;
    if (!PAYMENT_METHODS.contains(paymentMethod)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAYMENT_METHOD",
          "Phương thức thanh toán không hợp lệ.");
    }

    // 3. Giỏ hàng của user.
    Cart cart = cartRepository.findByUserId(userId).orElse(null);
    List<Cart.CartItem> cartItems = (cart != null && cart.getItems() != null) ? cart.getItems() : List.of();
    if (cartItems.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "CART_EMPTY",
          "Giỏ hàng trống, không thể tạo đơn.");
    }

    // 4. Re-validate từng variant: tồn tại, đang bán, đủ tồn — khớp logic validateCart FE.
    //    Giá chốt của dòng = giá flash nếu variant thuộc chương trình đang diễn ra +
    //    còn suất (flash-sale.md §5.4, backend resolve — FE không tự tính).
    List<Line> lines = new ArrayList<>();
    List<String> problems = new ArrayList<>();
    BigDecimal subtotal = BigDecimal.ZERO;
    BigDecimal nonFlashSubtotal = BigDecimal.ZERO;
    List<FlashSaleService.ClaimLine> flashLines = new ArrayList<>();
    Map<String, Integer> flashQtyByProgram = new HashMap<>();
    for (Cart.CartItem ci : cartItems) {
      ProductVariant v = ci.getVariantId() != null
          ? variantRepository.findById(ci.getVariantId()).orElse(null) : null;
      Product p = v != null ? productRepository.findById(v.getProductId()).orElse(null) : null;
      if (v == null || p == null || !p.isActive()) {
        problems.add((p != null ? p.getName() : "Sản phẩm") + " đã ngừng kinh doanh");
        continue;
      }
      if (ci.getQty() <= 0 || v.getStock() < ci.getQty()) {
        problems.add(p.getName() + " (màu " + v.getColor() + ")");
        continue;
      }
      FlashSaleService.ResolvedPrice resolved = flashSaleService.resolvePrice(v);
      Line line = new Line(v, p, ci.getQty(), resolved.price(), resolved.programId());
      lines.add(line);
      BigDecimal lineTotal = resolved.price().multiply(BigDecimal.valueOf(ci.getQty()));
      subtotal = subtotal.add(lineTotal);
      if (resolved.isFlash()) {
        flashLines.add(new FlashSaleService.ClaimLine(resolved.programId(),
            v.getProductId(), v.getId(), p.getName(), v.getPrice(), ci.getQty()));
        flashQtyByProgram.merge(resolved.programId(), ci.getQty(), Integer::sum);
      } else {
        nonFlashSubtotal = nonFlashSubtotal.add(lineTotal);
      }
    }
    if (!problems.isEmpty()) {
      String msg = problems.size() == 1
          ? "Sản phẩm " + problems.get(0) + " vừa hết hàng. Đơn chưa được tạo."
          : "Các sản phẩm sau vừa hết hàng, đơn chưa được tạo: " + String.join("; ", problems) + ".";
      throw new ApiException(HttpStatus.BAD_REQUEST, "OUT_OF_STOCK", msg);
    }

    // 4b. Giới hạn flash sale: 1 khách tối đa 2 suất / chương trình (F-022 [Giả định]) —
    //     tính cả các đơn trước chưa hủy của khách trong cùng chương trình.
    for (Map.Entry<String, Integer> e : flashQtyByProgram.entrySet()) {
      int bought = flashSaleService.countUserProgramQty(userId, e.getKey());
      if (bought + e.getValue() > FlashSaleService.MAX_SLOTS_PER_CUSTOMER) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "FLASH_LIMIT",
            "Mỗi khách hàng tối đa 2 suất cho mỗi chương trình flash sale.");
      }
    }

    // 5. Voucher (nếu có): validate lại theo subtotal chốt.
    //    KHÔNG cộng dồn với flash sale (F-022): mã thường chỉ tính trên các dòng thường;
    //    đơn toàn món flash sale -> báo rõ không áp dụng thêm mã.
    String voucherCode = req.getVoucherCode() != null && !req.getVoucherCode().isBlank()
        ? req.getVoucherCode().trim().toUpperCase() : null;
    BigDecimal discount = BigDecimal.ZERO;
    if (voucherCode != null) {
      if (!flashLines.isEmpty() && nonFlashSubtotal.compareTo(BigDecimal.ZERO) == 0) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "FLASH_NO_VOUCHER",
            "Đơn hàng flash sale không áp dụng thêm mã giảm giá.");
      }
      // Ép phạm vi + giới hạn mỗi khách (admin-voucher.md §9.1/§9.3): cơ số
      // chỉ gồm các dòng THƯỜNG thuộc phạm vi của voucher — dòng flash sale
      // không bao giờ nằm trong cơ số (F-022).
      List<VoucherService.ScopedLine> voucherLines = lines.stream()
          .filter(l -> l.flashProgramId == null)
          .map(l -> new VoucherService.ScopedLine(
              l.product.getId(),
              l.product.getCategoryId(),
              l.price.multiply(BigDecimal.valueOf(l.qty))))
          .toList();
      ValidateVoucherResponse vr =
          voucherService.validateForOrder(voucherCode, userId, voucherLines);
      if (!vr.isValid()) {
        throw new ApiException(HttpStatus.BAD_REQUEST, vr.getErrorCode(),
            vr.getMessage() + " Vui lòng chọn mã khác.");
      }
      discount = vr.getDiscount();
    }

    // 6. Phí ship theo tổng diện tích — F-023. Đơn > 10 m²: chặn, liên hệ báo giá riêng.
    List<ShippingQuoteRequest.QuoteItem> quoteItems = new ArrayList<>();
    for (Line line : lines) {
      ShippingQuoteRequest.QuoteItem qi = new ShippingQuoteRequest.QuoteItem();
      qi.setVariantId(line.variant.getId());
      qi.setQty(line.qty);
      quoteItems.add(qi);
    }
    ShippingQuoteResponse quote = shippingService.quote(quoteItems);
    if (quote.isOverLimit()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "OVER_LIMIT",
          "Đơn hàng vượt 10 m² cần báo giá riêng — vui lòng liên hệ hotline.");
    }
    BigDecimal shippingFee = quote.getFee() != null ? quote.getFee() : BigDecimal.ZERO;

    // 7. Người nhận: addressId (phải thuộc đúng user) hoặc nhập tay.
    Order.Receiver receiver = resolveReceiver(userId, req);

    // 7b. Tranh suất flash sale NGUYÊN TỬ (F-022 edge case: 2 khách tranh suất cuối).
    //     Đặt TRƯỚC khi trừ kho: claim hỏng -> chưa có mutation nào khác phải hoàn.
    //     Người đến sau nhận lỗi hết suất + message về giá thường (flash-sale.md §5.4);
    //     FE đã cảnh báo trước ở bước validate giỏ (pattern F-005).
    if (!flashLines.isEmpty()) {
      FlashSaleService.ClaimLine failed = flashSaleService.claim(flashLines);
      if (failed != null) {
        throw new ApiException(HttpStatus.CONFLICT, "FLASH_SOLD_OUT",
            "Chương trình flash sale đã kết thúc hoặc hết suất — " + failed.productName()
                + " trở về giá thường " + MoneyUtil.vnd(failed.originalPrice()) + ".");
      }
    }

    // 8. Mutations: trừ stock nguyên tử từng màu; thất bại giữa chừng → hoàn kho + hoàn suất.
    List<Line> decremented = new ArrayList<>();
    for (Line line : lines) {
      if (!decrementStock(line.variant.getId(), line.qty)) {
        restoreStock(decremented);
        flashSaleService.releaseClaims(flashLines);
        throw new ApiException(HttpStatus.CONFLICT, "OUT_OF_STOCK",
            "Sản phẩm " + line.product.getName() + " (màu " + line.variant.getColor()
                + ") vừa hết hàng. Đơn chưa được tạo.");
      }
      decremented.add(line);
    }
    if (voucherCode != null) {
      try {
        voucherService.apply(voucherCode);
      } catch (ApiException e) {
        restoreStock(decremented);
        flashSaleService.releaseClaims(flashLines);
        throw e;
      }
    }

    // 9. Dựng Order: snapshot + totals + trạng thái MỚI.
    Order order = new Order();
    order.setOrderNumber(nextOrderNumber());
    order.setUserId(userId);
    List<Order.OrderItem> items = new ArrayList<>();
    for (Line line : lines) {
      Order.OrderItem oi = new Order.OrderItem();
      oi.setVariantId(line.variant.getId());
      oi.setSku(line.variant.getSku());
      oi.setProductSlug(line.product.getSlug());
      oi.setProductName(line.product.getName());
      oi.setColor(line.variant.getColor());
      oi.setColorHex(line.variant.getColorHex());
      oi.setImage(firstImage(line.product));
      oi.setPrice(line.price); // giá chốt (flash nếu có) — snapshot như F-007
      oi.setFlashSaleProgramId(line.flashProgramId);
      oi.setQty(line.qty);
      oi.setAreaM2(nn(line.variant.getLengthM())
          .multiply(nn(line.variant.getWidthM()))
          .multiply(BigDecimal.valueOf(line.qty))
          .setScale(2, RoundingMode.HALF_UP));
      items.add(oi);
    }
    order.setItems(items);
    order.setSubtotal(subtotal);
    order.setDiscount(discount);
    order.setShippingFee(shippingFee);
    order.setTotal(subtotal.subtract(discount).add(shippingFee));
    order.setVoucherCode(voucherCode);
    order.setReceiver(receiver);
    order.setStatus("MỚI");
    Order.StatusHistory h = new Order.StatusHistory();
    h.setStatus("MỚI");
    h.setAt(Instant.now());
    h.setNote("Đơn hàng được tạo");
    order.setStatusHistory(List.of(h));
    order.setPaymentMethod(paymentMethod);
    order.setNote(req.getNote() != null && !req.getNote().isBlank() ? req.getNote().trim() : null);
    order.setCreatedAt(Instant.now());
    orderRepository.save(order);

    // 10. Xóa giỏ sau khi đặt thành công (dat-hang.md §6).
    cart.setItems(new ArrayList<>());
    cart.setUpdatedAt(Instant.now());
    cartRepository.save(cart);

    CreateOrderResponse res = new CreateOrderResponse();
    res.setId(order.getId());
    res.setOrderNumber(order.getOrderNumber());
    res.setTotal(order.getTotal());
    res.setPaymentMethod(order.getPaymentMethod());
    res.setStatus(order.getStatus());
    return res;
  }

  /** Chi tiết đơn — chỉ đơn của chính user. Nhận id hoặc orderNumber. Kèm khối payment cho FE poll. */
  public OrderDto getOrder(String userId, String identifier) {
    Order order = orderRepository.findById(identifier)
        .or(() -> orderRepository.findByOrderNumber(identifier))
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND",
            "Không tìm thấy đơn hàng."));
    if (!userId.equals(order.getUserId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN",
          "Bạn không có quyền xem đơn hàng này.");
    }
    Payment payment = latestPayment(order.getId());
    Map<String, String> productIdByVariantId = new HashMap<>();
    Set<String> reviewedProductIds = new HashSet<>();
    if (order.getItems() != null) {
      for (Order.OrderItem oi : order.getItems()) {
        if (oi.getVariantId() == null) continue;
        ProductVariant v = variantRepository.findById(oi.getVariantId()).orElse(null);
        if (v == null) continue;
        productIdByVariantId.put(oi.getVariantId(), v.getProductId());
        if (reviewRepository.existsByProductIdAndUserId(v.getProductId(), userId)) {
          reviewedProductIds.add(v.getProductId());
        }
      }
    }
    return OrderDto.from(order, payment, productIdByVariantId, reviewedProductIds);
  }

  /**
   * Danh sách đơn của user — màn Theo dõi đơn (FR-016, US-009).
   * page 1-indexed (khớp PageResponseDto), mới nhất trước; statuses rỗng = tất cả.
   */
  public PageResponseDto<OrderListItemDto> listOrders(String userId, List<String> statuses,
      int page, int size) {
    int safePage = Math.max(1, page);
    int safeSize = Math.min(50, Math.max(1, size));
    PageRequest pageable = PageRequest.of(safePage - 1, safeSize,
        Sort.by(Sort.Direction.DESC, "createdAt"));
    Page<Order> result = (statuses == null || statuses.isEmpty())
        ? orderRepository.findByUserId(userId, pageable)
        : orderRepository.findByUserIdAndStatusIn(userId, statuses, pageable);
    List<OrderListItemDto> content = result.getContent().stream()
        .map(o -> toListItem(userId, o))
        .toList();
    return PageResponseDto.of(content, result.getTotalElements(), safePage, safeSize);
  }

  private OrderListItemDto toListItem(String userId, Order o) {
    OrderListItemDto d = new OrderListItemDto();
    d.setOrderNumber(o.getOrderNumber());
    d.setCreatedAt(o.getCreatedAt());
    d.setTotal(o.getTotal());
    d.setStatus(o.getStatus());
    d.setPaymentMethod(o.getPaymentMethod());
    Payment payment = latestPayment(o.getId());
    d.setPaymentStatus(payment != null && payment.getStatus() != null
        ? payment.getStatus() : "CHƯA THANH TOÁN");
    List<Order.OrderItem> items = o.getItems() != null ? o.getItems() : List.of();
    d.setItemCount(items.size());
    d.setItemsPreview(items.stream().limit(3).map(oi -> {
      OrderListItemDto.Preview pv = new OrderListItemDto.Preview();
      pv.setImage(oi.getImage());
      pv.setProductName(oi.getProductName());
      return pv;
    }).toList());
    boolean hasUnreviewed = false;
    if ("HOÀN THÀNH".equals(o.getStatus())) {
      for (Order.OrderItem oi : items) {
        if (oi.getVariantId() == null) continue;
        ProductVariant v = variantRepository.findById(oi.getVariantId()).orElse(null);
        if (v != null && !reviewRepository.existsByProductIdAndUserId(v.getProductId(), userId)) {
          hasUnreviewed = true;
          break;
        }
      }
    }
    d.setHasUnreviewedItems(hasUnreviewed);
    return d;
  }

  /**
   * Đặt lại đơn hàng — theo-doi-don.md §5 [Giả định UX]: thêm lại các món
   * trong đơn cũ vào giỏ hiện tại của user theo snapshot, kiểm tra tồn
   * hiện tại qua CartService.merge (cùng luật F-006: cap qty theo stock,
   * skip not_found/discontinued/out_of_stock).
   */
  public ReorderResponse reorder(String userId, String orderNumber) {
    Order order = orderRepository.findById(orderNumber)
        .or(() -> orderRepository.findByOrderNumber(orderNumber))
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND",
            "Không tìm thấy đơn hàng."));
    if (!userId.equals(order.getUserId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN",
          "Bạn không có quyền thao tác với đơn hàng này.");
    }
    List<Order.OrderItem> items = order.getItems() != null ? order.getItems() : List.of();
    List<MergeCartRequest.MergeItem> mergeItems = new ArrayList<>();
    Map<String, Order.OrderItem> byVariantId = new HashMap<>();
    for (Order.OrderItem oi : items) {
      if (oi.getVariantId() == null) continue;
      MergeCartRequest.MergeItem mi = new MergeCartRequest.MergeItem();
      mi.setVariantId(oi.getVariantId());
      mi.setQty(oi.getQty());
      mergeItems.add(mi);
      byVariantId.put(oi.getVariantId(), oi);
    }
    MergeCartResponse merged = cartService.merge(userId, mergeItems);
    ReorderResponse res = new ReorderResponse();
    res.setAdded(merged.getMergedCount());
    List<ReorderResponse.SkippedItem> skipped = new ArrayList<>();
    if (merged.getSkipped() != null) {
      for (MergeCartResponse.SkippedItem s : merged.getSkipped()) {
        Order.OrderItem oi = byVariantId.get(s.getVariantId());
        ReorderResponse.SkippedItem sk = new ReorderResponse.SkippedItem();
        sk.setVariantId(s.getVariantId());
        sk.setProductName(oi != null ? oi.getProductName() : null);
        sk.setColor(oi != null ? oi.getColor() : null);
        sk.setReason(s.getReason());
        skipped.add(sk);
      }
    }
    res.setSkipped(skipped);
    return res;
  }

  /**
   * POST /orders/{orderNumber}/cancel — F-009. Hủy khi đơn còn MỚI và chưa thanh toán
   * → hoàn kho + hoàn lượt voucher. Đơn MoMo đã thanh toán → 409.
   * reason (không bắt buộc): lý do user nhập ở trang chi tiết đơn — ghi vào
   * statusHistory để timeline hiển thị; vắng mặt -> "Bạn đã hủy đơn".
   */
  public void cancelOrder(String userId, String orderNumber) {
    cancelOrder(userId, orderNumber, null);
  }

  public void cancelOrder(String userId, String orderNumber, String reason) {
    Order order = orderRepository.findById(orderNumber)
        .or(() -> orderRepository.findByOrderNumber(orderNumber))
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND",
            "Không tìm thấy đơn hàng."));
    if (!userId.equals(order.getUserId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN",
          "Bạn không có quyền hủy đơn hàng này.");
    }
    if (!"MỚI".equals(order.getStatus())) {
      throw new ApiException(HttpStatus.CONFLICT, "CANNOT_CANCEL",
          "Đơn hàng đang được xử lý, vui lòng liên hệ hotline 1900 6868 để được hỗ trợ.");
    }
    Payment payment = latestPayment(order.getId());
    if (payment != null && "ĐÃ THANH TOÁN".equals(payment.getStatus())) {
      throw new ApiException(HttpStatus.CONFLICT, "CANNOT_CANCEL",
          "Đơn đã được thanh toán, không thể hủy. Vui lòng liên hệ shop để được hỗ trợ.");
    }
    String note = reason != null && !reason.isBlank() ? reason.trim() : "Bạn đã hủy đơn";
    cancelOrderInternal(order, note);
  }

  /**
   * Scheduler hết hạn giữ đơn MoMo — F-008, US-012.
   *
   * CHỌN CÁCH NÀY (thay vì check lazy lúc poll/getOrder) vì: đơn phải tự hủy đúng
   * 30 phút ngay cả khi user đóng tab (FE không poll nữa) — kho và lượt voucher được
   * hoàn đúng giờ, không phụ thuộc client.
   *
   * Chạy mỗi phút: quét payment CHƯA THANH TOÁN đã quá expiresAt → đơn còn MỚI (+MOMO)
   * → hủy nguyên tử + hoàn kho + hoàn lượt voucher.
   */
  @Scheduled(fixedDelay = 60000)
  public void expireUnpaidMomoOrders() {
    List<Payment> expired = paymentRepository
        .findByStatusAndExpiresAtBefore("CHƯA THANH TOÁN", Instant.now());
    for (Payment p : expired) {
      Order order = orderRepository.findById(p.getOrderId()).orElse(null);
      if (order == null || !"MỚI".equals(order.getStatus())
          || !"MOMO".equals(order.getPaymentMethod())) {
        continue;
      }
      cancelOrderInternal(order, "Tự động hủy: hết 30 phút giữ thanh toán MoMo", true);
    }
  }

  // ---------- helpers ----------

  /** Payment mới nhất của đơn (null nếu đơn COD/chưa tạo payment). */
  private Payment latestPayment(String orderId) {
    List<Payment> list = paymentRepository.findByOrderIdOrderByCreatedAtDesc(orderId);
    return list.isEmpty() ? null : list.get(0);
  }

  /**
   * Đường hủy đơn DÙNG CHUNG duy nhất (F-009) — khách tự hủy (màn 11), admin
   * hủy (màn 17), scheduler tự hủy quá hạn MoMo (màn 8) đều đi qua đây:
   * chuyển trạng thái NGUYÊN TỬ {expectedStatus} → ĐÃ HỦY (thắng race với IPN
   * thành công đến cùng lúc: bên nào đổi trước thì bên còn lại thấy status đã
   * đổi và bỏ qua) → hoàn kho từng variant + hoàn lượt voucher + hoàn suất
   * flash sale. KHÔNG viết logic hoàn thứ hai ở nơi khác.
   *
   * @return true nếu đã hủy thật; false nếu đơn đã bị đổi trạng thái trước đó.
   */
  private boolean transitionToCancelled(Order order, String expectedStatus, String note,
      boolean bySystem) {
    Query q = Query.query(Criteria.where("_id").is(order.getId()).and("status").is(expectedStatus));
    Update u = new Update()
        .set("status", "ĐÃ HỦY")
        .push("statusHistory", new Document("status", "ĐÃ HỦY")
            .append("at", Instant.now())
            .append("note", note)
            .append("bySystem", bySystem));
    com.mongodb.client.result.UpdateResult r = mongoTemplate.updateFirst(q, u, Order.class);
    if (r.getModifiedCount() == 0) {
      return false; // đơn đã đổi trạng thái bởi luồng khác (IPN/scheduler) — bỏ qua
    }
    restoreStockFromOrder(order);
    if (order.getVoucherCode() != null && !order.getVoucherCode().isBlank()) {
      voucherService.release(order.getVoucherCode());
    }
    // Hoàn suất flash sale của các dòng trong đơn (F-022) — no-op nếu không có dòng flash.
    flashSaleService.release(order);
    return true;
  }

  private void cancelOrderInternal(Order order, String note) {
    cancelOrderInternal(order, note, false);
  }

  private void cancelOrderInternal(Order order, String note, boolean bySystem) {
    transitionToCancelled(order, "MỚI", note, bySystem);
  }

  /**
   * Admin hủy đơn (màn 17 — FR-012/FR-013): được hủy từ MỚI hoặc ĐÃ XÁC NHẬN,
   * dùng ĐÚNG đường hủy chung ở trên (hoàn kho + hoàn voucher + hoàn suất
   * flash). Việc đánh dấu Payment → HOÀN TIỀN (nếu đã thu) do AdminOrderService
   * xử lý sau khi hủy thành công.
   *
   * @return true nếu đã hủy; false nếu trạng thái hiện tại không hủy được nữa
   *         hoặc vừa bị luồng khác đổi (admin nhận 422 kèm trạng thái mới).
   */
  public boolean cancelOrderByAdmin(Order order, String reason) {
    String current = order.getStatus();
    if (!"MỚI".equals(current) && !"ĐÃ XÁC NHẬN".equals(current)) {
      return false;
    }
    return transitionToCancelled(order, current, reason, false);
  }

  /** Hoàn kho theo snapshot items của đơn (không trừ âm, chỉ cộng lại). */
  private void restoreStockFromOrder(Order order) {
    if (order.getItems() == null) return;
    for (Order.OrderItem item : order.getItems()) {
      if (item.getVariantId() == null || item.getQty() <= 0) continue;
      mongoTemplate.updateFirst(
          Query.query(Criteria.where("_id").is(item.getVariantId())),
          new Update().inc("stock", item.getQty()), ProductVariant.class);
    }
  }

  private Order.Receiver resolveReceiver(String userId, CreateOrderRequest req) {
    if (req.getAddressId() != null && !req.getAddressId().isBlank()) {
      Address a = addressRepository.findByIdAndUserId(req.getAddressId().trim(), userId)
          .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ADDRESS_NOT_FOUND",
              "Không tìm thấy địa chỉ nhận hàng."));
      Order.Receiver r = new Order.Receiver();
      r.setName(a.getReceiverName());
      r.setPhone(a.getPhone());
      r.setProvince(a.getProvince());
      r.setDistrict(a.getDistrict());
      r.setWard(a.getWard());
      r.setDetail(a.getDetail());
      return r;
    }
    CreateOrderRequest.ReceiverDto in = req.getReceiver();
    if (in == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RECEIVER",
          "Vui lòng chọn địa chỉ nhận hàng.");
    }
    if (blank(in.getName())) throw badReceiver("Vui lòng nhập họ tên người nhận.");
    String phone = PhoneUtil.normalize(in.getPhone());
    if (!PhoneUtil.isValidVn(phone)) throw badReceiver("Số điện thoại người nhận không hợp lệ.");
    if (blank(in.getProvince())) throw badReceiver("Vui lòng chọn Tỉnh/Thành phố.");
    if (blank(in.getDistrict())) throw badReceiver("Vui lòng chọn Quận/Huyện.");
    if (blank(in.getWard())) throw badReceiver("Vui lòng chọn Phường/Xã.");
    if (blank(in.getDetail())) throw badReceiver("Vui lòng nhập địa chỉ chi tiết.");
    Order.Receiver r = new Order.Receiver();
    r.setName(in.getName().trim());
    r.setPhone(phone);
    r.setProvince(in.getProvince().trim());
    r.setDistrict(in.getDistrict().trim());
    r.setWard(in.getWard().trim());
    r.setDetail(in.getDetail().trim());
    return r;
  }

  private ApiException badReceiver(String msg) {
    return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RECEIVER", msg);
  }

  /** Trừ kho nguyên tử: chỉ trừ khi stock >= qty (02-ERD §3: cấm âm kho). */
  private boolean decrementStock(String variantId, int qty) {
    Query q = Query.query(Criteria.where("_id").is(variantId).and("stock").gte(qty));
    Update u = new Update().inc("stock", -qty);
    ProductVariant updated = mongoTemplate.findAndModify(q, u,
        FindAndModifyOptions.options().returnNew(true), ProductVariant.class);
    return updated != null;
  }

  private void restoreStock(List<Line> lines) {
    for (Line line : lines) {
      mongoTemplate.updateFirst(
          Query.query(Criteria.where("_id").is(line.variant.getId())),
          new Update().inc("stock", line.qty), ProductVariant.class);
    }
  }

  /**
   * Sinh orderNumber NT-yyyyMMdd-xxxx duy nhất: sequence nguyên tử qua collection `counters`
   * (findAndModify + upsert). Fallback timestamp nếu counters lỗi — unique index vẫn bảo vệ.
   */
  private String nextOrderNumber() {
    String date = LocalDate.now(VN).format(DateTimeFormatter.BASIC_ISO_DATE); // yyyyMMdd
    try {
      Query q = Query.query(Criteria.where("_id").is("order_seq"));
      Update u = new Update().inc("seq", 1);
      FindAndModifyOptions opts = FindAndModifyOptions.options().returnNew(true).upsert(true);
      Document doc = mongoTemplate.findAndModify(q, u, opts, Document.class, "counters");
      long seq = 1;
      if (doc != null && doc.get("seq") instanceof Number) {
        seq = ((Number) doc.get("seq")).longValue();
      }
      return "NT-" + date + "-" + String.format("%04d", seq);
    } catch (Exception e) {
      return "NT-" + date + "-" + String.format("%04d", System.currentTimeMillis() % 10000);
    }
  }

  private String firstImage(Product product) {
    if (product == null || product.getImages() == null || product.getImages().isEmpty()) {
      return null;
    }
    return product.getImages().get(0).getUrl();
  }

  private boolean blank(String s) {
    return s == null || s.trim().isEmpty();
  }

  private BigDecimal nn(BigDecimal v) {
    return v != null ? v : BigDecimal.ZERO;
  }

  private static final class Line {
    final ProductVariant variant;
    final Product product;
    final int qty;
    final BigDecimal price; // giá chốt của dòng (flash nếu thuộc chương trình)
    final String flashProgramId; // null = dòng thường

    Line(ProductVariant variant, Product product, int qty, BigDecimal price,
        String flashProgramId) {
      this.variant = variant;
      this.product = product;
      this.qty = qty;
      this.price = price;
      this.flashProgramId = flashProgramId;
    }
  }
}
