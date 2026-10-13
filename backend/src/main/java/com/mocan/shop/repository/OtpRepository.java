package com.mocan.shop.repository;

import com.mocan.shop.model.OtpCode;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

/** Mã OTP xác thực SĐT — F-024. 1 phone = 1 bản ghi. */
public interface OtpRepository extends MongoRepository<OtpCode, String> {
  Optional<OtpCode> findByPhone(String phone);

  void deleteByPhone(String phone);
}
