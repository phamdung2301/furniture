package com.mocan.shop.dto;

import lombok.Data;

/** Body POST /payments/momo/create — chỉ cần mã đơn (orderNumber là mã public NT-...). */
@Data
public class MomoCreateRequest {
  private String orderNumber;
}
