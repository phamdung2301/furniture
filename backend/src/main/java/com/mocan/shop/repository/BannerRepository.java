package com.mocan.shop.repository;

import com.mocan.shop.model.Banner;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface BannerRepository extends MongoRepository<Banner, String> {
  List<Banner> findByActiveTrueOrderBySortOrderAsc();

  /** Toàn bộ banner (kể cả đã tắt) cho màn admin — admin-banner.md §8. */
  List<Banner> findAllByOrderBySortOrderAsc();
}
