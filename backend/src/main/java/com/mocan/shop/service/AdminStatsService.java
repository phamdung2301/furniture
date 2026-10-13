package com.mocan.shop.service;

import com.mocan.shop.dto.AdminOverviewDto;
import com.mocan.shop.dto.LowStockItemDto;
import com.mocan.shop.dto.OrdersByStatusDto;
import com.mocan.shop.dto.RecentOrderDto;
import com.mocan.shop.dto.RevenueByCategoryDto;
import com.mocan.shop.dto.RevenuePointDto;
import com.mocan.shop.dto.TopProductDto;
import com.mocan.shop.model.Category;
import com.mocan.shop.model.Order;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.repository.CategoryRepository;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import com.mocan.shop.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tổng hợp số liệu Admin Dashboard — FR-026 · F-020 · F-017 · US-015 · US-016.
 *
 * QUY ƯỚC DOANH THU (F-020): chỉ tính đơn HOÀN THÀNH. Với COD, đơn hoàn thành
 * đồng nghĩa tiền đã thu khi giao; với MoMo/chuyển khoản, đơn chỉ tới được
 * HOÀN THÀNH sau khi đã thanh toán — nên lọc theo trạng thái là đủ, không
 * cộng riêng payment để tránh tính trùng.
 *
 * Mọi khoảng thời gian tính theo giờ Việt Nam (Asia/Ho_Chi_Minh).
 */
@Service
@RequiredArgsConstructor
public class AdminStatsService {

  private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final String COMPLETED = "HOÀN THÀNH";
  private static final String CANCELLED = "ĐÃ HỦY";
  private static final List<String> STATUS_ORDER = List.of(
      "MỚI", "ĐÃ XÁC NHẬN", "ĐANG GIAO", "HOÀN THÀNH", "ĐÃ HỦY", "HOÀN TRẢ");
  /** Trần quét ứng viên sắp hết hàng (stock luôn nhỏ hơn nhiều ở shop nội thất). */
  private static final int LOW_STOCK_SCAN_CAP = 100;

  private final OrderRepository orderRepository;
  private final UserRepository userRepository;
  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;
  private final CategoryRepository categoryRepository;

  /** Ngưỡng tồn kho mặc định khi variant chưa đặt ngưỡng riêng (F-017). */
  @Value("${app.admin.low-stock-threshold:5}")
  private int defaultLowStockThreshold;

  /* ------------------------------ Overview (§2) ------------------------------ */

  public AdminOverviewDto overview() {
    LocalDate today = LocalDate.now(ZONE);
    Instant dayStart = startOfDay(today);
    Instant dayEnd = startOfDay(today.plusDays(1));
    Instant yesterdayStart = startOfDay(today.minusDays(1));

    Instant monthStart = startOfDay(today.withDayOfMonth(1));
    // Kỳ trước của "tháng này": từ đầu tháng trước tới cùng thời điểm này tháng trước.
    LocalDateTime nowLdt = LocalDateTime.now(ZONE);
    Instant prevMonthStart = startOfDay(today.withDayOfMonth(1).minusMonths(1));
    Instant prevMonthEnd = nowLdt.minusMonths(1).atZone(ZONE).toInstant();

    BigDecimal revenueToday = completedRevenue(dayStart, dayEnd);
    BigDecimal revenueYesterday = completedRevenue(yesterdayStart, dayStart);
    BigDecimal revenueMonth = completedRevenue(monthStart, dayEnd);
    BigDecimal revenuePrevMonth = completedRevenue(prevMonthStart, prevMonthEnd);

    long ordersToday = newOrders(dayStart, dayEnd);
    long ordersYesterday = newOrders(yesterdayStart, dayStart);
    long customersToday = newCustomers(dayStart, dayEnd);
    long customersYesterday = newCustomers(yesterdayStart, dayStart);

    AdminOverviewDto dto = new AdminOverviewDto();
    dto.setRevenueToday(revenueToday);
    dto.setRevenueTodayChangePct(changePct(revenueToday, revenueYesterday));
    dto.setRevenueMonth(revenueMonth);
    dto.setRevenueMonthChangePct(changePct(revenueMonth, revenuePrevMonth));
    dto.setNewOrdersToday(ordersToday);
    dto.setNewOrdersChangePct(changePct(ordersToday, ordersYesterday));
    dto.setPendingOrders(orderRepository.countByStatusIn(List.of("MỚI", "ĐÃ XÁC NHẬN")));
    dto.setNewCustomersToday(customersToday);
    dto.setNewCustomersChangePct(changePct(customersToday, customersYesterday));
    dto.setLowStockCount(lowStockVariants().size());
    return dto;
  }

