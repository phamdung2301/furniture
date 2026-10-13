package com.mocan.shop.service;

import com.mocan.shop.dto.MomoCreateResponse;
import com.mocan.shop.dto.PaymentStatusResponse;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Order;
import com.mocan.shop.model.Payment;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.PaymentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
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
import java.util.Map;
import java.util.UUID;

/**
 * Thanh toán MoMo — F-008.
 * - create: validate đơn thuộc user + MỚI + MOMO + chưa thanh toán; giữ đơn 30 phút.
 * - IPN: verify chữ ký TRƯỚC mọi cập nhật; idempotent theo providerRef (MoMo transId);
 *   không trừ kho lần 2 (kho đã trừ lúc tạo đơn); IPN đến sau khi đơn tự hủy → chỉ log.
 * - queryStatus: backend query TRỰC TIẾP MoMo (nút "Tôi đã thanh toán xong"), áp dụng
 *   kết quả như IPN thành công.
 *
 * Bảo mật: không log rawResponse/signature/secret; amount đối chiếu với total đơn.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

  private static final long HOLD_MINUTES = 30;

  private final OrderRepository orderRepository;
  private final PaymentRepository paymentRepository;
  private final MomoService momoService;
  private final MongoTemplate mongoTemplate;
  private final ObjectMapper objectMapper = new ObjectMapper();

  /**
   * POST /payments/momo/create. Idempotent mềm: nếu đã có payment CHƯA THANH TOÁN còn
   * hạn → trả lại payment cũ (không spam MoMo); hết hạn/THẤT BẠI → tạo payment mới.
   */
  public MomoCreateResponse createMomoPayment(String userId, String orderNumber) {
    Order order = loadOwnedOrder(userId, orderNumber);
    if (!"MỚI".equals(order.getStatus())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "ORDER_NOT_PAYABLE",
          "Đơn hàng không còn ở trạng thái chờ thanh toán.");
    }
    if (!"MOMO".equals(order.getPaymentMethod())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "WRONG_PAYMENT_METHOD",
          "Đơn này không dùng Ví MoMo.");
    }

    List<Payment> existing = paymentRepository.findByOrderIdOrderByCreatedAtDesc(order.getId());
    for (Payment p : existing) {
      if ("ĐÃ THANH TOÁN".equals(p.getStatus())) {
        throw new ApiException(HttpStatus.CONFLICT, "ALREADY_PAID", "Đơn đã được thanh toán.");
      }
    }
    Payment reusable = existing.stream()
        .filter(p -> "CHƯA THANH TOÁN".equals(p.getStatus()))
        .filter(p -> p.getExpiresAt() != null && p.getExpiresAt().isAfter(Instant.now()))
        .filter(p -> p.getQrCodeUrl() != null && !p.getQrCodeUrl().isBlank())
        .findFirst().orElse(null);
    if (reusable != null) {
      return toCreateResponse(reusable);
    }

    String momoOrderId = "NT" + order.getOrderNumber().replace("-", "")
        + "-" + System.currentTimeMillis();
    String requestId = UUID.randomUUID().toString();
    String amountVnd = vnd(order.getTotal());
    String orderInfo = "Thanh toan don hang " + order.getOrderNumber() + " - Moc An";
    String extraData = MomoService.encodeExtraData("{\"orderNumber\":\"" + order.getOrderNumber() + "\"}");

    MomoService.CreateResult created =
        momoService.createPayment(amountVnd, momoOrderId, requestId, orderInfo, extraData);

    Payment payment = new Payment();
    payment.setOrderId(order.getId());
    payment.setUserId(userId);
    payment.setMethod("MOMO");
    payment.setAmount(order.getTotal());
    payment.setStatus("CHƯA THANH TOÁN");
    payment.setMomoOrderId(created.momoOrderId());
    payment.setRequestId(created.requestId());
    payment.setQrCodeUrl(created.qrCodeUrl());
    payment.setDeeplink(created.deeplink());
    payment.setExpiresAt(Instant.now().plusSeconds(HOLD_MINUTES * 60));
    payment.setCreatedAt(Instant.now());
    // rawResponse chỉ lưu DB phục vụ đối soát — KHÔNG log
    try {
      payment.setRawResponse(objectMapper.writeValueAsString(Map.of(
          "stage", "create", "momoOrderId", created.momoOrderId(),
          "requestId", created.requestId(), "amount", created.amount(),
          "at", Instant.now().toString())));
    } catch (Exception e) {
      payment.setRawResponse("{\"stage\":\"create\"}");
    }
    paymentRepository.save(payment);
    return toCreateResponse(payment);
  }

  /**
   * POST /payments/momo/ipn (PUBLIC — MoMo server gọi). Verify chữ ký trước,
   * idempotent theo providerRef = MoMo transId.
   */
  public void handleIpn(Map<String, Object> body) {
    Map<String, String> fields = new java.util.LinkedHashMap<>();
    String signature = null;
    for (Map.Entry<String, Object> e : body.entrySet()) {
      if ("signature".equals(e.getKey())) {
        signature = e.getValue() != null ? String.valueOf(e.getValue()) : null;
      } else {
        fields.put(e.getKey(), e.getValue() != null ? String.valueOf(e.getValue()) : "");
      }
    }
    // 1. Verify chữ ký TRƯỚC mọi cập nhật — sai chữ ký = từ chối ngay.
    if (!momoService.verifyIpnSignature(fields, signature)) {
      log.warn("IPN MoMo sai chữ ký: orderId={}", fields.get("orderId"));
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SIGNATURE",
          "Chữ ký IPN không hợp lệ.");
    }

    String momoOrderId = fields.get("orderId");
    String transId = fields.get("transId");
    int resultCode = toInt(fields.get("resultCode"));
    String amountStr = fields.get("amount");

    Payment payment = paymentRepository.findByMomoOrderId(momoOrderId).orElse(null);
    if (payment == null) {
      // Không khớp đơn nào ta tạo — trả 200 để MoMo không retry vô hạn, chỉ ghi log.
      log.warn("IPN MoMo cho momoOrderId lạ: {} resultCode={}", momoOrderId, resultCode);
      return;
    }
    // 2. Idempotent theo providerRef (MoMo transId): đã xử lý rồi → bỏ qua.
    if (transId != null && !transId.isBlank() && transId.equals(payment.getProviderRef())) {
      log.info("IPN MoMo trùng lặp (transId đã xử lý): momoOrderId={}", momoOrderId);
      return;
    }
    // 3. Đối chiếu amount với total đơn — chống IPN giả số tiền.
    if (amountStr != null && !amountStr.isBlank()
        && !amountStr.equals(vnd(payment.getAmount()))) {
      log.warn("IPN MoMo lệch số tiền: momoOrderId={} ipnAmount={}", momoOrderId, amountStr);
      throw new ApiException(HttpStatus.BAD_REQUEST, "AMOUNT_MISMATCH",
          "Số tiền IPN không khớp đơn hàng.");
    }

    String raw = safeJson(body);
    if (resultCode == 0) {
      markPaid(payment, transId, raw);
    } else {
      markFailed(payment, transId, fields.get("message"), raw);
    }
  }

  /**
   * GET /payments/status/{orderNumber}. Nếu payment còn CHƯA THANH TOÁN và còn hạn →
   * query TRỰC TIẾP MoMo rồi áp dụng kết quả như IPN.
   */
  public PaymentStatusResponse queryStatus(String userId, String orderNumber) {
    Order order = loadOwnedOrder(userId, orderNumber);
    Payment payment = latestPayment(order.getId());
    PaymentStatusResponse res = new PaymentStatusResponse();
    if (payment == null) {
      res.setStatus("CHƯA THANH TOÁN");
      return res;
    }
    if ("ĐÃ THANH TOÁN".equals(payment.getStatus())) {
      res.setStatus("ĐÃ THANH TOÁN");
      res.setPaidAt(payment.getPaidAt());
      return res;
    }
    if ("THẤT BẠI".equals(payment.getStatus())
        || payment.getExpiresAt() == null
        || payment.getExpiresAt().isBefore(Instant.now())) {
      res.setStatus(payment.getStatus());
      return res;
    }
    // Còn hạn → hỏi trực tiếp MoMo.
    MomoService.QueryResult qr =
        momoService.queryTransaction(payment.getMomoOrderId(), payment.getRequestId());
    if (qr.paid()) {
      markPaid(payment, qr.transId(), safeJson(Map.of("stage", "query", "transId", qr.transId())));
      Payment fresh = paymentRepository.findById(payment.getId()).orElse(payment);
      res.setStatus(fresh.getStatus());
      res.setPaidAt(fresh.getPaidAt());
    } else {
      if (qr.failed()) {
        markFailed(payment, qr.transId(), qr.message(), null);
        res.setStatus("THẤT BẠI");
        res.setMessage(qr.message());
      } else {
        res.setStatus("CHƯA THANH TOÁN");
        res.setMessage("Chưa ghi nhận thanh toán. Bạn hãy hoàn tất trên app MoMo rồi thử lại.");
      }
    }
    return res;
  }

  /** Payment mới nhất của đơn — cho khối payment trong GET /orders/{id}. */
  public Payment latestPayment(String orderId) {
    List<Payment> list = paymentRepository.findByOrderIdOrderByCreatedAtDesc(orderId);
    return list.isEmpty() ? null : list.get(0);
  }

  // ---------- state transitions (atomic, idempotent) ----------

  /**
   * Đánh dấu đã thanh toán: payment (nguyên tử, chỉ khi còn CHƯA THANH TOÁN) + order
   * MỚI → ĐÃ XÁC NHẬN (nguyên tử). KHÔNG trừ kho lần 2 — kho đã trừ lúc tạo đơn.
   * IPN đến sau khi đơn đã tự hủy (ĐÃ HỦY): chỉ ghi log, không hồi sinh đơn.
   */
  private void markPaid(Payment payment, String transId, String raw) {
    Query pq = Query.query(Criteria.where("_id").is(payment.getId())
        .and("status").is("CHƯA THANH TOÁN"));
    Update pu = new Update()
        .set("status", "ĐÃ THANH TOÁN")
        .set("providerRef", transId)
        .set("paidAt", Instant.now());
    if (raw != null) pu.set("rawResponse", raw);
    Payment updated = mongoTemplate.findAndModify(pq, pu,
        FindAndModifyOptions.options().returnNew(true),
        Payment.class);
    if (updated == null) {
      log.info("markPaid bỏ qua — payment đã xử lý trước đó: {}", payment.getMomoOrderId());
      return;
    }
    // Order: chỉ chuyển khi còn MỚI — thắng race với scheduler hủy đơn.
    Query oq = Query.query(Criteria.where("_id").is(payment.getOrderId())
        .and("status").is("MỚI"));
    Update ou = new Update()
        .set("status", "ĐÃ XÁC NHẬN")
        .push("statusHistory", new Document("status", "ĐÃ XÁC NHẬN")
            .append("at", Instant.now())
            .append("note", "MoMo IPN: thanh toán thành công"));
    com.mongodb.client.result.UpdateResult or =
        mongoTemplate.updateFirst(oq, ou, Order.class);
    if (or.getModifiedCount() == 0) {
      // Đơn đã đổi trạng thái (tự hủy do hết hạn hoặc đã xác nhận) — chỉ log, không hồi sinh.
      log.warn("IPN thành công nhưng đơn không còn MỚI (momoOrderId={}) — không hồi sinh đơn.",
          payment.getMomoOrderId());
    }
  }

  private void markFailed(Payment payment, String transId, String message, String raw) {
    Query q = Query.query(Criteria.where("_id").is(payment.getId())
        .and("status").is("CHƯA THANH TOÁN"));
    Update u = new Update().set("status", "THẤT BẠI");
    if (transId != null && !transId.isBlank()) u.set("providerRef", transId);
    if (raw != null) u.set("rawResponse", raw);
    mongoTemplate.findAndModify(q, u,
        FindAndModifyOptions.options().returnNew(true),
        Payment.class);
    log.info("Payment THẤT BẠI: momoOrderId={} reason={}", payment.getMomoOrderId(),
        message != null ? message : "unknown");
    // Đơn giữ MỚI — user được "Tạo lại thanh toán" trong 30 phút (US-012).
  }

  // ---------- helpers ----------

  /** Đơn thuộc đúng user — nhận id hoặc orderNumber; sai chủ → 403 (không lộ đơn người khác). */
  private Order loadOwnedOrder(String userId, String orderNumber) {
    if (orderNumber == null || orderNumber.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ORDER_NUMBER",
          "Thiếu mã đơn hàng.");
    }
    Order order = orderRepository.findById(orderNumber.trim())
        .or(() -> orderRepository.findByOrderNumber(orderNumber.trim()))
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND",
            "Không tìm thấy đơn hàng."));
    if (!userId.equals(order.getUserId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN",
          "Bạn không có quyền xem đơn hàng này.");
    }
    return order;
  }

  private MomoCreateResponse toCreateResponse(Payment p) {
    MomoCreateResponse res = new MomoCreateResponse();
    res.setQrCodeUrl(p.getQrCodeUrl());
    res.setDeeplink(p.getDeeplink());
    res.setMomoOrderId(p.getMomoOrderId());
    res.setAmount(p.getAmount());
    res.setExpiresAt(p.getExpiresAt());
    return res;
  }

  private String vnd(BigDecimal total) {
    BigDecimal t = total != null ? total : BigDecimal.ZERO;
    return t.setScale(0, RoundingMode.HALF_UP).toPlainString();
  }

  private int toInt(String s) {
    try {
      return Integer.parseInt(s);
    } catch (Exception e) {
      return -1;
    }
  }

  private String safeJson(Object o) {
    try {
      return objectMapper.writeValueAsString(o);
    } catch (Exception e) {
      return "{}";
    }
  }
}
