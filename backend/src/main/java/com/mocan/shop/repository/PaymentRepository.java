package com.mocan.shop.repository;

import com.mocan.shop.model.Payment;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends MongoRepository<Payment, String> {
  List<Payment> findByOrderIdOrderByCreatedAtDesc(String orderId);
  Optional<Payment> findByMomoOrderId(String momoOrderId);
  /** Scheduler hết hạn: các payment MoMo còn treo đã quá expiresAt. */
  List<Payment> findByStatusAndExpiresAtBefore(String status, Instant time);
}
