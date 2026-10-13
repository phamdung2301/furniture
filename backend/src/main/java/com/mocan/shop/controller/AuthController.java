package com.mocan.shop.controller;

import com.mocan.shop.dto.AuthResponse;
import com.mocan.shop.dto.ForgotPasswordRequest;
import com.mocan.shop.dto.LoginRequest;
import com.mocan.shop.dto.OtpSendRequest;
import com.mocan.shop.dto.OtpSendResponse;
import com.mocan.shop.dto.OtpVerifyRequest;
import com.mocan.shop.dto.RegisterRequest;
import com.mocan.shop.dto.RegisterResponse;
import com.mocan.shop.dto.ResetPasswordRequest;
import com.mocan.shop.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Xác thực tài khoản — F-010 / F-024 / FR-030.
 * Contract khớp FE (authApi.js):
 *   POST /auth/register       {fullName, email, phone, password} → {userId, message} (KHÔNG token)
 *   POST /auth/login          {identifier, password}             → {accessToken, user}
 *   POST /auth/otp/send       {phone, purpose}                   → {message, expiresInSeconds}
 *   POST /auth/otp/verify     {phone, code, purpose}             → {accessToken?, user, message}
 *   POST /auth/forgot-password {email}                          → 200 luôn (mock email)
 *   POST /auth/reset-password {token, newPassword}              → 200 {message}
 * Lỗi trả {code, message} (xem GlobalExceptionHandler), vd code PHONE_NOT_VERIFIED (403),
 * ACCOUNT_LOCKED (423), INVALID_CREDENTIALS (401), OTP_* (400/410/429).
 * Tất cả permitAll trong SecurityConfig (/auth/**).
 */
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

  private final AuthService authService;

  @PostMapping("/register")
  public RegisterResponse register(@RequestBody RegisterRequest request) {
    return authService.register(request);
  }

  @PostMapping("/login")
  public AuthResponse login(@RequestBody LoginRequest request) {
    return authService.login(request);
  }

  @PostMapping("/otp/send")
  public OtpSendResponse sendOtp(@RequestBody OtpSendRequest request) {
    return authService.sendOtp(request);
  }

  @PostMapping("/otp/verify")
  public AuthResponse verifyOtp(@RequestBody OtpVerifyRequest request) {
    return authService.verifyOtp(request);
  }

  @PostMapping("/forgot-password")
  public Map<String, String> forgotPassword(@RequestBody ForgotPasswordRequest request) {
    authService.forgotPassword(request.getEmail());
    return Map.of("message",
        "Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (kể cả thư rác).");
  }

  @PostMapping("/reset-password")
  public Map<String, String> resetPassword(@RequestBody ResetPasswordRequest request) {
    authService.resetPassword(request.getToken(), request.getNewPassword());
    return Map.of("message", "Đổi mật khẩu thành công, mời bạn đăng nhập lại.");
  }
}
