package com.mocan.shop.service;

import com.mocan.shop.dto.AddressDto;
import com.mocan.shop.dto.AdminCustomerDetailDto;
import com.mocan.shop.dto.AdminCustomerListResponseDto;
import com.mocan.shop.dto.AdminCustomerRowDto;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Order;
import com.mocan.shop.model.User;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Quản lý khách hàng (admin) — FR-025 · F-019 (admin-khach-hang.md §7).
 * Phạm vi: CHỈ user có ROLE_CUSTOMER (tài khoản chỉ có ROLE_ADMIN không
 * xuất hiện; user mang cả 2 role vẫn hiện — §2). Admin chỉ XEM hồ sơ/địa
 * chỉ/lịch sử mua + khóa/mở khóa — không sửa hồ sơ, không xóa khách (§4.6).
 *
 * Quy ước tiền (§2.2/§2.4): orderCount đếm MỌI trạng thái; totalSpent chỉ
 * cộng `total` của đơn HOÀN THÀNH (nhất quán doanh thu F-020).
 *
 * Hai nguồn khóa (§4.3) cùng ghi status=LOCKED, phân biệt bằng lockedUntil:
 * khóa tự động F-010 có lockedUntil = hạn tự mở; khóa admin có
 * lockedUntil = null và KHÔNG bao giờ tự mở — AuthService chặn đăng nhập
 * theo đúng quy ước này (§4.4). Mọi response đều trả trạng thái HIỆU LỰC:
 * khóa tự động đã qua hạn → ACTIVE / lockSource=null (FE không tự tính).
 */
@Service
@RequiredArgsConstructor
public class AdminCustomerService {

  public static final String LOCK_SOURCE_ADMIN = "ADMIN";
  public static final String LOCK_SOURCE_AUTO = "AUTO";

  private static final String STATUS_COMPLETED = "HOÀN THÀNH";
  private static final String STATUS_CANCELLED = "ĐÃ HỦY";
  private static final String STATUS_RETURNED = "HOÀN TRẢ";
  private static final List<String> PROCESSING_STATUSES =
      List.of("MỚI", "ĐÃ XÁC NHẬN", "ĐANG GIAO");

  private final UserRepository userRepository;
  private final OrderRepository orderRepository;

  /* ------------------------- Trạng thái hiệu lực (§4.3) ------------------------- */

  /** Trạng thái hiệu lực suy từ status + lockedUntil tại thời điểm `now`. */
  public record EffectiveLock(String status, String lockSource, Instant lockedUntil) {}

  public static EffectiveLock effectiveLock(User user, Instant now) {
    if (!"LOCKED".equals(user.getStatus())) {
      return new EffectiveLock("ACTIVE", null, null);
    }
    if (user.getLockedUntil() == null) {
      // Khóa do quản trị viên — không tự hết hạn (§4.3).
      return new EffectiveLock("LOCKED", LOCK_SOURCE_ADMIN, null);
    }
    if (now.isBefore(user.getLockedUntil())) {
      // Tạm khóa tự động (sai mật khẩu 5 lần — F-010).
      return new EffectiveLock("LOCKED", LOCK_SOURCE_AUTO, user.getLockedUntil());
    }
    // Đã qua hạn tự mở nhưng dữ liệu chưa kịp cập nhật → coi như Hoạt động.
    return new EffectiveLock("ACTIVE", null, null);
  }

  /* ------------------------------ Tổng hợp đơn ------------------------------ */

  /** orderCount (mọi trạng thái) + totalSpent (chỉ HOÀN THÀNH) của 1 khách. */
  private record OrderAgg(long orderCount, BigDecimal totalSpent) {}

  private Map<String, OrderAgg> aggregateByUser() {
    return orderRepository.findAll().stream()
        .filter(o -> o.getUserId() != null)
        .collect(
            Collectors.groupingBy(
                Order::getUserId,
                Collectors.collectingAndThen(
                    Collectors.toList(),
                    orders ->
                        new OrderAgg(
                            orders.size(),
                            orders.stream()
                                .filter(o -> STATUS_COMPLETED.equals(o.getStatus()))
                                .map(o -> o.getTotal() == null ? BigDecimal.ZERO : o.getTotal())
                                .reduce(BigDecimal.ZERO, BigDecimal::add)))));
  }

