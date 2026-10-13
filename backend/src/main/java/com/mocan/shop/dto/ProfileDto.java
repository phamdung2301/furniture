package com.mocan.shop.dto;

import lombok.Data;
import java.time.Instant;
import java.util.List;

/**
 * Hồ sơ tài khoản trả về cho màn Hồ sơ — FR-015.
 * Mở rộng UserDto: avatarUrl + hasPassword (FE quyết định hiện form
 * Đổi mật khẩu hay form Tạo mật khẩu cho tài khoản Google — F-010).
 * KHÔNG bao giờ chứa passwordHash.
 */
@Data
public class ProfileDto {
  private String id;
  private String fullName;
  private String email;
  private String phone;
  private boolean phoneVerified;
  private String avatarUrl;
  private boolean hasPassword;
  private List<String> roles;
  private String status;
  private Instant createdAt;
}
