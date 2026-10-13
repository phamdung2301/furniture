package com.mocan.shop.repository;

import com.mocan.shop.model.ProductVariant;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ProductVariantRepository extends MongoRepository<ProductVariant, String> {
  List<ProductVariant> findByProductId(String productId);
  // QL Sản phẩm (màn 15, F-014/US-013): SKU unique toàn hệ thống.
  boolean existsBySku(String sku);
  boolean existsBySkuAndProductIdNot(String sku, String productId);
  void deleteByProductId(String productId);
  List<ProductVariant> findByProductIdIn(List<String> productIds);
  // Admin Dashboard: ứng viên sắp hết hàng — service lọc tiếp theo ngưỡng riêng
  // của từng variant (lowStockThreshold), sắp xếp tồn tăng dần (F-017).
  List<ProductVariant> findByStockLessThanEqualOrderByStockAsc(int stock);
}
