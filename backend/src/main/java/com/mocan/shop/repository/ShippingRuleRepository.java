package com.mocan.shop.repository;

import com.mocan.shop.model.ShippingRule;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ShippingRuleRepository extends MongoRepository<ShippingRule, String> {
  List<ShippingRule> findByActiveTrue();
}
