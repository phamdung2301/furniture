package com.mocan.shop.repository;

import com.mocan.shop.model.Product;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ProductRepository extends MongoRepository<Product, String> {
  // QL Sản phẩm (màn 15, F-014): kiểm tra slug unique khi tạo/sửa.
  boolean existsBySlug(String slug);
  boolean existsBySlugAndIdNot(String slug, String id);
  List<Product> findByFeaturedTrueAndActiveTrue();
  List<Product> findByActiveTrueOrderBySoldCountDesc(Pageable pageable);
  List<Product> findByActiveTrueOrderByCreatedAtDesc(Pageable pageable);
  List<Product> findByActiveTrue();
  List<Product> findByCategoryIdAndActiveTrue(String categoryId);
  // QL Danh mục (màn 16, F-015): đếm sản phẩm trực thuộc + chặn xóa danh mục còn sản phẩm.
  long countByCategoryId(String categoryId);
}
