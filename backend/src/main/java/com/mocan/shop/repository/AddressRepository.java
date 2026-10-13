package com.mocan.shop.repository;

import com.mocan.shop.model.Address;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

/** Sổ địa chỉ — F-011. */
public interface AddressRepository extends MongoRepository<Address, String> {
  List<Address> findByUserIdOrderByCreatedAtAsc(String userId);
  long countByUserId(String userId);
  Optional<Address> findByIdAndUserId(String id, String userId);
}
