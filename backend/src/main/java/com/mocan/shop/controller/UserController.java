package com.mocan.shop.controller;

import com.mocan.shop.dto.ChangePasswordRequest;
import com.mocan.shop.dto.ChangePhoneRequest;
import com.mocan.shop.dto.ProfileDto;
import com.mocan.shop.dto.UpdateProfileRequest;
import com.mocan.shop.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Hồ sơ tài khoản — FR-015 / F-010 / F-024 (màn Hồ sơ).
 * Contract khớp FE (userApi.js):
 *   GET /users/me           -> ProfileDto
 *   PUT /users/me           {fullName?, avatarUrl?}        -> ProfileDto
 *   PUT /users/me/password  {currentPassword, newPassword} -> 200 {message}
 *   PUT /users/me/phone     {phone, otpCode}               -> ProfileDto
 * userId = JWT subject (SecurityContextHolder), pattern như AddressController.
 * /users/** yêu cầu đăng nhập (SecurityConfig: anyRequest authenticated).
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

  private final UserService userService;

  @GetMapping("/me")
  public ProfileDto getProfile() {
    return userService.getProfile(currentUserId());
  }

  @PutMapping("/me")
  public ProfileDto updateProfile(@RequestBody UpdateProfileRequest request) {
    return userService.updateProfile(currentUserId(), request);
  }

  @PutMapping("/me/password")
  public Map<String, String> changePassword(@RequestBody ChangePasswordRequest request) {
    userService.changePassword(currentUserId(), request);
    return Map.of("message", "Đã đổi mật khẩu.");
  }

  @PutMapping("/me/phone")
  public ProfileDto changePhone(@RequestBody ChangePhoneRequest request) {
    return userService.changePhone(currentUserId(), request);
  }

  private String currentUserId() {
    return SecurityContextHolder.getContext().getAuthentication().getName();
  }
}
