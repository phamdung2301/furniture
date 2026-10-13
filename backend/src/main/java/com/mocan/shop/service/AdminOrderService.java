package com.mocan.shop.service;

import com.mocan.shop.dto.AdminOrderDetailDto;
import com.mocan.shop.dto.AdminOrderListItemDto;
import com.mocan.shop.dto.AdminOrderListResponseDto;
import com.mocan.shop.dto.AdminOrderNoteRequest;
import com.mocan.shop.dto.AdminOrderStatusRequest;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Order;
import com.mocan.shop.model.Payment;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Quản lý đơn hàng (admin) — FR-022 · FR-012 · F-016 (admin-don-hang.md §2/§4/§7).
 *
 * State machine FR-012 validate LẠI ở backend (FE chỉ hiện nút hợp lệ):
 *   MỚI → ĐÃ XÁC NHẬN | ĐÃ HỦY
 *   ĐÃ XÁC NHẬN → ĐANG GIAO (bắt buộc mã vận đơn) | ĐÃ HỦY
 *   ĐANG GIAO → HOÀN THÀNH | HOÀN TRẢ (khách từ chối nhận)
 *   HOÀN THÀNH → HOÀN TRẢ (trong 7 ngày kể từ mốc hoàn thành)
 *   ĐÃ HỦY / HOÀN TRẢ → trạng thái cuối
 * Sai ma trận / thiếu mã vận đơn / thiếu lý do / quá 7 ngày → 422 { message,
 * currentStatus } để FE toast đúng message + tải lại chi tiết.
 *
 * Hủy đơn đi qua ĐƯỜNG HỦY CHUNG của OrderService (hoàn kho + hoàn lượt
 * voucher + hoàn suất flash sale) — không có logic hoàn thứ hai ở đây.
 * Hoàn trả KHÔNG tự hoàn kho (hàng hoàn phải kiểm trước khi nhập lại —
 * admin-don-hang.md §4.6 [Giả định]).
 */
@Service
@RequiredArgsConstructor
public class AdminOrderService {

  private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

  public static final String MOI = "MỚI";
  public static final String DA_XAC_NHAN = "ĐÃ XÁC NHẬN";
  public static final String DANG_GIAO = "ĐANG GIAO";
  public static final String HOAN_THANH = "HOÀN THÀNH";
  public static final String DA_HUY = "ĐÃ HỦY";
  public static final String HOAN_TRA = "HOÀN TRẢ";

  private static final List<String> ALL_STATUSES =
      List.of(MOI, DA_XAC_NHAN, DANG_GIAO, HOAN_THANH, DA_HUY, HOAN_TRA);

  private static final Map<String, Set<String>> TRANSITIONS = Map.of(
      MOI, Set.of(DA_XAC_NHAN, DA_HUY),
      DA_XAC_NHAN, Set.of(DANG_GIAO, DA_HUY),
      DANG_GIAO, Set.of(HOAN_THANH, HOAN_TRA),
      HOAN_THANH, Set.of(HOAN_TRA),
      DA_HUY, Set.of(),
      HOAN_TRA, Set.of());

  /** Nhãn hiển thị Title Case — khớp thuật ngữ màn 11 (message lỗi cho admin đọc). */
  private static final Map<String, String> LABELS = Map.of(
      MOI, "Mới",
      DA_XAC_NHAN, "Đã xác nhận",
      DANG_GIAO, "Đang giao",
      HOAN_THANH, "Hoàn thành",
      DA_HUY, "Đã hủy",
      HOAN_TRA, "Hoàn trả");

  private static final Map<String, String> COUNT_KEYS = Map.of(
      MOI, "MOI",
      DA_XAC_NHAN, "DA_XAC_NHAN",
      DANG_GIAO, "DANG_GIAO",
      HOAN_THANH, "HOAN_THANH",
      DA_HUY, "DA_HUY",
      HOAN_TRA, "HOAN_TRA");

  private final OrderRepository orderRepository;
  private final PaymentRepository paymentRepository;
  private final OrderService orderService;
  private final MongoTemplate mongoTemplate;

  /* ------------------------------ Danh sách ------------------------------ */