  /* --------------------------- Chuỗi doanh thu (§3) --------------------------- */

  /**
   * range: day → 30 ngày gần nhất · week → 12 tuần gần nhất (tuần bắt đầu thứ 2)
   * · month → 12 tháng gần nhất. Kỳ cuối là kỳ hiện tại (chưa trọn).
   */
  public List<RevenuePointDto> revenueSeries(String range) {
    String r = range == null ? "day" : range.toLowerCase();
    LocalDate today = LocalDate.now(ZONE);
    List<Bucket> buckets = new ArrayList<>();
    switch (r) {
      case "week" -> {
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        for (int i = 11; i >= 0; i--) {
          LocalDate s = weekStart.minusWeeks(i);
          int weekNo = s.get(WeekFields.ISO.weekOfWeekBasedYear());
          buckets.add(new Bucket("Tuần " + weekNo, startOfDay(s), startOfDay(s.plusWeeks(1))));
        }
      }
      case "month" -> {
        LocalDate monthStart = today.withDayOfMonth(1);
        for (int i = 11; i >= 0; i--) {
          LocalDate s = monthStart.minusMonths(i);
          buckets.add(new Bucket("Tháng " + s.getMonthValue(), startOfDay(s),
              startOfDay(s.plusMonths(1))));
        }
      }
      default -> {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM");
        for (int i = 29; i >= 0; i--) {
          LocalDate s = today.minusDays(i);
          buckets.add(new Bucket(s.format(fmt), startOfDay(s), startOfDay(s.plusDays(1))));
        }
      }
    }
    if (buckets.isEmpty()) return List.of();
    Instant from = buckets.get(0).from();
    Instant to = buckets.get(buckets.size() - 1).to();
    List<Order> completed = completedOrders(from, to);
    List<RevenuePointDto> out = new ArrayList<>();
    for (Bucket b : buckets) {
      BigDecimal revenue = BigDecimal.ZERO;
      long count = 0;
      for (Order o : completed) {
        if (!o.getCreatedAt().isBefore(b.from()) && o.getCreatedAt().isBefore(b.to())) {
          revenue = revenue.add(nullSafe(o.getTotal()));
          count++;
        }
      }
      RevenuePointDto p = new RevenuePointDto();
      p.setLabel(b.label());
      p.setRevenue(revenue);
      p.setCompletedOrders(count);
      out.add(p);
    }
    return out;
  }

  /* ------------------------- Đơn theo trạng thái (§4) ------------------------- */

  /** Số đơn tạo trong tháng này, nhóm theo 6 trạng thái FR-012 (thiếu -> 0). */
  public List<OrdersByStatusDto> ordersByStatus() {
    LocalDate today = LocalDate.now(ZONE);
    List<Order> orders = orderRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(
        startOfDay(today.withDayOfMonth(1)), startOfDay(today.plusDays(1)));
    Map<String, Long> counts = new LinkedHashMap<>();
    STATUS_ORDER.forEach(s -> counts.put(s, 0L));
    for (Order o : orders) {
      if (o.getStatus() != null) counts.merge(o.getStatus(), 1L, Long::sum);
    }
    List<OrdersByStatusDto> out = new ArrayList<>();
    counts.forEach((status, count) -> {
      OrdersByStatusDto d = new OrdersByStatusDto();
      d.setStatus(status);
      d.setCount(count);
      out.add(d);
    });
    return out;
  }

  /* ----------------------- Doanh thu theo danh mục (§5) ----------------------- */

