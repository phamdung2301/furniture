package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/**
 * Thông tin user trả về FE — KHÔNG bao giờ chứa passwordHash.
 * FE dùng phoneVerified để hiện banner xác thực / chặn đặt hàng (FR-030).
 */
@Data
public class UserDto {
  private String id;
  private String fullName;
  private String email;
  private String phone;
  private boolean phoneVerified;
  private List<String> roles;
  private String status;
}
