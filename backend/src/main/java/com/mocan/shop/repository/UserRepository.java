package com.mocan.shop.repository;

import com.mocan.shop.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Người dùng — F-010 / FR-030. Đăng nhập tìm theo SĐT hoặc email. */
public interface UserRepository extends MongoRepository<User, String> {
  Optional<User> findByPhone(String phone);

  Optional<User> findByEmail(String email);

  Optional<User> findByPhoneOrEmail(String phone, String email);

  Optional<User> findByPasswordResetToken(String token);

  // Admin Dashboard: khách hàng mới trong khoảng (lọc role CUSTOMER ở service).
  List<User> findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(Instant from, Instant to);
}
