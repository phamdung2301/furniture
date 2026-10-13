package com.mocan.shop.repository;

import com.mocan.shop.model.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends MongoRepository<Order, String> {
  Optional<Order> findByOrderNumber(String orderNumber);
  List<Order> findByUserIdOrderByCreatedAtDesc(String userId);
  // Danh sách đơn của user (màn Theo dõi đơn) — sort truyền qua Pageable.
  Page<Order> findByUserId(String userId, Pageable pageable);
  Page<Order> findByUserIdAndStatusIn(String userId, Collection<String> statuses, Pageable pageable);
  // QL Sản phẩm (màn 15, F-014): sản phẩm/biến thể đã có trong đơn hay chưa —
  // khớp theo variantId HOẶC sku của snapshot OrderItem.
  @Query(
      value =
          "{ $or: [ { 'items.variantId': { $in: ?0 } }, { 'items.sku': { $in: ?1 } } ] }",
      exists = true)
  boolean existsByItemVariantIdInOrItemSkuIn(
      java.util.Collection<String> variantIds, java.util.Collection<String> skus);
  // QL Voucher (màn 19, admin-voucher.md §4.2/§9.1): mã còn nằm trong lịch sử
  // đơn (kể cả đơn đã hủy) thì không được xóa voucher; đếm lượt 1 khách đã
  // dùng 1 mã — AdminVoucherService/VoucherService truyền statuses loại trừ
  // (ĐÃ HỦY, HOÀN TRẢ) qua StatusNotIn.
  boolean existsByVoucherCode(String voucherCode);
  // QL Flash sale (màn 22, admin-flash-sale-shipping.md §4.2): chương trình đã
  // có đơn mang dòng flashSaleProgramId này thì không được xóa (chỉ được tắt).
  @Query(
      value = "{ 'items.flashSaleProgramId': ?0 }",
      exists = true)
  boolean existsByItemFlashSaleProgramId(String programId);
  long countByUserIdAndVoucherCodeAndStatusNotIn(
      String userId, String voucherCode, Collection<String> statuses);
  // Admin Dashboard (AdminStatsService): tổng hợp theo khoảng thời gian + trạng thái.
  List<Order> findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(Instant from, Instant to);
  List<Order> findTop8ByOrderByCreatedAtDesc();
  long countByStatusIn(Collection<String> statuses);
}
