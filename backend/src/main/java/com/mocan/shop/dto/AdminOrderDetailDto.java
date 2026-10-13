package com.mocan.shop.dto;

import com.mocan.shop.model.Order;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Chi tiết đơn cho slide-over admin — GET /admin/orders/{orderNumber}
 * (admin-don-hang.md §3/§7). Mọi số tiền là SNAPSHOT lúc đặt, không tính lại.
 * `items[].areaM2` là diện tích 1 ĐƠN VỊ (snapshot OrderItem lưu tổng theo
 * dòng = đơn vị × qty nên service chia lại); `totalAreaM2` = Σ areaM2 × qty.
 * Khác OrderDto phía khách: DTO này có `adminNote` + `sku` (chỉ admin thấy).
 */
@Data
public class AdminOrderDetailDto {
  private String orderNumber;
  private Instant createdAt;
  private String status;
  private List<Order.StatusHistory> statusHistory;
  private Order.Receiver receiver;
  private String note; // ghi chú của khách lúc checkout
  private String adminNote; // ghi chú nội bộ — chỉ admin
  private String trackingCode;
  private List<ItemDto> items;
  private BigDecimal subtotal;
  private BigDecimal discount;
  private String voucherCode;
  private BigDecimal shippingFee;
  private BigDecimal totalAreaM2;
  private BigDecimal total;
  private String paymentMethod; // COD | BANK_TRANSFER | MOMO
  private PaymentDto payment;

  @Data
  public static class ItemDto {
    private String image;
    private String productName;
    private String color;
    private String colorHex;
    private String sku;
    private BigDecimal price;
    private int qty;
    private BigDecimal areaM2; // diện tích 1 đơn vị (m²)
    private String flashSaleProgramId; // null = dòng thường
  }

  @Data
  public static class PaymentDto {
    private String method;
    private BigDecimal amount;
    private String status; // CHƯA THANH TOÁN | ĐÃ THANH TOÁN | THẤT BẠI | HOÀN TIỀN
    private String providerRef; // MoMo transId / mã đối soát chuyển khoản
    private Instant paidAt;
  }
}
