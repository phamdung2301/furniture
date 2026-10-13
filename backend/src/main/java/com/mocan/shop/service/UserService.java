package com.mocan.shop.service;

import com.mocan.shop.dto.ChangePasswordRequest;
import com.mocan.shop.dto.ChangePhoneRequest;
import com.mocan.shop.dto.ProfileDto;
import com.mocan.shop.dto.UpdateProfileRequest;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.User;
import com.mocan.shop.repository.UserRepository;
import com.mocan.shop.util.PhoneUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Hồ sơ tài khoản — FR-015 / F-010 / F-024 (màn Hồ sơ).
 * - Email là định danh đăng nhập (F-010) -> KHÔNG có luồng đổi email ở đây.
 * - Đổi mật khẩu: verify mật khẩu hiện tại bằng bcrypt; sai -> 400
 *   WRONG_CURRENT_PASSWORD để FE hiện message ngay dưới field.
 * - Đổi SĐT: OTP gửi về SỐ MỚI (OtpService), xác thực lại ở server;
 *   SĐT đã được tài khoản khác xác thực -> 409 PHONE_EXISTS (F-024 edge).
 */
@Service
@RequiredArgsConstructor
public class UserService {

  private static final int MIN_PASSWORD = 8; // F-010
  private static final int MIN_NAME = 2;
  private static final int MAX_NAME = 50;

  private final UserRepository userRepository;
  private final OtpService otpService;
  private final PasswordEncoder passwordEncoder;

  public ProfileDto getProfile(String userId) {
    return toProfileDto(getUser(userId));
  }

  /** Cập nhật họ tên / ảnh đại diện. Field null = giữ nguyên; avatarUrl "" = xóa ảnh. */
  public ProfileDto updateProfile(String userId, UpdateProfileRequest req) {
    User user = getUser(userId);
    if (req.getFullName() != null) {
      String name = req.getFullName().trim();
      if (name.length() < MIN_NAME || name.length() > MAX_NAME) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_NAME",
            "Họ tên cần từ 2 đến 50 ký tự.");
      }
      user.setFullName(name);
    }
    if (req.getAvatarUrl() != null) {
      user.setAvatarUrl(req.getAvatarUrl().isBlank() ? null : req.getAvatarUrl());
    }
    return toProfileDto(userRepository.save(user));
  }

  /**
   * Đổi mật khẩu. User chưa có mật khẩu (login Google, passwordHash == null)
   * -> tạo mật khẩu, bỏ qua kiểm tra mật khẩu hiện tại.
   */
  public void changePassword(String userId, ChangePasswordRequest req) {
    User user = getUser(userId);
    String newPassword = req.getNewPassword();
    if (newPassword == null || newPassword.length() < MIN_PASSWORD) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD",
          "Mật khẩu cần ít nhất 8 ký tự.");
    }
    if (user.getPasswordHash() != null) {
      String current = req.getCurrentPassword();
      if (current == null || !passwordEncoder.matches(current, user.getPasswordHash())) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "WRONG_CURRENT_PASSWORD",
            "Mật khẩu hiện tại chưa đúng.");
      }
      if (newPassword.equals(current)) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "SAME_PASSWORD",
            "Mật khẩu mới cần khác mật khẩu hiện tại.");
      }
    }
    user.setPasswordHash(passwordEncoder.encode(newPassword));
    userRepository.save(user);
    // logoutOtherDevices: [Giả định] JWT stateless chưa có quản lý phiên
    // đa thiết bị -> nhận field nhưng chưa áp dụng.
  }

  /**
   * Đổi số điện thoại — bắt buộc OTP về số mới (F-024).
   * Đổi xong phoneVerified = true (số mới đã được xác thực bằng OTP).
   */
  public ProfileDto changePhone(String userId, ChangePhoneRequest req) {
    User user = getUser(userId);
    String phone = PhoneUtil.normalize(req.getPhone());
    if (!PhoneUtil.isValidVn(phone)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PHONE",
          "Số điện thoại chưa đúng định dạng. Vui lòng nhập 10 chữ số, bắt đầu bằng 0.");
    }
    if (phone.equals(user.getPhone())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "SAME_PHONE",
          "Số điện thoại mới trùng với số hiện tại.");
    }
    Optional<User> holder = userRepository.findByPhone(phone);
    if (holder.isPresent() && !holder.get().getId().equals(user.getId())
        && holder.get().isPhoneVerified()) {
      // F-024 edge case: 1 SĐT đã xác thực = 1 tài khoản
      throw new ApiException(HttpStatus.CONFLICT, "PHONE_EXISTS",
          "Số điện thoại này đã được dùng cho tài khoản khác. "
              + "Vui lòng liên hệ hotline 1900 6868 để được hỗ trợ.");
    }
    // Xác thực mã OTP (mã đã gửi về số mới) — sai/hết hạn do OtpService ném lỗi.
    otpService.verifyOtp(phone, req.getOtpCode());

    user.setPhone(phone);
    user.setPhoneVerified(true);
    return toProfileDto(userRepository.save(user));
  }

  // ---------- helpers ----------

  private User getUser(String userId) {
    return userRepository.findById(userId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
            "Không tìm thấy tài khoản."));
  }

  public static ProfileDto toProfileDto(User user) {
    ProfileDto dto = new ProfileDto();
    dto.setId(user.getId());
    dto.setFullName(user.getFullName());
    dto.setEmail(user.getEmail());
    dto.setPhone(user.getPhone());
    dto.setPhoneVerified(user.isPhoneVerified());
    dto.setAvatarUrl(user.getAvatarUrl());
    dto.setHasPassword(user.getPasswordHash() != null);
    dto.setRoles(user.getRoles());
    dto.setStatus(user.getStatus());
    dto.setCreatedAt(user.getCreatedAt());
    return dto;
  }
}