  /** Doanh thu tháng này theo danh mục = tổng tiền từng dòng món của đơn HOÀN THÀNH. */
  public List<RevenueByCategoryDto> revenueByCategory() {
    List<Order> completed = completedOrders(monthStart(), tomorrowStart());
    Map<String, ProductVariant> variants = variantsOf(completed);
    Map<String, Product> products = productsOf(variants.values().stream()
        .map(ProductVariant::getProductId).distinct().toList());
    Map<String, Category> categories = new HashMap<>();
    categoryRepository.findAll().forEach(c -> categories.put(c.getId(), c));

    Map<String, BigDecimal> revenue = new HashMap<>();
    for (Order o : completed) {
      for (Order.OrderItem item : itemsOf(o)) {
        ProductVariant v = variants.get(item.getVariantId());
        Product p = v != null ? products.get(v.getProductId()) : null;
        if (p == null || p.getCategoryId() == null) continue;
        revenue.merge(p.getCategoryId(), lineTotal(item), BigDecimal::add);
      }
    }
    List<RevenueByCategoryDto> out = new ArrayList<>();
    revenue.forEach((categoryId, rev) -> {
      RevenueByCategoryDto d = new RevenueByCategoryDto();
      d.setCategoryId(categoryId);
      Category c = categories.get(categoryId);
      d.setCategoryName(c != null ? c.getName() : "Danh mục khác");
      d.setRevenue(rev);
      out.add(d);
    });
    out.sort(Comparator.comparing(RevenueByCategoryDto::getRevenue).reversed());
    return out;
  }

  /* --------------------------- Top sản phẩm (§6) ---------------------------- */

  /** Top sản phẩm theo doanh thu trong tháng này (đơn HOÀN THÀNH). */
  public List<TopProductDto> topProducts(int limit) {
    int safeLimit = Math.min(20, Math.max(1, limit));
    List<Order> completed = completedOrders(monthStart(), tomorrowStart());
    Map<String, ProductVariant> variants = variantsOf(completed);
    Map<String, Product> products = productsOf(variants.values().stream()
        .map(ProductVariant::getProductId).distinct().toList());

    Map<String, TopProductDto> agg = new HashMap<>();
    for (Order o : completed) {
      for (Order.OrderItem item : itemsOf(o)) {
        ProductVariant v = variants.get(item.getVariantId());
        if (v == null) continue;
        Product p = products.get(v.getProductId());
        TopProductDto d = agg.computeIfAbsent(v.getProductId(), id -> {
          TopProductDto t = new TopProductDto();
          t.setProductId(id);
          t.setName(p != null ? p.getName() : item.getProductName());
          t.setImage(p != null && p.getImages() != null && !p.getImages().isEmpty()
              ? p.getImages().get(0).getUrl() : item.getImage());
          t.setSoldQty(0);
          t.setRevenue(BigDecimal.ZERO);
          return t;
        });
        d.setSoldQty(d.getSoldQty() + item.getQty());
        d.setRevenue(d.getRevenue().add(lineTotal(item)));
      }
    }
    return agg.values().stream()
        .sorted(Comparator.comparing(TopProductDto::getRevenue).reversed())
        .limit(safeLimit)
        .toList();
  }

  /* --------------------------- Đơn mới nhất (§7) ---------------------------- */

  public List<RecentOrderDto> recentOrders() {
    return orderRepository.findTop8ByOrderByCreatedAtDesc().stream().map(o -> {
      RecentOrderDto d = new RecentOrderDto();
      d.setOrderNumber(o.getOrderNumber());
      d.setCustomerName(o.getReceiver() != null ? o.getReceiver().getName() : "");
      d.setCustomerPhone(o.getReceiver() != null ? o.getReceiver().getPhone() : "");
      d.setTotal(o.getTotal());
      d.setStatus(o.getStatus());
      d.setCreatedAt(o.getCreatedAt());
      return d;
    }).toList();
  }

  /* ------------------------- Cảnh báo tồn kho (§8) -------------------------- */

