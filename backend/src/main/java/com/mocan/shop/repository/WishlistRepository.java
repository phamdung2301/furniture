package com.mocan.shop.repository;

import com.mocan.shop.model.Wishlist;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

/** Wishlist — F-013 / FR-018. */
public interface WishlistRepository extends MongoRepository<Wishlist, String> {
  List<Wishlist> findByUserIdOrderByCreatedAtDesc(String userId);
  Optional<Wishlist> findByUserIdAndProductId(String userId, String productId);
  void deleteByUserIdAndProductId(String userId, String productId);
}