  /* ------------------------------ Danh sách ------------------------------ */

  /**
   * GET /admin/customers — q khớp một phần tên/email (không phân biệt hoa
   * thường + dấu) hoặc SĐT (so khớp chuỗi số, bỏ khoảng trắng); status lọc
   * theo trạng thái HIỆU LỰC (ACTIVE | LOCKED — LOCKED gồm cả 2 nguồn khóa);
   * phoneVerified theo User.phoneVerified; sort "field,dir" với field thuộc
   * {createdAt, totalSpent} (mặc định createdAt,desc); page 0-indexed.
   */
  public AdminCustomerListResponseDto list(
      String q, String status, Boolean phoneVerified, int page, int size, String sort) {
    Instant now = Instant.now();
    String statusFilter =
        status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
    if (statusFilter != null && !statusFilter.equals("ACTIVE") && !statusFilter.equals("LOCKED")) {
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "Trạng thái lọc không hợp lệ.",
          "status");
    }
    Map<String, OrderAgg> agg = aggregateByUser();
    String needle = q == null ? "" : normalizeText(q);
    String needleDigits = q == null ? "" : q.replaceAll("\\D", "");

    List<User> filtered =
        userRepository.findAll().stream()
            .filter(AdminCustomerService::isCustomer)
            .filter(
                u ->
                    needle.isEmpty()
                        || normalizeText(u.getFullName()).contains(needle)
                        || normalizeText(u.getEmail()).contains(needle)
                        || (!needleDigits.isEmpty()
                            && u.getPhone() != null
                            && u.getPhone().replaceAll("\\D", "").contains(needleDigits)))
            .filter(
                u -> statusFilter == null || statusFilter.equals(effectiveLock(u, now).status()))
            .filter(u -> phoneVerified == null || u.isPhoneVerified() == phoneVerified)
            .sorted(comparatorFor(sort, agg))
            .toList();

    int safeSize = Math.min(50, Math.max(1, size));
    int safePage = Math.max(0, page);
    int from = Math.min(safePage * safeSize, filtered.size());
    int to = Math.min(from + safeSize, filtered.size());

