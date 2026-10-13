package com.mocan.shop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling // scheduler tự hủy đơn MoMo hết 30 phút (OrderService.expireUnpaidMomoOrders)
public class MocanShopApplication {
  public static void main(String[] args) {
    SpringApplication.run(MocanShopApplication.class, args);
  }
}
