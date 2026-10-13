package com.mocan.shop.service;

import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.OtpCode;
import com.mocan.shop.model.User;
import com.mocan.shop.repository.OtpRepository;
import com.mocan.shop.repository.UserRepository;
import com.mocan.shop.util.PhoneUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Xác thực SĐT bằng OTP — F-024 / FR-030.
 * - Mã 6 số ngẫu nhiên (SecureRandom), hiệu lực 5 phút (TTL trong Mongo).
 * - Gửi lại cách nhau tối thiểu 60 giây (sớm hơn → 429 RESEND_TOO_SOON).
 * - Sai tối đa 5 lần → hủy mã (410 OTP_ATTEMPTS_EXCEEDED).
 * - 1 phone = 1 tài khoản đã xác thực (F-024 edge case).
 * - BẢO MẬT: mã plain CHỈ lưu hash bcrypt, KHÔNG BAO GIỜ log ở mức info;
 *   dòng debug có mã chỉ dùng khi test local — XÓA/TẮT khi dùng provider SMS thật.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OtpService {

  public static final int CODE_LENGTH = 6;
  public static final int TTL_SECONDS = 300; // 5 phút — F-024
  public static final int RESEND_SECONDS = 60; // gửi lại cách 60s — F-024
  public static final int MAX_ATTEMPTS = 5; // 5 lần sai → hủy mã — F-024

  private static final SecureRandom RANDOM = new SecureRandom();

  private final OtpRepository otpRepository;
  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  /**
   * purpose = "register" | "login" | "verify-phone" | "change-phone"
   * (2 purpose sau dùng ở màn Hồ sơ). Trả về số giây hiệu lực của mã.
   */
  public int sendOtp(String rawPhone, String purpose) {
    String phone = PhoneUtil.normalize(rawPhone);
    if (!PhoneUtil.isValidVn(phone)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PHONE",
          "Số điện thoại chưa đúng định dạng. Vui lòng nhập 10 chữ số, bắt đầu bằng 0.");
    }
    if (!"register".equals(purpose) && !"login".equals(purpose)
        && !"verify-phone".equals(purpose) && !"change-phone".equals(purpose)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PURPOSE",
          "Mục đích gửi mã không hợp lệ.");
    }

    Optional<User> holder = userRepository.findByPhone(phone);
    if ("register".equals(purpose)
        && holder.isPresent() && holder.get().isPhoneVerified()) {
      // F-024 edge case: SĐT đã thuộc tài khoản khác đã xác thực
      throw new ApiException(HttpStatus.CONFLICT, "PHONE_EXISTS",
          "Số điện thoại này đã được dùng cho tài khoản khác. Vui lòng liên hệ hỗ trợ.");
    }
    if ("change-phone".equals(purpose)
        && holder.isPresent() && holder.get().isPhoneVerified()) {
      // F-024 edge case: số mới đã được tài khoản khác xác thực
      // (UserService.changePhone kiểm tra lại, loại trừ chính user đang đổi).
      throw new ApiException(HttpStatus.CONFLICT, "PHONE_EXISTS",
          "Số điện thoại này đã được dùng cho tài khoản khác. "
              + "Vui lòng liên hệ hotline 1900 6868 để được hỗ trợ.");
    }
    if (("login".equals(purpose) || "verify-phone".equals(purpose)) && holder.isEmpty()) {
      throw new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
          "Chưa có tài khoản với số điện thoại này.");
    }

    Instant now = Instant.now();
    Optional<OtpCode> existing = otpRepository.findByPhone(phone);
    if (existing.isPresent()) {
      long secondsSinceLast = Duration.between(existing.get().getLastSentAt(), now).getSeconds();
      if (secondsSinceLast < RESEND_SECONDS) {
        throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RESEND_TOO_SOON",
            "Vui lòng chờ " + (RESEND_SECONDS - secondsSinceLast)
                + " giây nữa trước khi gửi lại mã.");
      }
    }

    String code = String.format("%06d", RANDOM.nextInt(1_000_000));

    OtpCode otp = existing.orElseGet(OtpCode::new);
    otp.setPhone(phone);
    otp.setCodeHash(passwordEncoder.encode(code));
    otp.setPurpose(purpose);
    otp.setFailedAttempts(0);
    otp.setLastSentAt(now);
    otp.setExpiresAt(now.plusSeconds(TTL_SECONDS));
    otp.setCreatedAt(otp.getCreatedAt() != null ? otp.getCreatedAt() : now);
    otpRepository.save(otp);

    // Mock SMS — provider thật cấu hình ở server (bản so sánh provider riêng).
    // LƯU Ý BẢO MẬT: không bao giờ log mã OTP ở mức info.
    log.info("MOCK SMS tới {}: đã gửi mã xác thực 6 số (mã không hiển thị ở log).", phone);
    // Dòng debug dưới CHỈ dùng khi test local; XÓA hoặc tắt debug cho class này
    // khi dùng provider SMS thật / chạy production.
    log.debug("MOCK SMS tới {}: mã OTP test local = {} (KHÔNG bật ở production)", phone, code);

    return TTL_SECONDS;
  }

  /**
   * Kiểm tra mã OTP. Đúng → xóa mã và trả về phone đã xác thực.
   * Sai → tăng bộ đếm; đủ 5 lần → hủy mã (F-024).
   */
  public String verifyOtp(String rawPhone, String code) {
    String phone = PhoneUtil.normalize(rawPhone);
    if (code == null || !code.matches("\\d{6}")) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID",
          "Mã xác thực gồm 6 chữ số.");
    }

    OtpCode otp = otpRepository.findByPhone(phone)
        .orElseThrow(() -> new ApiException(HttpStatus.GONE, "OTP_EXPIRED",
            "Mã đã hết hạn. Vui lòng bấm Gửi lại mã để nhận mã mới."));

    if (Instant.now().isAfter(otp.getExpiresAt())) {
      otpRepository.delete(otp);
      throw new ApiException(HttpStatus.GONE, "OTP_EXPIRED",
          "Mã đã hết hạn. Vui lòng bấm Gửi lại mã để nhận mã mới.");
    }

    if (!passwordEncoder.matches(code, otp.getCodeHash())) {
      int attempts = otp.getFailedAttempts() + 1;
      if (attempts >= MAX_ATTEMPTS) {
        otpRepository.delete(otp);
        throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "OTP_ATTEMPTS_EXCEEDED",
            "Bạn đã nhập sai quá 5 lần. Mã này đã bị hủy — vui lòng bấm Gửi lại mã để nhận mã mới.");
      }
      otp.setFailedAttempts(attempts);
      otpRepository.save(otp);
      throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID",
          "Mã xác thực chưa đúng. Bạn còn " + (MAX_ATTEMPTS - attempts) + " lần thử.");
    }

    otpRepository.delete(otp); // mã dùng 1 lần
    return phone;
  }
}
