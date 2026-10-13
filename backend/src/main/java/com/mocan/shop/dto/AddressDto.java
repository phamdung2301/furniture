package com.mocan.shop.dto;

import lombok.Data;

/** Địa chỉ giao hàng trả về cho FE — dat-hang.md §2. */
@Data
public class AddressDto {
  private String id;
  private String label; // Nhà | Công ty
  private String receiverName;
  private String phone;
  private String province;
  private String district;
  private String ward;
  private String detail;
  private String note;
  private boolean isDefault;
  /** Địa chỉ đầy đủ 1 dòng cho radio list: "12 Nguyễn Trãi, P. Bến Thành, Q.1, TP.HCM". */
  private String fullAddress;
}
