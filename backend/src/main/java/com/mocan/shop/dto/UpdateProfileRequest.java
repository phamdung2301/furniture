package com.mocan.shop.dto;

import lombok.Data;

/**
 * Cập nhật hồ sơ — PUT /users/me (FR-015).
 * Field null = giữ nguyên; avatarUrl = "" (chuỗi rỗng) = xóa ảnh đại diện.
 */
@Data
public class UpdateProfileRequest {
  private String fullName;
  private String avatarUrl;
}