  /**
   * GET /admin/orders — lọc trạng thái (slug §2.5 hoặc enum) / phương thức /
   * khoảng ngày / từ khóa (mã đơn, tên, SĐT người nhận) + sort + phân trang.
   * statusCounts tính theo các lọc còn lại, bỏ qua chính lọc trạng thái (§2.1).
   */
  public AdminOrderListResponseDto list(String statusParam, String paymentMethod,
      String from, String to, String q, String sort, int page, int size) {
    int safePage = Math.max(1, page);
    int safeSize = Math.min(50, Math.max(1, size));
    List<String> statusFilter = normalizeStatusFilter(statusParam); // null = tất cả

    Criteria base = baseCriteria(paymentMethod, from, to, q);

    // Đếm theo trạng thái (không tính lọc trạng thái).
    Map<String, Long> counts = new LinkedHashMap<>();
    long all = base == null
        ? mongoTemplate.count(new Query(), Order.class)
        : mongoTemplate.count(new Query(base), Order.class);
    counts.put("ALL", all);
    for (String st : ALL_STATUSES) {
      Criteria c = Criteria.where("status").is(st);
      if (base != null) c = new Criteria().andOperator(base, c);
      counts.put(COUNT_KEYS.get(st), mongoTemplate.count(new Query(c), Order.class));
    }

    Criteria criteria = base;
    if (statusFilter != null) {
      Criteria sc = Criteria.where("status").in(statusFilter);
      criteria = criteria == null ? sc : new Criteria().andOperator(criteria, sc);
    }
    Query query = criteria == null ? new Query() : new Query(criteria);
    long total = mongoTemplate.count(query, Order.class);
    query.with(parseSort(sort));
    query.skip((long) (safePage - 1) * safeSize).limit(safeSize);
    List<Order> orders = mongoTemplate.find(query, Order.class);

    AdminOrderListResponseDto res = new AdminOrderListResponseDto();
    res.setContent(orders.stream().map(this::toListItem).toList());
    res.setTotalElements(total);
    res.setTotalPages(safeSize > 0 ? (int) Math.ceil((double) total / safeSize) : 0);
    res.setPage(safePage);
    res.setSize(safeSize);
    res.setStatusCounts(counts);
    return res;
  }

  /** Các lọc NGOÀI trạng thái: phương thức + khoảng ngày createdAt + từ khóa. */
  private Criteria baseCriteria(String paymentMethod, String from, String to, String q) {
    List<Criteria> parts = new ArrayList<>();
    if (paymentMethod != null && !paymentMethod.isBlank()) {
      parts.add(Criteria.where("paymentMethod").is(paymentMethod.trim().toUpperCase()));
    }
    Instant fromInstant = parseFrom(from);
    Instant toInstant = parseTo(to);
    if (fromInstant != null || toInstant != null) {
      Criteria date = Criteria.where("createdAt");
      if (fromInstant != null) date = date.gte(fromInstant);
      if (toInstant != null) date = date.lt(toInstant);
      parts.add(date);
    }
    if (q != null && !q.isBlank()) {
      String pattern = Pattern.quote(q.trim());
      parts.add(new Criteria().orOperator(
          Criteria.where("orderNumber").regex(pattern, "i"),
          Criteria.where("receiver.name").regex(pattern, "i"),
          Criteria.where("receiver.phone").regex(pattern, "i")));
    }
    if (parts.isEmpty()) return null;
    if (parts.size() == 1) return parts.get(0);
    return new Criteria().andOperator(parts.toArray(new Criteria[0]));
  }

  /** from: ISO instant hoặc yyyy-MM-dd (đầu ngày giờ VN). */
  private Instant parseFrom(String v) {
    if (v == null || v.isBlank()) return null;
    String s = v.trim();
    try {
      return Instant.parse(s);
    } catch (Exception ignored) {
      try {
        return LocalDate.parse(s).atStartOfDay(VN).toInstant();
      } catch (Exception ignored2) {
        return null;
      }
    }
  }

  /** to: ISO instant hoặc yyyy-MM-dd (đầu ngày HÔM SAU giờ VN — lọc lt). */
  private Instant parseTo(String v) {
    if (v == null || v.isBlank()) return null;
    String s = v.trim();
    try {
      return Instant.parse(s);
    } catch (Exception ignored) {
      try {
        return LocalDate.parse(s).plusDays(1).atStartOfDay(VN).toInstant();
      } catch (Exception ignored2) {
        return null;
      }
    }
  }

