package com.mocan.shop.dto;

import com.mocan.shop.model.Order;
import com.mocan.shop.model.Payment;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Chi tiết đơn hàng trả về — GET /orders/{id}. */
@Data
public class OrderDto {
  private String id;
  private String orderNumber;
  private List<ItemDto> items;
  private BigDecimal subtotal;
  private BigDecimal discount;
  private BigDecimal shippingFee;
  private BigDecimal total;
  private String voucherCode;
  private Order.Receiver receiver;
  private String status;
  private List<Order.StatusHistory> statusHistory;
  private String paymentMethod;
  private String note;
  private String trackingCode; // mã vận đơn khi ĐANG GIAO — khách xem ở timeline (màn 11/17)
  private Instant createdAt;
  private PaymentInfo payment; // khối thanh toán cho FE poll (thanh-toan.md §3)

  /** Dòng món trong đơn (snapshot) + cờ đã đánh giá cho màn Theo dõi đơn §6. */
  @Data
  public static class ItemDto {
    private String variantId;
    private String productId;
    private String productSlug;
    private String productName;
    private String color;
    private String colorHex;
    private String image;
    private BigDecimal price;
    private int qty;
    private BigDecimal areaM2;
    private boolean reviewed; // user đã đánh giá sản phẩm này chưa (FR-017)
  }

  @Data
  public static class PaymentInfo {
    private String method; // COD | BANK_TRANSFER | MOMO
    private String status; // CHƯA THANH TOÁN | ĐÃ THANH TOÁN | THẤT BẠI
    private Instant paidAt; // có khi đã thanh toán
    private Instant expiresAt; // MoMo: hạn giữ đơn 30' — FE đếm ngược ở trang chi tiết
  }

  public static OrderDto from(Order o) {
    return from(o, null);
  }

  public static OrderDto from(Order o, Payment p) {
    return from(o, p, Map.of(), Set.of());
  }

  /**
   * @param productIdByVariantId variantId -> productId (để gắn productId + reviewed)
   * @param reviewedProductIds   tập productId user đã đánh giá
   */
  public static OrderDto from(Order o, Payment p, Map<String, String> productIdByVariantId,
      Set<String> reviewedProductIds) {
    OrderDto d = new OrderDto();
    d.setId(o.getId());
    d.setOrderNumber(o.getOrderNumber());
    d.setItems(o.getItems() == null ? List.of() : o.getItems().stream().map(oi -> {
      ItemDto it = new ItemDto();
      it.setVariantId(oi.getVariantId());
      String productId = oi.getVariantId() != null
          ? productIdByVariantId.get(oi.getVariantId()) : null;
      it.setProductId(productId);
      it.setProductSlug(oi.getProductSlug());
      it.setProductName(oi.getProductName());
      it.setColor(oi.getColor());
      it.setColorHex(oi.getColorHex());
      it.setImage(oi.getImage());
      it.setPrice(oi.getPrice());
      it.setQty(oi.getQty());
      it.setAreaM2(oi.getAreaM2());
      it.setReviewed(productId != null && reviewedProductIds.contains(productId));
      return it;
    }).toList());
    d.setSubtotal(o.getSubtotal());
    d.setDiscount(o.getDiscount());
    d.setShippingFee(o.getShippingFee());
    d.setTotal(o.getTotal());
    d.setVoucherCode(o.getVoucherCode());
    d.setReceiver(o.getReceiver());
    d.setStatus(o.getStatus());
    d.setStatusHistory(o.getStatusHistory());
    d.setPaymentMethod(o.getPaymentMethod());
    d.setNote(o.getNote());
    d.setTrackingCode(o.getTrackingCode());
    d.setCreatedAt(o.getCreatedAt());
    PaymentInfo pi = new PaymentInfo();
    pi.setMethod(o.getPaymentMethod());
    pi.setStatus(p != null && p.getStatus() != null ? p.getStatus() : "CHƯA THANH TOÁN");
    pi.setPaidAt(p != null ? p.getPaidAt() : null);
    pi.setExpiresAt(p != null ? p.getExpiresAt() : null);
    d.setPayment(pi);
    return d;
  }
}
