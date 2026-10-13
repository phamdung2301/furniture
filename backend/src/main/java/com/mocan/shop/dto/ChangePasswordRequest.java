package com.mocan.shop.dto;

import lombok.Data;

/**
 * Đổi mật khẩu — PUT /users/me/password (F-010).
 * Tài khoản Google (chưa có mật khẩu): currentPassword để trống/null -> tạo mật khẩu.
 * logoutOtherDevices: [Giả định] — nhận field, quản lý phiên đa thiết bị
 * chưa có nên server hiện chưa áp dụng (JWT stateless).
 */
@Data
public class ChangePasswordRequest {
  private String currentPassword;
  private String newPassword;
  private Boolean logoutOtherDevices;
}
