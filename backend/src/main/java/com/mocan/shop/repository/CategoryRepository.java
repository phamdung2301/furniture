package com.mocan.shop.repository;

import com.mocan.shop.model.Category;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends MongoRepository<Category, String> {
  List<Category> findTop8ByActiveTrueOrderBySortOrderAsc();
  Optional<Category> findBySlug(String slug);
  // QL Danh mục (màn 16, F-015): slug unique + cây 2 cấp + nhóm anh em cho move.
  boolean existsBySlug(String slug);
  boolean existsBySlugAndIdNot(String slug, String id);
  List<Category> findByParentId(String parentId);
  long countByParentId(String parentId);
}
