package com.mocan.shop.dto;

import lombok.Data;

/** Body tạo/sửa địa chỉ — POST /addresses, PUT /addresses/{id}. */
@Data
public class AddressRequest {
  private String label; // Nhà | Công ty
  private String receiverName;
  private String phone;
  private String province;
  private String district;
  private String ward;
  private String detail;
  private String note;
  /** null khi update = giữ nguyên; khi create null = false. */
  private Boolean isDefault;
}