    AdminCustomerListResponseDto res = new AdminCustomerListResponseDto();
    res.setItems(filtered.subList(from, to).stream().map(u -> toRow(u, agg, now)).toList());
    res.setTotal(filtered.size());
    res.setPage(safePage);
    res.setSize(safeSize);
    return res;
  }

  private Comparator<User> comparatorFor(String sort, Map<String, OrderAgg> agg) {
    String field = "createdAt";
    boolean desc = true;
    if (sort != null && !sort.isBlank()) {
      String[] parts = sort.split(",");
      if (parts.length > 0 && !parts[0].isBlank()) field = parts[0].trim();
      desc = parts.length <= 1 || !"asc".equalsIgnoreCase(parts[1].trim());
    }
    Comparator<User> cmp =
        switch (field) {
          case "totalSpent" ->
              Comparator.comparing(
                  (User u) -> agg.getOrDefault(u.getId(), new OrderAgg(0, BigDecimal.ZERO)).totalSpent());
          default ->
              Comparator.comparing(User::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
        };
    return desc ? cmp.reversed() : cmp;
  }

  /* ------------------------------ Chi tiết ------------------------------ */

  /** GET /admin/customers/{id} — hồ sơ + địa chỉ + stats + 5 đơn gần nhất (§3). */
  public AdminCustomerDetailDto get(String id) {
    Instant now = Instant.now();
    User user = findCustomer(id);
    List<Order> orders =
        orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId()); // mới nhất trước

    AdminCustomerDetailDto dto = new AdminCustomerDetailDto();
    EffectiveLock lock = effectiveLock(user, now);
    dto.setId(user.getId());
    dto.setFullName(user.getFullName());
    dto.setEmail(user.getEmail());
    dto.setPhone(user.getPhone());
    dto.setPhoneVerified(user.isPhoneVerified());
    dto.setAvatarUrl(user.getAvatarUrl());
    dto.setStatus(lock.status());
    dto.setLockSource(lock.lockSource());
    dto.setLockedUntil(lock.lockedUntil());
    // Lý do khóa chỉ còn ý nghĩa khi đang bị khóa do admin (§3.3).
    dto.setLockReason(LOCK_SOURCE_ADMIN.equals(lock.lockSource()) ? user.getLockReason() : null);
    dto.setFailedLoginAttempts(user.getFailedLoginAttempts());
    dto.setHasPassword(user.getPasswordHash() != null);
    dto.setCreatedAt(user.getCreatedAt());
    dto.setAddresses(toAddressDtos(user));
    dto.setStats(toStats(orders));
    dto.setRecentOrders(
        orders.stream()
            .limit(5)
            .map(
                o -> {
                  AdminCustomerDetailDto.RecentOrder r = new AdminCustomerDetailDto.RecentOrder();
                  r.setOrderNumber(o.getOrderNumber());
                  r.setCreatedAt(o.getCreatedAt());
                  r.setItemCount(
                      o.getItems() == null
                          ? 0
                          : o.getItems().stream().mapToInt(i -> i.getQty()).sum());
                  r.setTotal(o.getTotal());
                  r.setStatus(o.getStatus());
                  return r;
                })
            .toList());
    return dto;
  }

  private AdminCustomerDetailDto.Stats toStats(List<Order> orders) {
    AdminCustomerDetailDto.CountByStatus counts = new AdminCustomerDetailDto.CountByStatus();
    counts.setCompleted(orders.stream().filter(o -> STATUS_COMPLETED.equals(o.getStatus())).count());
    counts.setProcessing(
        orders.stream().filter(o -> PROCESSING_STATUSES.contains(o.getStatus())).count());
    counts.setCancelled(orders.stream().filter(o -> STATUS_CANCELLED.equals(o.getStatus())).count());
    counts.setReturned(orders.stream().filter(o -> STATUS_RETURNED.equals(o.getStatus())).count());

    AdminCustomerDetailDto.Stats stats = new AdminCustomerDetailDto.Stats();
    stats.setOrderCount(orders.size());
    stats.setCompletedOrderCount(counts.getCompleted());
    stats.setTotalSpent(
        orders.stream()
            .filter(o -> STATUS_COMPLETED.equals(o.getStatus()))
            .map(o -> o.getTotal() == null ? BigDecimal.ZERO : o.getTotal())
            .reduce(BigDecimal.ZERO, BigDecimal::add));
    stats.setCountByStatus(counts);
    if (!orders.isEmpty()) {
      Order last = orders.get(0); // đã sắp xếp mới nhất trước
      AdminCustomerDetailDto.LastOrder lo = new AdminCustomerDetailDto.LastOrder();
      lo.setOrderNumber(last.getOrderNumber());
      lo.setCreatedAt(last.getCreatedAt());
      lo.setStatus(last.getStatus());
      lo.setTotal(last.getTotal());
      stats.setLastOrder(lo);
    }
    return stats;
  }

  private List<AddressDto> toAddressDtos(User user) {
    if (user.getAddresses() == null) return List.of();
    return user.getAddresses().stream()
        .limit(5) // giới hạn F-011
        .map(
            a -> {
              AddressDto dto = new AddressDto();
              dto.setLabel(a.getLabel());
              dto.setReceiverName(a.getReceiverName());
              dto.setPhone(a.getPhone());
              dto.setProvince(a.getProvince());
              dto.setDistrict(a.getDistrict());
              dto.setWard(a.getWard());
              dto.setDetail(a.getDetail());
              dto.setDefault(a.isDefault());
              dto.setFullAddress(
                  List.of(a.getDetail(), a.getWard(), a.getDistrict(), a.getProvince()).stream()
                      .filter(s -> s != null && !s.isBlank())
                      .collect(Collectors.joining(", ")));
              return dto;
            })
        .toList();
  }

  /* ------------------------------ Khóa / mở khóa (§4) ------------------------------ */

  /**
   * PATCH /{id}/lock — đặt status=LOCKED + lockedUntil=null (khóa admin,
   * không tự mở — §4.3) + lưu lý do/người khóa/thời điểm (§4.2).
   * Khách đang tạm khóa tự động: cho phép khóa đè (thay thế khóa tự động).
   * 409 khi tài khoản đã đang bị khóa do admin.
   */
  public AdminCustomerRowDto lock(String id, String reason, String lockedBy) {
    Instant now = Instant.now();
    User user = findCustomer(id);
    EffectiveLock current = effectiveLock(user, now);
    if (LOCK_SOURCE_ADMIN.equals(current.lockSource())) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "ALREADY_LOCKED",
          "Tài khoản này đã bị khóa bởi quản trị viên.");
    }
    user.setStatus("LOCKED");
    user.setLockedUntil(null);
    user.setLockReason(reason == null || reason.isBlank() ? null : reason.trim());
    user.setLockedBy(lockedBy);
    user.setLockedAt(now);
    userRepository.save(user);
    return toRow(user, aggregateByUser(), now);
  }

  /**
   * PATCH /{id}/unlock — mở ngay (kể cả mở sớm khóa tự động): status=ACTIVE,
   * lockedUntil=null, failedLoginAttempts=0, xóa thông tin lý do khóa (§4.5).
   * 409 khi tài khoản đang hoạt động (trạng thái hiệu lực).
   */
  public AdminCustomerRowDto unlock(String id) {
    Instant now = Instant.now();
    User user = findCustomer(id);
    if ("ACTIVE".equals(effectiveLock(user, now).status())) {
      throw new ApiException(
          HttpStatus.CONFLICT, "NOT_LOCKED", "Tài khoản đang hoạt động, không cần mở khóa.");
    }
    user.setStatus("ACTIVE");
    user.setLockedUntil(null);
    user.setFailedLoginAttempts(0);
    user.setLockReason(null);
    user.setLockedBy(null);
    user.setLockedAt(null);
    userRepository.save(user);
    return toRow(user, aggregateByUser(), now);
  }

  /* ------------------------------ Helpers ------------------------------ */

  /** Chỉ ROLE_CUSTOMER mới thuộc phạm vi màn này (§2) — còn lại coi như 404. */
  private User findCustomer(String id) {
    User user =
        userRepository
            .findById(id)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng."));
    if (!isCustomer(user)) {
      throw new ApiException(
          HttpStatus.NOT_FOUND, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.");
    }
    return user;
  }

  private static boolean isCustomer(User user) {
    return user.getRoles() != null && user.getRoles().contains("ROLE_CUSTOMER");
  }

  private AdminCustomerRowDto toRow(User user, Map<String, OrderAgg> agg, Instant now) {
    EffectiveLock lock = effectiveLock(user, now);
    OrderAgg a = agg.getOrDefault(user.getId(), new OrderAgg(0, BigDecimal.ZERO));
    AdminCustomerRowDto dto = new AdminCustomerRowDto();
    dto.setId(user.getId());
    dto.setFullName(user.getFullName());
    dto.setEmail(user.getEmail());
    dto.setPhone(user.getPhone());
    dto.setPhoneVerified(user.isPhoneVerified());
    dto.setAvatarUrl(user.getAvatarUrl());
    dto.setStatus(lock.status());
    dto.setLockSource(lock.lockSource());
    dto.setLockedUntil(lock.lockedUntil());
    dto.setCreatedAt(user.getCreatedAt());
    dto.setOrderCount(a.orderCount());
    dto.setTotalSpent(a.totalSpent());
    return dto;
  }

  /** Bỏ dấu + hạ chữ thường để tìm kiếm không phân biệt hoa/thường và dấu (§2.1). */
  private static String normalizeText(String s) {
    if (s == null) return "";
    String noAccent =
        Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return noAccent.toLowerCase(Locale.ROOT).trim();
  }
}
