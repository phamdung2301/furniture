package com.mocan.shop.repository;

import com.mocan.shop.model.Cart;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

/** Giỏ hàng — F-006 / FR-008. Giỏ theo user đã đăng nhập. */
public interface CartRepository extends MongoRepository<Cart, String> {
  Optional<Cart> findByUserId(String userId);
}
