package com.mocan.shop.repository;

import com.mocan.shop.model.Review;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends MongoRepository<Review, String> {
  List<Review> findByProductIdOrderByCreatedAtDesc(String productId);
  long countByProductId(String productId);
  Optional<Review> findByProductIdAndUserId(String productId, String userId);
  boolean existsByProductIdAndUserId(String productId, String userId);
}