  private Sort parseSort(String sort) {
    String field = "createdAt";
    Sort.Direction dir = Sort.Direction.DESC;
    if (sort != null && !sort.isBlank()) {
      String[] parts = sort.split(",");
      if (parts.length > 0 && ("createdAt".equals(parts[0].trim()) || "total".equals(parts[0].trim()))) {
        field = parts[0].trim();
      }
      if (parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())) {
        dir = Sort.Direction.ASC;
      }
    }
    return Sort.by(dir, field);
  }

  /**
   * Chuẩn hoá tham số status: slug không dấu (§2.5), enum thô, hoặc null.
   * "cho-xu-ly" = MỚI + ĐÃ XÁC NHẬN (card Đơn chờ xử lý ở Dashboard).
   */
  private List<String> normalizeStatusFilter(String raw) {
    if (raw == null || raw.isBlank()) return null;
    String s = raw.trim();
    if (s.equalsIgnoreCase("tat-ca") || s.equalsIgnoreCase("all")) return null;
    if (s.equalsIgnoreCase("cho-xu-ly") || s.equalsIgnoreCase("CHO_XU_LY")) {
      return List.of(MOI, DA_XAC_NHAN);
    }
    String single = normalizeStatus(s);
    return single != null ? List.of(single) : null;
  }

  /** 1 trạng thái: nhận cả slug (moi, da-xac-nhan…) lẫn enum (MỚI, ĐÃ XÁC NHẬN…). */
  private String normalizeStatus(String raw) {
    if (raw == null) return null;
    String s = raw.trim();
    for (String st : ALL_STATUSES) {
      if (st.equalsIgnoreCase(s)) return st;
    }
    return switch (s.toLowerCase()) {
      case "moi" -> MOI;
      case "da-xac-nhan" -> DA_XAC_NHAN;
      case "dang-giao" -> DANG_GIAO;
      case "hoan-thanh" -> HOAN_THANH;
      case "da-huy" -> DA_HUY;
      case "hoan-tra" -> HOAN_TRA;
      default -> null;
    };
  }

  private AdminOrderListItemDto toListItem(Order o) {
    AdminOrderListItemDto d = new AdminOrderListItemDto();
    d.setOrderNumber(o.getOrderNumber());
    d.setCustomerName(o.getReceiver() != null ? o.getReceiver().getName() : null);
    d.setCustomerPhone(o.getReceiver() != null ? o.getReceiver().getPhone() : null);
    List<Order.OrderItem> items = o.getItems() != null ? o.getItems() : List.of();
    d.setItemKinds(items.size());
    d.setItemCount(items.stream().mapToInt(Order.OrderItem::getQty).sum());
    d.setTotal(o.getTotal());
    d.setPaymentMethod(o.getPaymentMethod());
    Payment p = latestPayment(o.getId());
    d.setPaymentStatus(p != null && p.getStatus() != null ? p.getStatus() : "CHƯA THANH TOÁN");
    d.setStatus(o.getStatus());
    d.setCreatedAt(o.getCreatedAt());
    return d;
  }

  /* ------------------------------ Chi tiết ------------------------------ */

  public AdminOrderDetailDto get(String orderNumber) {
    return toDetail(findOrder(orderNumber));
  }

  private AdminOrderDetailDto toDetail(Order o) {
    AdminOrderDetailDto d = new AdminOrderDetailDto();
    d.setOrderNumber(o.getOrderNumber());
    d.setCreatedAt(o.getCreatedAt());
    d.setStatus(o.getStatus());
    d.setStatusHistory(o.getStatusHistory() != null ? o.getStatusHistory() : List.of());
    d.setReceiver(o.getReceiver());
    d.setNote(o.getNote());
    d.setAdminNote(o.getAdminNote());
    d.setTrackingCode(o.getTrackingCode());
    List<Order.OrderItem> items = o.getItems() != null ? o.getItems() : List.of();
    BigDecimal totalArea = BigDecimal.ZERO;
    List<AdminOrderDetailDto.ItemDto> itemDtos = new ArrayList<>();
    for (Order.OrderItem oi : items) {
      AdminOrderDetailDto.ItemDto it = new AdminOrderDetailDto.ItemDto();
      it.setImage(oi.getImage());
      it.setProductName(oi.getProductName());
      it.setColor(oi.getColor());
      it.setColorHex(oi.getColorHex());
      it.setSku(oi.getSku());
      it.setPrice(oi.getPrice());
      it.setQty(oi.getQty());
      // Snapshot OrderItem.areaM2 lưu TỔNG theo dòng (đơn vị × qty — xem
      // OrderService.createOrder) → chia lại ra diện tích 1 đơn vị cho contract §7.
      BigDecimal lineArea = oi.getAreaM2() != null ? oi.getAreaM2() : BigDecimal.ZERO;
      it.setAreaM2(oi.getQty() > 0
          ? lineArea.divide(BigDecimal.valueOf(oi.getQty()), 2, RoundingMode.HALF_UP)
          : lineArea);
      it.setFlashSaleProgramId(oi.getFlashSaleProgramId());
      itemDtos.add(it);
      totalArea = totalArea.add(lineArea);
    }
    d.setItems(itemDtos);
    d.setSubtotal(o.getSubtotal());
    d.setDiscount(o.getDiscount());
    d.setVoucherCode(o.getVoucherCode());
    d.setShippingFee(o.getShippingFee());
    d.setTotalAreaM2(totalArea);
    d.setTotal(o.getTotal());
    d.setPaymentMethod(o.getPaymentMethod());
    Payment p = latestPayment(o.getId());
    AdminOrderDetailDto.PaymentDto pd = new AdminOrderDetailDto.PaymentDto();
    pd.setMethod(o.getPaymentMethod());
    pd.setAmount(p != null && p.getAmount() != null ? p.getAmount() : o.getTotal());
    pd.setStatus(p != null && p.getStatus() != null ? p.getStatus() : "CHƯA THANH TOÁN");
    pd.setProviderRef(p != null ? p.getProviderRef() : null);
    pd.setPaidAt(p != null ? p.getPaidAt() : null);
    d.setPayment(pd);
    return d;
  }

  /* --------------------------- Cập nhật trạng thái --------------------------- */

  public AdminOrderDetailDto updateStatus(String orderNumber, AdminOrderStatusRequest req) {
    Order order = findOrder(orderNumber);
    String current = order.getStatus();
    String target = req != null ? normalizeStatus(req.getStatus()) : null;
    if (target == null) {
      throw invalidTransition(order, "Trạng thái đích không hợp lệ.");
    }
    Set<String> allowed = TRANSITIONS.getOrDefault(current, Set.of());
    if (!allowed.contains(target)) {
      throw invalidTransition(order,
          "Không thể chuyển đơn sang " + label(target)
              + " — đơn hiện đang ở trạng thái " + label(current) + ".");
    }
    String note = req.getNote() != null && !req.getNote().isBlank() ? req.getNote().trim() : null;

    if (DANG_GIAO.equals(target)
        && (req.getTrackingCode() == null || req.getTrackingCode().isBlank())) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "TRACKING_CODE_REQUIRED",
          "Vui lòng nhập mã vận đơn.");
    }
    if (DA_HUY.equals(target) && note == null) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "REASON_REQUIRED",
          "Vui lòng nhập lý do hủy.");
    }
    if (HOAN_TRA.equals(target)) {
      if (note == null) {
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "REASON_REQUIRED",
            "Vui lòng nhập lý do hoàn trả.");
      }
      if (HOAN_THANH.equals(current)) {
        Instant completedAt = completedAt(order);
        if (completedAt != null
            && Instant.now().isAfter(completedAt.plus(Duration.ofDays(7)))) {
          throw invalidTransition(order,
              "Đã quá 7 ngày kể từ khi đơn hoàn thành — không thể hoàn trả.");
        }
      }
    }

    if (DA_HUY.equals(target)) {
      // Đường hủy chung: hoàn kho + hoàn voucher + hoàn suất flash (F-009).
      if (!orderService.cancelOrderByAdmin(order, note)) {
        throw stale(orderNumber);
      }
      markPaymentRefunded(order.getId());
    } else if (HOAN_TRA.equals(target)) {
      // Hoàn trả KHÔNG tự hoàn kho (§4.6) — chỉ đổi trạng thái + hoàn tiền nếu đã thu.
      if (!atomicTransition(order, target, note, null)) {
        throw stale(orderNumber);
      }
      markPaymentRefunded(order.getId());
    } else if (DANG_GIAO.equals(target)) {
      String historyNote = note != null ? note : "Đang giao đến bạn";
      if (!atomicTransition(order, target, historyNote, req.getTrackingCode().trim())) {
        throw stale(orderNumber);
      }
    } else if (HOAN_THANH.equals(target)) {
      if (!atomicTransition(order, target, note != null ? note : "Đã giao thành công", null)) {
        throw stale(orderNumber);
      }
      // COD thu tiền khi giao xong (F-008): hoàn thành → Payment ĐÃ THANH TOÁN.
      if ("COD".equals(order.getPaymentMethod())) {
        markCodCollected(order);
      }
    } else { // ĐÃ XÁC NHẬN
      if (!atomicTransition(order, target, note != null ? note : "Shop đã xác nhận đơn", null)) {
        throw stale(orderNumber);
      }
    }
    return get(orderNumber);
  }

  /** Chuyển trạng thái nguyên tử (điều kiện: status hiện tại còn đúng) + append history. */
  private boolean atomicTransition(Order order, String target, String note, String trackingCode) {
    Query q = Query.query(Criteria.where("_id").is(order.getId()).and("status").is(order.getStatus()));
    Update u = new Update()
        .set("status", target)
        .push("statusHistory", new Document("status", target)
            .append("at", Instant.now())
            .append("note", note)
            .append("bySystem", false));
    if (trackingCode != null) {
      u.set("trackingCode", trackingCode);
    }
    return mongoTemplate.updateFirst(q, u, Order.class).getModifiedCount() > 0;
  }

  /** Đơn đã bị đổi trạng thái trong lúc admin đang xem → 422 kèm trạng thái mới nhất. */
  private ApiException stale(String orderNumber) {
    Order fresh = findOrder(orderNumber);
    return invalidTransition(fresh,
        "Trạng thái đơn hàng đã thay đổi — đơn hiện đang ở trạng thái "
            + label(fresh.getStatus()) + ".");
  }

  private ApiException invalidTransition(Order order, String message) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_TRANSITION",
        message, null, Map.of("currentStatus", order.getStatus() != null ? order.getStatus() : ""));
  }

  private Instant completedAt(Order order) {
    if (order.getStatusHistory() == null) return order.getCreatedAt();
    Instant at = null;
    for (Order.StatusHistory h : order.getStatusHistory()) {
      if (HOAN_THANH.equals(h.getStatus())) at = h.getAt();
    }
    return at != null ? at : order.getCreatedAt();
  }

  private String label(String status) {
    return LABELS.getOrDefault(status, status != null ? status : "");
  }

  /* ------------------------------ Thanh toán ------------------------------ */

  /** Xác nhận đã nhận chuyển khoản (F-008 — admin xác nhận thủ công, §3.6). */
  public AdminOrderDetailDto confirmBankTransfer(String orderNumber) {
    Order order = findOrder(orderNumber);
    if (!"BANK_TRANSFER".equals(order.getPaymentMethod())) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "NOT_BANK_TRANSFER",
          "Chỉ áp dụng cho đơn chuyển khoản ngân hàng.");
    }
    Payment p = latestPayment(order.getId());
    if (p != null && "ĐÃ THANH TOÁN".equals(p.getStatus())) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "ALREADY_PAID",
          "Đơn đã được thanh toán rồi.");
    }
    if (p == null) {
      p = new Payment();
      p.setOrderId(order.getId());
      p.setUserId(order.getUserId());
      p.setMethod("BANK_TRANSFER");
      p.setAmount(order.getTotal());
      p.setCreatedAt(Instant.now());
    }
    p.setStatus("ĐÃ THANH TOÁN");
    p.setPaidAt(Instant.now());
    paymentRepository.save(p);
    return get(orderNumber);
  }

  /** Payment đã thu → HOÀN TIỀN khi hủy/hoàn trả đơn đã thanh toán (§4.3/§4.6). */
  private void markPaymentRefunded(String orderId) {
    Payment p = latestPayment(orderId);
    if (p != null && "ĐÃ THANH TOÁN".equals(p.getStatus())) {
      p.setStatus("HOÀN TIỀN");
      paymentRepository.save(p);
    }
  }

  /** COD: giao xong = đã thu tiền mặt (F-008). Chưa có Payment thì tạo mới. */
  private void markCodCollected(Order order) {
    Payment p = latestPayment(order.getId());
    if (p == null) {
      p = new Payment();
      p.setOrderId(order.getId());
      p.setUserId(order.getUserId());
      p.setMethod("COD");
      p.setAmount(order.getTotal());
      p.setCreatedAt(Instant.now());
    }
    if (!"ĐÃ THANH TOÁN".equals(p.getStatus())) {
      p.setStatus("ĐÃ THANH TOÁN");
      p.setPaidAt(Instant.now());
      paymentRepository.save(p);
    }
  }

  /* ------------------------------ Ghi chú nội bộ ------------------------------ */

  public AdminOrderDetailDto updateAdminNote(String orderNumber, AdminOrderNoteRequest req) {
    Order order = findOrder(orderNumber);
    String note = req != null ? req.getAdminNote() : null;
    order.setAdminNote(note != null && !note.isBlank() ? note.trim() : null);
    orderRepository.save(order);
    return toDetail(order);
  }

  /* ------------------------------ Helpers ------------------------------ */

  private Order findOrder(String orderNumber) {
    return orderRepository.findByOrderNumber(orderNumber)
        .or(() -> orderRepository.findById(orderNumber))
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND",
            "Không tìm thấy đơn hàng " + orderNumber + "."));
  }

  private Payment latestPayment(String orderId) {
    List<Payment> list = paymentRepository.findByOrderIdOrderByCreatedAtDesc(orderId);
    return list.isEmpty() ? null : list.get(0);
  }
}
