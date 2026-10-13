package com.mocan.shop.service;

import com.mocan.shop.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tích hợp MoMo — F-008. Mọi secret (partnerCode/accessKey/secretKey) CHỈ đọc từ ENV
 * qua application.yml, TUYỆT ĐỐI không hardcode, không log, không đưa vào exception message.
 *
 * Luồng: createPayment (captureWallet) → user quét QR / mở deeplink → MoMo gọi IPN
 * → verifyIpnSignature → cập nhật; queryTransaction cho nút "Tôi đã thanh toán xong".
 *
 * Raw-string chữ ký theo đúng template của MoMo (mỗi endpoint một công thức riêng —
 * sai một field là "signature mismatch"):
 * - create : accessKey=&amount=&extraData=&ipnUrl=&orderId=&orderInfo=&partnerCode=&redirectUrl=&requestId=&requestType=
 * - ipn    : accessKey=&amount=&extraData=&message=&orderId=&orderInfo=&orderType=&partnerCode=&payType=&requestId=&responseTime=&resultCode=&transId=
 * - query  : accessKey=&orderId=&partnerCode=&requestId=
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MomoService {

  public static final String REQUEST_TYPE_CAPTURE_WALLET = "captureWallet";

  private final RestTemplate restTemplate = new RestTemplate();

  @Value("${momo.partner-code:}")
  private String partnerCode;

  @Value("${momo.access-key:}")
  private String accessKey;

  @Value("${momo.secret-key:}")
  private String secretKey;

  @Value("${momo.endpoint:https://test-payment.momo.vn/v2/gateway/api/create}")
  private String endpoint;

  @Value("${momo.ipn-url:}")
  private String ipnUrl;

  @Value("${momo.redirect-url:}")
  private String redirectUrl;

  /** Kết quả tạo payment — chỉ các field FE cần (không lộ secret). */
  public record CreateResult(String qrCodeUrl, String deeplink, String momoOrderId,
                             String requestId, String amount, String message) {}

  /** Kết quả query trạng thái giao dịch từ MoMo. */
  public record QueryResult(boolean paid, boolean failed, String transId, String message) {}

  /**
   * Tạo yêu cầu thanh toán MoMo (captureWallet). amountVnd: chuỗi số nguyên VND.
   * Ném ApiException khi chưa cấu hình key, MoMo không phản hồi, hoặc MoMo từ chối.
   */
  @SuppressWarnings("unchecked")
  public CreateResult createPayment(String amountVnd, String momoOrderId, String requestId,
                                    String orderInfo, String extraDataBase64) {
    requireConfigured();
    String ipn = blank(ipnUrl) ? "" : ipnUrl;
    String redirect = blank(redirectUrl) ? "" : redirectUrl;

    String rawSignature = "accessKey=" + accessKey
        + "&amount=" + amountVnd
        + "&extraData=" + extraDataBase64
        + "&ipnUrl=" + ipn
        + "&orderId=" + momoOrderId
        + "&orderInfo=" + orderInfo
        + "&partnerCode=" + partnerCode
        + "&redirectUrl=" + redirect
        + "&requestId=" + requestId
        + "&requestType=" + REQUEST_TYPE_CAPTURE_WALLET;

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("partnerCode", partnerCode);
    body.put("requestId", requestId);
    body.put("amount", amountVnd);
    body.put("orderId", momoOrderId);
    body.put("orderInfo", orderInfo);
    body.put("redirectUrl", redirect);
    body.put("ipnUrl", ipn);
    body.put("requestType", REQUEST_TYPE_CAPTURE_WALLET);
    body.put("extraData", extraDataBase64);
    body.put("lang", "vi");
    body.put("signature", sign(rawSignature));

    Map<String, Object> res = post(endpoint, body);
    int resultCode = toInt(res.get("resultCode"));
    String message = str(res.get("message"));
    if (resultCode != 0) {
      log.warn("MoMo create từ chối: resultCode={} momoOrderId={}", resultCode, momoOrderId);
      throw new ApiException(HttpStatus.BAD_GATEWAY, "MOMO_REJECTED",
          "MoMo từ chối yêu cầu thanh toán" + (blank(message) ? "." : ": " + message));
    }
    return new CreateResult(str(res.get("qrCodeUrl")), str(res.get("deeplink")),
        str(res.get("orderId")), str(res.get("requestId")), amountVnd, message);
  }

  /**
   * Verify chữ ký IPN — BẮT BUỘC gọi trước mọi cập nhật DB.
   * payload: body JSON MoMo gửi (đã parse), KHÔNG bao gồm trường "signature".
   */
  public boolean verifyIpnSignature(Map<String, String> payload, String signature) {
    if (blank(signature)) return false;
    String rawSignature = "accessKey=" + accessKey
        + "&amount=" + nv(payload.get("amount"))
        + "&extraData=" + nv(payload.get("extraData"))
        + "&message=" + nv(payload.get("message"))
        + "&orderId=" + nv(payload.get("orderId"))
        + "&orderInfo=" + nv(payload.get("orderInfo"))
        + "&orderType=" + nv(payload.get("orderType"))
        + "&partnerCode=" + nv(payload.get("partnerCode"))
        + "&payType=" + nv(payload.get("payType"))
        + "&requestId=" + nv(payload.get("requestId"))
        + "&responseTime=" + nv(payload.get("responseTime"))
        + "&resultCode=" + nv(payload.get("resultCode"))
        + "&transId=" + nv(payload.get("transId"));
    String expected = sign(rawSignature);
    // so sánh hằng thời gian, không phân biệt hoa/thường (hex)
    return MessageDigest.isEqual(
        expected.toLowerCase().getBytes(StandardCharsets.UTF_8),
        signature.trim().toLowerCase().getBytes(StandardCharsets.UTF_8));
  }

  /**
   * Query trực tiếp trạng thái giao dịch trên MoMo (nút "Tôi đã thanh toán xong").
   * Endpoint query suy từ endpoint create: .../api/create → .../api/query.
   */
  @SuppressWarnings("unchecked")
  public QueryResult queryTransaction(String momoOrderId, String requestId) {
    requireConfigured();
    String rawSignature = "accessKey=" + accessKey
        + "&orderId=" + momoOrderId
        + "&partnerCode=" + partnerCode
        + "&requestId=" + requestId;
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("partnerCode", partnerCode);
    body.put("requestId", requestId);
    body.put("orderId", momoOrderId);
    body.put("lang", "vi");
    body.put("signature", sign(rawSignature));

    String queryEndpoint = endpoint.replace("/create", "/query");
    Map<String, Object> res = post(queryEndpoint, body);
    int resultCode = toInt(res.get("resultCode"));
    String message = str(res.get("message"));
    String transId = str(res.get("transId"));
    if (resultCode == 0) {
      return new QueryResult(true, false, transId, message);
    }
    // resultCode 1000 = giao dịch chưa tồn tại / đang chờ → chưa thanh toán, không phải lỗi
    boolean notFound = resultCode == 1000;
    if (!notFound) {
      log.warn("MoMo query báo thất bại: resultCode={} momoOrderId={}", resultCode, momoOrderId);
    }
    return new QueryResult(false, !notFound, transId, message);
  }

  /** Mã hóa extraData theo yêu cầu MoMo: base64(JSON). */
  public static String encodeExtraData(String json) {
    return Base64.getEncoder().encodeToString(
        (json != null ? json : "").getBytes(StandardCharsets.UTF_8));
  }

  // ---------- internals ----------

  private void requireConfigured() {
    if (blank(partnerCode) || blank(accessKey) || blank(secretKey)) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MOMO_NOT_CONFIGURED",
          "Thanh toán MoMo chưa được cấu hình. Vui lòng liên hệ shop hoặc thử lại sau.");
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> post(String url, Map<String, Object> body) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    try {
      Map<String, Object> res = restTemplate.postForObject(url, new HttpEntity<>(body, headers), Map.class);
      if (res == null) {
        throw new ApiException(HttpStatus.BAD_GATEWAY, "MOMO_EMPTY_RESPONSE",
            "MoMo không trả về dữ liệu. Vui lòng thử lại.");
      }
      return res;
    } catch (ResourceAccessException e) {
      // KHÔNG đưa e.getMessage() ra ngoài — có thể lộ host/key trong URL
      log.warn("Không kết nối được MoMo: {}", e.getClass().getSimpleName());
      throw new ApiException(HttpStatus.BAD_GATEWAY, "MOMO_UNREACHABLE",
          "Không kết nối được MoMo. Vui lòng thử lại sau.");
    }
  }

  /** HMAC-SHA256, trả về hex thường. Secret không bao giờ rời khỏi method này. */
  private String sign(String rawSignature) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] bytes = mac.doFinal(rawSignature.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder(bytes.length * 2);
      for (byte b : bytes) sb.append(String.format("%02x", b));
      return sb.toString();
    } catch (Exception e) {
      throw new IllegalStateException("Không ký được yêu cầu MoMo", e);
    }
  }

  private boolean blank(String s) {
    return s == null || s.trim().isEmpty();
  }

  private String nv(String s) {
    return s != null ? s : "";
  }

  private String str(Object o) {
    return o != null ? String.valueOf(o) : "";
  }

  private int toInt(Object o) {
    try {
      return Integer.parseInt(str(o));
    } catch (NumberFormatException e) {
      return -1;
    }
  }
}
