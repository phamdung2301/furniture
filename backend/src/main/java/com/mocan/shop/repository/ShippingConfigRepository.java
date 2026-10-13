package com.mocan.shop.repository;

import com.mocan.shop.model.ShippingConfig;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface ShippingConfigRepository extends MongoRepository<ShippingConfig, String> {
  Optional<ShippingConfig> findByKey(String key);
}