  /** Variant có stock <= ngưỡng (ngưỡng riêng của variant, mặc định cấu hình). */
  public List<LowStockItemDto> lowStock(int limit) {
    int safeLimit = Math.min(50, Math.max(1, limit));
    List<ProductVariant> low = lowStockVariants();
    Map<String, Product> products = productsOf(
        low.stream().map(ProductVariant::getProductId).distinct().toList());
    return low.stream().limit(safeLimit).map(v -> {
      LowStockItemDto d = new LowStockItemDto();
      d.setVariantId(v.getId());
      Product p = products.get(v.getProductId());
      d.setProductName(p != null ? p.getName() : "");
      d.setColor(v.getColor());
      d.setSku(v.getSku());
      d.setImage(p != null && p.getImages() != null && !p.getImages().isEmpty()
          ? p.getImages().get(0).getUrl() : null);
      d.setStock(v.getStock());
      d.setLowStockThreshold(effectiveThreshold(v));
      return d;
    }).toList();
  }

  private List<ProductVariant> lowStockVariants() {
    return variantRepository.findByStockLessThanEqualOrderByStockAsc(LOW_STOCK_SCAN_CAP)
        .stream()
        .filter(v -> v.getStock() <= effectiveThreshold(v))
        .toList();
  }

  private int effectiveThreshold(ProductVariant v) {
    return v.getLowStockThreshold() > 0 ? v.getLowStockThreshold() : defaultLowStockThreshold;
  }

  /* -------------------------------- Helpers -------------------------------- */

  private record Bucket(String label, Instant from, Instant to) {}

  private Instant startOfDay(LocalDate date) {
    return date.atStartOfDay(ZONE).toInstant();
  }

  private Instant monthStart() {
    return startOfDay(LocalDate.now(ZONE).withDayOfMonth(1));
  }

  private Instant tomorrowStart() {
    return startOfDay(LocalDate.now(ZONE).plusDays(1));
  }

  private List<Order> completedOrders(Instant from, Instant to) {
    return orderRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to)
        .stream()
        .filter(o -> COMPLETED.equals(o.getStatus()))
        .toList();
  }

  private BigDecimal completedRevenue(Instant from, Instant to) {
    return completedOrders(from, to).stream()
        .map(o -> nullSafe(o.getTotal()))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  /** Đơn mới = tạo trong khoảng, trừ đơn ĐÃ HỦY (§2). */
  private long newOrders(Instant from, Instant to) {
    return orderRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to)
        .stream()
        .filter(o -> !CANCELLED.equals(o.getStatus()))
        .count();
  }

  private long newCustomers(Instant from, Instant to) {
    return userRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to)
        .stream()
        .filter(u -> u.getRoles() != null && u.getRoles().contains("ROLE_CUSTOMER"))
        .count();
  }

  /** % thay đổi so với kỳ trước, làm tròn 1 số thập phân; kỳ trước = 0 -> 0 (tránh chia 0). */
  private double changePct(BigDecimal current, BigDecimal previous) {
    if (previous == null || previous.signum() == 0) return 0;
    double pct = current.subtract(previous).doubleValue() / previous.doubleValue() * 100;
    return Math.round(pct * 10) / 10.0;
  }

  private double changePct(long current, long previous) {
    if (previous == 0) return 0;
    double pct = (double) (current - previous) / previous * 100;
    return Math.round(pct * 10) / 10.0;
  }

  private List<Order.OrderItem> itemsOf(Order o) {
    return o.getItems() != null ? o.getItems() : List.of();
  }

  private BigDecimal lineTotal(Order.OrderItem item) {
    return nullSafe(item.getPrice()).multiply(BigDecimal.valueOf(item.getQty()));
  }

  private BigDecimal nullSafe(BigDecimal v) {
    return v != null ? v : BigDecimal.ZERO;
  }

  private Map<String, ProductVariant> variantsOf(List<Order> orders) {
    List<String> ids = orders.stream()
        .flatMap(o -> itemsOf(o).stream())
        .map(Order.OrderItem::getVariantId)
        .filter(id -> id != null)
        .distinct()
        .toList();
    Map<String, ProductVariant> map = new HashMap<>();
    if (!ids.isEmpty()) {
      variantRepository.findAllById(ids).forEach(v -> map.put(v.getId(), v));
    }
    return map;
  }

  private Map<String, Product> productsOf(List<String> productIds) {
    Map<String, Product> map = new HashMap<>();
    List<String> ids = productIds.stream().filter(id -> id != null).distinct().toList();
    if (!ids.isEmpty()) {
      productRepository.findAllById(ids).forEach(p -> map.put(p.getId(), p));
    }
    return map;
  }
}
