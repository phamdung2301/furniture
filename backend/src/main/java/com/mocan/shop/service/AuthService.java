package com.mocan.shop.service;

import com.mocan.shop.dto.AuthResponse;
import com.mocan.shop.dto.LoginRequest;
import com.mocan.shop.dto.OtpSendRequest;
import com.mocan.shop.dto.OtpSendResponse;
import com.mocan.shop.dto.OtpVerifyRequest;
import com.mocan.shop.dto.RegisterRequest;
import com.mocan.shop.dto.RegisterResponse;
import com.mocan.shop.dto.UserDto;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.User;
import com.mocan.shop.repository.UserRepository;
import com.mocan.shop.security.JwtUtil;
import com.mocan.shop.util.PhoneUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Đăng ký / đăng nhập / quên mật khẩu — F-010 / FR-030.
 * - password ≥ 8 ký tự, hash bcrypt; email unique (lowercase).
 * - Sai mật khẩu 5 lần → status LOCKED, mở lại sau 15 phút.
 * - FR-030: đăng nhập bằng mật khẩu chỉ cấp token khi phoneVerified = true;
 *   chưa xác thực → 403 PHONE_NOT_VERIFIED để FE chuyển sang màn OTP.
 * - §4.4 (admin-khach-hang.md — ĐIỀU KIỆN TIÊN QUYẾT của khóa admin FR-025):
 *   status=LOCKED + lockedUntil=null là khóa DO QUẢN TRỊ VIÊN — chặn đăng
 *   nhập ở MỌI đường (mật khẩu, OTP, và Google khi backend bổ sung endpoint
 *   Google: luồng Google hiện chưa có ở backend, khi làm phải gọi
 *   ensureLoginAllowed() trước khi cấp token như 2 đường còn lại) và KHÔNG
 *   bao giờ tự mở — chỉ admin mở ở màn Quản lý khách hàng. Nhánh tự mở khóa
 *   sau 15 phút chỉ áp cho khóa tự động (lockedUntil != null).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

  private static final int MIN_PASSWORD = 8; // F-010
  private static final int MAX_LOGIN_ATTEMPTS = 5; // F-010
  private static final long LOCK_MINUTES = 15; // F-010 [Giả định]
  private static final long RESET_TOKEN_MINUTES = 30; // link đặt lại MK 30 phút [Giả định]
  // Thông điệp khi bị khóa do quản trị viên — admin-khach-hang.md §4.4.
  private static final String ADMIN_LOCK_MESSAGE =
      "Tài khoản đã bị khóa. Vui lòng liên hệ hotline 1900 6868 để được hỗ trợ.";

  private static final Pattern EMAIL =
      Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
  private static final SecureRandom RANDOM = new SecureRandom();

  private final UserRepository userRepository;
  private final OtpService otpService;
  private final PasswordEncoder passwordEncoder;
  private final JwtUtil jwtUtil;

  /** Đăng ký — tạo user, gửi OTP, KHÔNG trả token (FR-030). */
  public RegisterResponse register(RegisterRequest req) {
    String fullName = req.getFullName() == null ? "" : req.getFullName().trim();
    if (fullName.length() < 2) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_NAME", "Vui lòng nhập họ tên.");
    }

    String email = req.getEmail() == null ? "" : req.getEmail().trim().toLowerCase();
    if (!EMAIL.matcher(email).matches()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_EMAIL",
          "Địa chỉ email chưa đúng định dạng.");
    }
    if (userRepository.findByEmail(email).isPresent()) {
      throw new ApiException(HttpStatus.CONFLICT, "EMAIL_EXISTS",
          "Email này đã được đăng ký. Vui lòng đăng nhập.");
    }

    String phone = PhoneUtil.normalize(req.getPhone());
    if (!PhoneUtil.isValidVn(phone)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PHONE",
          "Số điện thoại chưa đúng định dạng. Vui lòng nhập 10 chữ số, bắt đầu bằng 0.");
    }
    Optional<User> holder = userRepository.findByPhone(phone);
    if (holder.isPresent() && holder.get().isPhoneVerified()) {
      // F-024 edge case: 1 phone = 1 tài khoản đã xác thực
      throw new ApiException(HttpStatus.CONFLICT, "PHONE_EXISTS",
          "Số điện thoại này đã được dùng cho tài khoản khác. Vui lòng liên hệ hỗ trợ.");
    }
    // Tài khoản cũ đăng ký dở (chưa xác thực) → dọn để cho đăng ký lại sạch sẽ.
    holder.ifPresent(userRepository::delete);

    if (req.getPassword() == null || req.getPassword().length() < MIN_PASSWORD) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD",
          "Mật khẩu cần ít nhất 8 ký tự.");
    }

    User user = new User();
    user.setFullName(fullName);
    user.setEmail(email);
    user.setPhone(phone);
    user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
    user.setPhoneVerified(false);
    user.setRoles(List.of("ROLE_CUSTOMER"));
    user.setStatus("ACTIVE");
    user.setFailedLoginAttempts(0);
    user.setCreatedAt(Instant.now());
    user = userRepository.save(user);

    otpService.sendOtp(phone, "register");

    RegisterResponse res = new RegisterResponse();
    res.setUserId(user.getId());
    res.setMessage("Đăng ký thành công! Hãy xác thực số điện thoại để bắt đầu đặt hàng.");
    return res;
  }

  /** Đăng nhập bằng mật khẩu — tìm theo SĐT hoặc email. */
  public AuthResponse login(LoginRequest req) {
    String identifier = req.getIdentifier() == null ? "" : req.getIdentifier().trim();
    if (identifier.isEmpty() || req.getPassword() == null || req.getPassword().isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CREDENTIALS",
          "Vui lòng nhập đúng số điện thoại hoặc email và mật khẩu.");
    }

    String normalizedPhone = PhoneUtil.normalize(identifier);
    Optional<User> userOpt = PhoneUtil.isValidVn(normalizedPhone)
        ? userRepository.findByPhone(normalizedPhone)
        : userRepository.findByEmail(identifier.toLowerCase());

    // Không phân biệt "sai user" / "sai pass" để tránh lộ tài khoản tồn tại.
    if (userOpt.isEmpty()) {
      throw invalidCredentials(MAX_LOGIN_ATTEMPTS);
    }
    User user = userOpt.get();

    // §4.4: chặn khóa admin (lockedUntil == null) + khóa tạm còn hạn;
    // khóa tạm đã qua hạn thì tự mở bên trong ensureLoginAllowed.
    ensureLoginAllowed(user);

    boolean passwordOk = user.getPasswordHash() != null
        && passwordEncoder.matches(req.getPassword(), user.getPasswordHash());
    if (!passwordOk) {
      int attempts = user.getFailedLoginAttempts() + 1;
      user.setFailedLoginAttempts(attempts);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        user.setStatus("LOCKED");
        user.setLockedUntil(Instant.now().plus(Duration.ofMinutes(LOCK_MINUTES)));
        user.setFailedLoginAttempts(0);
        userRepository.save(user);
        throw new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED",
            "Tài khoản tạm khóa 15 phút do nhập sai quá nhiều lần. Vui lòng thử lại sau.");
      }
      userRepository.save(user);
      throw invalidCredentials(MAX_LOGIN_ATTEMPTS - attempts);
    }

    // Đăng nhập đúng → reset bộ đếm. §4.4: KHÔNG tự set ACTIVE cho tài
    // khoản bị khóa do admin (nhánh đó đã bị ensureLoginAllowed chặn ở
    // trên — điều kiện ở đây là phòng thủ 2 lớp, giữ nguyên tắc "khóa
    // admin chỉ admin mở").
    if (!("LOCKED".equals(user.getStatus()) && user.getLockedUntil() == null)) {
      user.setStatus("ACTIVE");
      user.setLockedUntil(null);
      user.setFailedLoginAttempts(0);
    }
    userRepository.save(user);

    // FR-030: chưa xác thực SĐT → không cấp token, FE chuyển sang màn OTP
    // (FE đã có SĐT từ form đăng nhập, body 403 chỉ cần {code, message})
    if (!user.isPhoneVerified()) {
      throw new ApiException(HttpStatus.FORBIDDEN, "PHONE_NOT_VERIFIED",
          "Số điện thoại chưa được xác thực. Vui lòng xác thực để tiếp tục.");
    }

    return issueToken(user, null);
  }

  /** Gửi OTP — ủy quyền OtpService (F-024). */
  public OtpSendResponse sendOtp(OtpSendRequest req) {
    int ttl = otpService.sendOtp(req.getPhone(), req.getPurpose());
    OtpSendResponse res = new OtpSendResponse();
    res.setMessage("Chúng tôi đã gửi mã 6 số đến số điện thoại của bạn.");
    res.setExpiresInSeconds(ttl);
    return res;
  }

  /**
   * Xác thực OTP — đúng → phoneVerified = true (purpose=register hoặc user chưa verified);
   * purpose=login → cấp luôn accessToken + user.
   */
  public AuthResponse verifyOtp(OtpVerifyRequest req) {
    String phone = otpService.verifyOtp(req.getPhone(), req.getCode());
    User user = userRepository.findByPhone(phone)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
            "Không tìm thấy tài khoản với số điện thoại này."));
    // §4.4: đường đăng nhập bằng OTP cũng phải chặn khóa admin / khóa tạm
    // còn hạn TRƯỚC khi cấp token (purpose=login). Purpose=register chỉ xác
    // thực SĐT, không cấp token nên không qua cổng này.
    if ("login".equals(req.getPurpose())) {
      ensureLoginAllowed(user);
    }
    if ("register".equals(req.getPurpose()) || !user.isPhoneVerified()) {
      user.setPhoneVerified(true);
      userRepository.save(user);
    }
    if ("login".equals(req.getPurpose())) {
      return issueToken(user, null);
    }
    AuthResponse res = new AuthResponse();
    res.setUser(toDto(user));
    res.setMessage("Xác thực thành công! Giờ bạn có thể đặt hàng.");
    return res;
  }

  /** Quên mật khẩu — luôn 200, không lộ email có tồn tại hay không (F-010). */
  public void forgotPassword(String rawEmail) {
    String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
    Optional<User> userOpt = EMAIL.matcher(email).matches()
        ? userRepository.findByEmail(email)
        : Optional.empty();
    if (userOpt.isPresent()) {
      User user = userOpt.get();
      byte[] bytes = new byte[32];
      RANDOM.nextBytes(bytes);
      String token = HexFormat.of().formatHex(bytes);
      user.setPasswordResetToken(token);
      user.setPasswordResetTokenExpiry(Instant.now().plus(Duration.ofMinutes(RESET_TOKEN_MINUTES)));
      userRepository.save(user);
      // Mock email — link đặt lại mật khẩu hiệu lực 30 phút.
      // LƯU Ý BẢO MẬT: token chỉ log ở debug khi test local; provider email thật
      // cấu hình ở server, và XÓA dòng debug khi chạy production.
      log.info("MOCK EMAIL tới {}: đã gửi link đặt lại mật khẩu (link không hiển thị ở log).", email);
      log.debug("MOCK EMAIL tới {}: link đặt lại MK test local = /dat-lai-mat-khau?token={} (KHÔNG bật ở production)",
          email, token);
    } else {
      log.info("MOCK EMAIL: yêu cầu đặt lại mật khẩu cho email không tồn tại (trả 200 như bình thường).");
    }
  }

  /** Đặt lại mật khẩu bằng token từ email. */
  public void resetPassword(String token, String newPassword) {
    if (token == null || token.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TOKEN",
          "Link đặt lại mật khẩu không hợp lệ.");
    }
    User user = userRepository.findByPasswordResetToken(token)
        .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TOKEN",
            "Link đặt lại mật khẩu không hợp lệ hoặc đã được dùng."));
    if (user.getPasswordResetTokenExpiry() == null
        || Instant.now().isAfter(user.getPasswordResetTokenExpiry())) {
      throw new ApiException(HttpStatus.GONE, "TOKEN_EXPIRED",
          "Link đặt lại mật khẩu đã hết hạn. Vui lòng gửi lại yêu cầu mới.");
    }
    if (newPassword == null || newPassword.length() < MIN_PASSWORD) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD",
          "Mật khẩu cần ít nhất 8 ký tự.");
    }
    user.setPasswordHash(passwordEncoder.encode(newPassword));
    user.setPasswordResetToken(null);
    user.setPasswordResetTokenExpiry(null);
    // Đặt lại mật khẩu thành công → gỡ khóa TỰ ĐỘNG (lockedUntil != null)
    // cho tiện; nhưng §4.3/§4.4: khóa do admin (lockedUntil == null) KHÔNG
    // được gỡ bằng đường này — chỉ admin mở ở màn Quản lý khách hàng.
    if (!("LOCKED".equals(user.getStatus()) && user.getLockedUntil() == null)) {
      user.setStatus("ACTIVE");
      user.setLockedUntil(null);
      user.setFailedLoginAttempts(0);
    }
    userRepository.save(user);
  }

  /**
   * Cổng chặn đăng nhập dùng chung cho MỌI đường cấp token (§4.4):
   * - LOCKED + lockedUntil == null → khóa do quản trị viên: từ chối với
   *   thông điệp riêng, không bao giờ tự mở.
   * - LOCKED + lockedUntil ở tương lai → tạm khóa tự động F-010: từ chối
   *   kèm thời gian còn lại.
   * - LOCKED + lockedUntil đã qua → tự mở khóa (ACTIVE, xóa bộ đếm) và lưu.
   * Luồng đăng nhập Google (khi backend bổ sung) BẮT BUỘC gọi hàm này
   * trước khi cấp token, giống login() và verifyOtp(purpose=login).
   */
  public void ensureLoginAllowed(User user) {
    if (!"LOCKED".equals(user.getStatus())) {
      return;
    }
    if (user.getLockedUntil() == null) {
      throw new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED", ADMIN_LOCK_MESSAGE);
    }
    if (Instant.now().isBefore(user.getLockedUntil())) {
      long seconds = Duration.between(Instant.now(), user.getLockedUntil()).getSeconds();
      throw new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED",
          "Tài khoản tạm khóa 15 phút do nhập sai quá nhiều lần. Vui lòng thử lại sau "
              + formatCountdown(seconds) + ".");
    }
    // Khóa tự động đã qua hạn → tự mở.
    user.setStatus("ACTIVE");
    user.setLockedUntil(null);
    user.setFailedLoginAttempts(0);
    userRepository.save(user);
  }

  // ---------- helpers ----------

  private AuthResponse issueToken(User user, String message) {
    String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRoles());
    AuthResponse res = new AuthResponse();
    res.setAccessToken(token);
    res.setUser(toDto(user));
    res.setMessage(message);
    return res;
  }

  private ApiException invalidCredentials(int attemptsLeft) {
    return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
        "Số điện thoại/email hoặc mật khẩu chưa đúng. Bạn còn "
            + attemptsLeft + " lần thử.");
  }

  private String formatCountdown(long seconds) {
    long m = seconds / 60;
    long s = seconds % 60;
    return m + " phút " + s + " giây";
  }

  public static UserDto toDto(User user) {
    UserDto dto = new UserDto();
    dto.setId(user.getId());
    dto.setFullName(user.getFullName());
    dto.setEmail(user.getEmail());
    dto.setPhone(user.getPhone());
    dto.setPhoneVerified(user.isPhoneVerified());
    dto.setRoles(user.getRoles());
    dto.setStatus(user.getStatus());
    return dto;
  }
}
