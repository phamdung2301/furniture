package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Đơn hàng — 02-ERD.md. Items là snapshot tại lúc đặt; userId bắt buộc (không guest checkout). */
@Data
@Document("orders")
public class Order {
  @Id private String id;
  @Indexed(unique = true) private String orderNumber; // vd: NT-20261010-0001
  private String userId;
  private List<OrderItem> items;
  private BigDecimal subtotal;
  private BigDecimal discount;
  private BigDecimal shippingFee; // tính theo tổng diện tích (FR-029)
  private BigDecimal total;
  private String voucherCode;
  private Receiver receiver;
  private String status; // MỚI|ĐÃ XÁC NHẬN|ĐANG GIAO|HOÀN THÀNH|ĐÃ HỦY|HOÀN TRẢ
  private List<StatusHistory> statusHistory;
  private String paymentMethod; // COD | BANK_TRANSFER | MOMO
  private String note;
  // Bổ sung 2026-10-12 (màn 17 — admin-don-hang.md §3.8/§4.4, lệch ERD đã ghi
  // vào 02-ERD.md): ghi chú NỘI BỘ của admin — tuyệt đối không lộ phía khách
  // (khác `note` là ghi chú của khách lúc checkout); mã vận đơn khi ĐANG GIAO.
  private String adminNote;
  private String trackingCode;
  private Instant createdAt;

  @Data
  public static class OrderItem {
    private String variantId;
    private String sku;
    // productSlug: deep-link "Đánh giá" từ trang theo dõi đơn (theo-doi-don.md §6
    // [Giả định] — cần doc-writer bổ sung vào 02-ERD). image/colorHex: snapshot
    // hiển thị, cùng triết lý snapshot với productName/price.
    private String productSlug;
    private String productName;
    private String color;
    private String colorHex;
    private String image;
    private BigDecimal price;
    private int qty;
    private BigDecimal areaM2;
    // Snapshot chương trình flash sale đã áp cho dòng này (null = giá thường) —
    // dùng để đếm giới hạn 2 suất/khách/chương trình + hoàn suất khi hủy đơn (F-022).
    private String flashSaleProgramId;
  }

  @Data
  public static class Receiver {
    private String name;
    private String phone;
    private String province;
    private String district;
    private String ward;
    private String detail;
  }

  @Data
  public static class StatusHistory {
    private String status;
    private Instant at;
    private String note;
    // true = mốc do hệ thống tạo (tự hủy quá hạn MoMo, IPN…) — admin hiển thị
    // nhãn "Hệ thống" để phân biệt thao tác người/hệ thống (admin-don-hang.md §3.7).
    private boolean bySystem;
  }
}
