package com.mocan.shop.repository;

import com.mocan.shop.model.Voucher;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface VoucherRepository extends MongoRepository<Voucher, String> {
  Optional<Voucher> findByCode(String code);
  List<Voucher> findByActiveTrueOrderByEndAtAsc();
  /** Chương trình flash sale đang bật (FlashSaleService tự lọc theo khung giờ/suất). */
  List<Voucher> findByTypeAndActiveTrue(String type);
}
