package com.mocan.shop.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Thanh toán — 02-ERD.md. MoMo tích hợp thật, webhook idempotent theo providerRef.
 * rawResponse: lưu nguyên JSON trả về từ MoMo (đối soát) — TUYỆT ĐỐI không log ra ngoài.
 */
@Data
@Document("payments")
public class Payment {
  @Id private String id;
  private String orderId;
  @Indexed private String userId; // guard: payment thuộc đúng user tạo đơn
  private String method; // COD | BANK_TRANSFER | MOMO
  private BigDecimal amount;
  private String status; // CHƯA THANH TOÁN | ĐÃ THANH TOÁN | THẤT BẠI | HOÀN TIỀN
  private String providerRef; // MoMo transId / nội dung CK — khóa idempotent cho IPN
  @Indexed(unique = true) private String momoOrderId; // orderId gửi sang MoMo (đối chiếu IPN)
  private String requestId; // requestId gửi sang MoMo — cần cho API query trạng thái
  private String qrCodeUrl; // QR do MoMo sinh — FE render trực tiếp
  private String deeplink; // mở app MoMo đúng giao dịch
  private Instant expiresAt; // hết 30 phút giữ đơn → scheduler tự hủy
  private Instant paidAt;
  private String rawResponse; // JSON thô từ MoMo — chỉ lưu DB, KHÔNG log
  private Instant createdAt;
}
