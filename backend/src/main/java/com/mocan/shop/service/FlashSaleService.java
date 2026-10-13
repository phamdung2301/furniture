package com.mocan.shop.service;

import com.mocan.shop.dto.FlashSaleCurrentResponse;
import com.mocan.shop.dto.FlashSaleProgramDto;
import com.mocan.shop.dto.ProductWithVariantsDto;
import com.mocan.shop.model.Order;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.model.Voucher;
import com.mocan.shop.repository.OrderRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import com.mocan.shop.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.BasicQuery;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Flash sale — FR-028 / F-022 / US-018, US-019 (spec flash-sale.md).
 * Chương trình = Voucher type=FLASH_SALE. Backend là NGUỒN GIÁ DUY NHẤT:
 * flashPrice tính ở đây (giá cố định hoặc % giảm có trần, làm tròn nghìn),
 * FE chỉ hiển thị — tuyệt đối không tự nhân % (§5.1).
 * Suất: trần toàn chương trình (totalUsageLimit/usedCount) + suất theo món
 * (items[].itemQuota/itemSoldCount) — cả hai tăng NGUYÊN TỬ khi tạo đơn.
 * Giới hạn 1 khách tối đa 2 suất / chương trình (F-022 [Giả định]).
 */
@Service
@RequiredArgsConstructor
public class FlashSaleService {

  public static final String STATUS_RUNNING = "RUNNING";
  public static final String STATUS_UPCOMING = "UPCOMING";
  public static final String STATUS_ENDED = "ENDED";
  public static final int MAX_SLOTS_PER_CUSTOMER = 2;

  private final VoucherRepository voucherRepository;
  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;
  private final OrderRepository orderRepository;
  private final MongoTemplate mongoTemplate;

  /** Chương trình đã resolve + trạng thái theo đồng hồ server. */
  public record ProgramView(Voucher voucher, String status) {
    public boolean running() {
      return STATUS_RUNNING.equals(status);
    }
  }

  /** Giá hiệu lực của 1 variant: programId != null = đang hưởng giá flash. */
  public record ResolvedPrice(BigDecimal price, String programId) {
    public boolean isFlash() {
      return programId != null;
    }
  }

  /** 1 dòng flash sale cần tranh suất khi chốt đơn. */
  public record ClaimLine(String programId, String productId, String variantId,
      String productName, BigDecimal originalPrice, int qty) {}

  // ------------------------------------------------------------------
  // Chọn chương trình hiện hành (§8.3): đang diễn ra -> sắp diễn ra gần nhất -> null
  // ------------------------------------------------------------------
  public Optional<ProgramView> currentProgram() {
    Instant now = Instant.now();
    List<Voucher> programs = voucherRepository.findByTypeAndActiveTrue("FLASH_SALE");
    ProgramView running = null;
    ProgramView upcoming = null;
    for (Voucher v : programs) {
      String st = statusOf(v, now);
      if (STATUS_RUNNING.equals(st)
          && (running == null || endsEarlier(v.getEndAt(), running.voucher().getEndAt()))) {
        running = new ProgramView(v, st);
      } else if (STATUS_UPCOMING.equals(st)
          && (upcoming == null || v.getStartAt().isBefore(upcoming.voucher().getStartAt()))) {
        upcoming = new ProgramView(v, st);
      }
    }
    return Optional.ofNullable(running != null ? running : upcoming);
  }

  /** Chương trình đang diễn ra (còn suất) — nguồn resolve giá cho giỏ/checkout. */
  public Optional<Voucher> runningProgram() {
    return currentProgram().filter(ProgramView::running).map(ProgramView::voucher);
  }

  /** So sánh endAt null-safe: chương trình không có endAt coi như kết thúc muộn nhất. */
  private boolean endsEarlier(Instant a, Instant b) {
    if (a == null) return false;
    if (b == null) return true;
    return a.isBefore(b);
  }

  public String statusOf(Voucher v, Instant now) {
    if (v.getStartAt() != null && now.isBefore(v.getStartAt())) return STATUS_UPCOMING;
    if (v.getEndAt() != null && !now.isBefore(v.getEndAt())) return STATUS_ENDED;
    if (v.getTotalUsageLimit() > 0 && v.getUsedCount() >= v.getTotalUsageLimit()) {
      return STATUS_ENDED; // hết suất toàn chương trình -> tự đóng (F-022)
    }
    return STATUS_RUNNING;
  }

  // ------------------------------------------------------------------
  // GET /flash-sale/current
  // ------------------------------------------------------------------
  public FlashSaleCurrentResponse current() {
    FlashSaleCurrentResponse res = new FlashSaleCurrentResponse();
    Optional<ProgramView> view = currentProgram();
    if (view.isEmpty()) {
      res.setProgram(null);
      return res;
    }
    Voucher v = view.get().voucher();
    FlashSaleProgramDto dto = new FlashSaleProgramDto();
    dto.setId(v.getId());
    dto.setStatus(view.get().status());
    dto.setStartAt(v.getStartAt());
    dto.setEndAt(v.getEndAt());
    dto.setServerNow(Instant.now());
    dto.setTotalUsageLimit(v.getTotalUsageLimit());
    dto.setUsedCount(v.getUsedCount());
    List<FlashSaleProgramDto.ItemDto> items = new ArrayList<>();
    for (Voucher.FlashSaleItem item : effectiveItems(v)) {
      FlashSaleProgramDto.ItemDto d = buildItemDto(v, item);
      if (d != null) items.add(d);
    }
    dto.setItems(items);
    res.setProgram(dto);
    return res;
  }

  private FlashSaleProgramDto.ItemDto buildItemDto(Voucher program, Voucher.FlashSaleItem item) {
    Product product = productRepository.findById(item.getProductId()).orElse(null);
    if (product == null || !product.isActive()) return null;
    List<ProductVariant> variants = variantRepository.findByProductId(product.getId());
    List<ProductVariant> programVariants = variants.stream()
        .filter(pv -> item.getVariantId() == null || item.getVariantId().equals(pv.getId()))
        .toList();
    if (programVariants.isEmpty()) return null;

    // Variant mặc định F-004 trong các màu thuộc chương trình: còn hàng rẻ nhất.
    ProductVariant def = programVariants.stream()
        .filter(pv -> pv.getStock() > 0)
        .min(Comparator.comparing(ProductVariant::getPrice))
        .orElseGet(() -> programVariants.stream()
            .min(Comparator.comparing(ProductVariant::getPrice)).orElse(programVariants.get(0)));

    FlashSaleProgramDto.ItemDto d = new FlashSaleProgramDto.ItemDto();
    d.setProductId(product.getId());
    d.setSlug(product.getSlug());
    d.setName(product.getName());
    d.setImage(product.getImages() != null && !product.getImages().isEmpty()
        ? product.getImages().get(0).getUrl() : null);
    d.setRatingAvg(product.getRatingAvg());
    d.setRatingCount(product.getRatingCount());
    d.setColors(variants.stream().map(pv -> {
      FlashSaleProgramDto.ColorDto c = new FlashSaleProgramDto.ColorDto();
      c.setVariantId(pv.getId());
      c.setColor(pv.getColor());
      c.setColorHex(pv.getColorHex());
      c.setStock(pv.getStock());
      return c;
    }).toList());
    d.setFlashVariantIds(programVariants.stream().map(ProductVariant::getId).toList());
    d.setVariantId(def.getId());
    d.setOriginalPrice(def.getPrice());
    d.setFlashPrice(computeFlashPrice(item, def.getPrice()));
    d.setDiscountPercent(discountPercentOf(item, def.getPrice(), d.getFlashPrice()));
    long distinctPrices = programVariants.stream()
        .map(pv -> computeFlashPrice(item, pv.getPrice()))
        .distinct()
        .count();
    d.setHasMultipleFlashPrices(distinctPrices > 1);
    d.setItemQuota(item.getItemQuota());
    d.setItemSoldCount(item.getItemSoldCount());
    boolean itemSoldOut = isItemSoldOut(item);
    boolean stockOut = programVariants.stream().allMatch(pv -> pv.getStock() <= 0);
    d.setItemSoldOut(itemSoldOut);
    d.setStockOut(stockOut);
    d.setSoldOut(itemSoldOut || stockOut);
    return d;
  }

  // ------------------------------------------------------------------
  // Gắn field flashSale vào variant khi serialize (§5.1, §5.3)
  // ------------------------------------------------------------------
  public void attachToVariants(List<ProductVariant> variants) {
    if (variants == null || variants.isEmpty()) return;
    Optional<ProgramView> current = currentProgram();
    if (current.isEmpty()) return;
    ProgramView view = current.get();
    Optional<ProgramView> upcoming = view.running()
        ? nextUpcomingAfter(view.voucher())
        : Optional.empty();
    for (ProductVariant variant : variants) {
      variant.setFlashSale(infoFor(variant, view, upcoming.orElse(null)));
    }
  }

  public void attachToProductDtos(List<ProductWithVariantsDto> dtos) {
    if (dtos == null) return;
    for (ProductWithVariantsDto dto : dtos) {
      attachToVariants(dto.getVariants());
    }
  }

  private Optional<ProgramView> nextUpcomingAfter(Voucher current) {
    Instant now = Instant.now();
    return voucherRepository.findByTypeAndActiveTrue("FLASH_SALE").stream()
        .filter(v -> !v.getId().equals(current.getId()))
        .filter(v -> STATUS_UPCOMING.equals(statusOf(v, now)))
        .min(Comparator.comparing(Voucher::getStartAt))
        .map(v -> new ProgramView(v, STATUS_UPCOMING));
  }

  private ProductVariant.FlashSaleInfo infoFor(ProductVariant variant,
      ProgramView view, ProgramView upcomingView) {
    Voucher.FlashSaleItem item = findItem(view.voucher(), variant.getProductId(), variant.getId());
    if (item != null) {
      return buildInfo(view, item, variant, !view.running());
    }
    if (upcomingView != null) {
      Voucher.FlashSaleItem up = findItem(upcomingView.voucher(),
          variant.getProductId(), variant.getId());
      if (up != null) return buildInfo(upcomingView, up, variant, true);
    }
    return null;
  }

  private ProductVariant.FlashSaleInfo buildInfo(ProgramView view,
      Voucher.FlashSaleItem item, ProductVariant variant, boolean upcoming) {
    ProductVariant.FlashSaleInfo info = new ProductVariant.FlashSaleInfo();
    info.setProgramId(view.voucher().getId());
    info.setFlashPrice(computeFlashPrice(item, variant.getPrice()));
    info.setDiscountPercent(discountPercentOf(item, variant.getPrice(), info.getFlashPrice()));
    info.setStartAt(view.voucher().getStartAt());
    info.setEndAt(view.voucher().getEndAt());
    info.setUpcoming(upcoming);
    info.setItemSoldOut(isItemSoldOut(item) || isProgramSoldOut(view.voucher()));
    info.setItemQuota(item.getItemQuota());
    info.setItemSoldCount(item.getItemSoldCount());
    return info;
  }

  // ------------------------------------------------------------------
  // Resolve giá cho giỏ + checkout (§5.2, §5.4)
  // ------------------------------------------------------------------
  public ResolvedPrice resolvePrice(ProductVariant variant) {
    Optional<Voucher> running = runningProgram();
    if (running.isEmpty()) return new ResolvedPrice(variant.getPrice(), null);
    Voucher program = running.get();
    Voucher.FlashSaleItem item = findItem(program, variant.getProductId(), variant.getId());
    if (item == null || isItemSoldOut(item) || isProgramSoldOut(program)) {
      return new ResolvedPrice(variant.getPrice(), null);
    }
    return new ResolvedPrice(computeFlashPrice(item, variant.getPrice()), program.getId());
  }

  /** Tổng số suất flash sale user đã mua trong chương trình (đơn chưa hủy) — giới hạn F-022. */
  public int countUserProgramQty(String userId, String programId) {
    int sum = 0;
    for (Order order : orderRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
      if ("ĐÃ HỦY".equals(order.getStatus()) || order.getItems() == null) continue;
      for (Order.OrderItem oi : order.getItems()) {
        if (programId.equals(oi.getFlashSaleProgramId())) sum += oi.getQty();
      }
    }
    return sum;
  }

  // ------------------------------------------------------------------
  // Tranh suất nguyên tử khi tạo đơn (§5.4) + hoàn suất khi hủy đơn
  // ------------------------------------------------------------------
  /**
   * Tăng usedCount (toàn chương trình) + itemSoldCount (theo món) NGUYÊN TỬ.
   * Trả về ClaimLine bị từ chối đầu tiên (hết suất) hoặc null nếu claim hết thành công.
   * Điều kiện nằm trong query ($elemMatch cùng khóa productId+variantId với
   * arrayFilter của update) nên món được tăng đúng món đã thỏa điều kiện còn suất.
   */
  public ClaimLine claim(List<ClaimLine> lines) {
    List<ClaimLine> claimed = new ArrayList<>();
    for (ClaimLine line : lines) {
      if (!claimOne(line)) {
        // Rollback các dòng đã claim trong lần này để không rò suất.
        for (ClaimLine done : claimed) releaseOne(done.programId(), done.productId(),
            done.variantId(), done.qty());
        return line;
      }
      claimed.add(line);
    }
    return null;
  }

  /** Hoàn lại các dòng đã claim (dùng khi tạo đơn thất bại giữa chừng sau khi claim). */
  public void releaseClaims(List<ClaimLine> lines) {
    if (lines == null) return;
    for (ClaimLine line : lines) {
      releaseOne(line.programId(), line.productId(), line.variantId(), line.qty());
    }
  }

  private boolean claimOne(ClaimLine line) {
    Voucher fresh = voucherRepository.findById(line.programId()).orElse(null);
    if (fresh == null || !STATUS_RUNNING.equals(statusOf(fresh, Instant.now()))) return false;
    Voucher.FlashSaleItem item = findItem(fresh, line.productId(), line.variantId());
    if (item == null) return false;

    // 1) Trần toàn chương trình: inc usedCount có điều kiện usedCount + qty <= limit.
    int limit = fresh.getTotalUsageLimit();
    Criteria progCriteria = Criteria.where("_id").is(fresh.getId());
    if (limit > 0) progCriteria = progCriteria.and("usedCount").lte(limit - line.qty());
    Voucher bumped = mongoTemplate.findAndModify(
        Query.query(progCriteria),
        new Update().inc("usedCount", line.qty()),
        FindAndModifyOptions.options().returnNew(true), Voucher.class);
    if (bumped == null) return false;

    // 2) Suất theo món (nếu có quota): elemMatch khóa đúng món + itemSoldCount < quota.
    if (item.getItemQuota() != null) {
      Document elem = new Document("productId", line.productId());
      if (item.getVariantId() != null) elem.append("variantId", item.getVariantId());
      elem.append("itemSoldCount", new Document("$lt", item.getItemQuota()));
      Query q = new BasicQuery(new Document("_id", fresh.getId())
          .append("items", new Document("$elemMatch", elem)), new Document());
      Update u = new Update().inc("items.$[i].itemSoldCount", line.qty());
      if (item.getVariantId() != null) {
        u = u.filterArray(Criteria.where("i.productId").is(line.productId())
            .and("i.variantId").is(item.getVariantId()));
      } else {
        u = u.filterArray(Criteria.where("i.productId").is(line.productId()));
      }
      com.mongodb.client.result.UpdateResult r = mongoTemplate.updateFirst(q, u, Voucher.class);
      if (r.getModifiedCount() == 0) {
        // Hết suất món giữa chừng -> hoàn lại suất chương trình vừa tăng.
        decProgram(fresh.getId(), line.qty());
        return false;
      }
    }
    return true;
  }

  /** Hoàn suất của 1 đơn đã hủy (F-009 + F-022): giảm usedCount + itemSoldCount, chặn dưới 0. */
  public void release(Order order) {
    if (order == null || order.getItems() == null) return;
    for (Order.OrderItem oi : order.getItems()) {
      if (oi.getFlashSaleProgramId() == null || oi.getQty() <= 0) continue;
      ProductVariant variant = oi.getVariantId() != null
          ? variantRepository.findById(oi.getVariantId()).orElse(null) : null;
      String productId = variant != null ? variant.getProductId() : null;
      releaseOne(oi.getFlashSaleProgramId(), productId, oi.getVariantId(), oi.getQty());
    }
  }

  private void releaseOne(String programId, String productId, String variantId, int qty) {
    if (programId == null || qty <= 0) return;
    decProgram(programId, qty);
    if (productId == null) return;
    Voucher fresh = voucherRepository.findById(programId).orElse(null);
    if (fresh == null) return;
    Voucher.FlashSaleItem item = findItem(fresh, productId, variantId);
    if (item == null || item.getItemSoldCount() < qty) return;
    Document elem = new Document("productId", productId);
    if (item.getVariantId() != null) elem.append("variantId", item.getVariantId());
    Query q = new BasicQuery(new Document("_id", programId)
        .append("items", new Document("$elemMatch", elem)), new Document());
    Update u = new Update().inc("items.$[i].itemSoldCount", -qty);
    if (item.getVariantId() != null) {
      u = u.filterArray(Criteria.where("i.productId").is(productId)
          .and("i.variantId").is(item.getVariantId()));
    } else {
      u = u.filterArray(Criteria.where("i.productId").is(productId));
    }
    mongoTemplate.updateFirst(q, u, Voucher.class);
  }

  private void decProgram(String programId, int qty) {
    Query q = Query.query(Criteria.where("_id").is(programId).and("usedCount").gte(qty));
    mongoTemplate.updateFirst(q, new Update().inc("usedCount", -qty), Voucher.class);
  }

  // ------------------------------------------------------------------
  // Helpers cấu hình chương trình
  // ------------------------------------------------------------------
  /**
   * Item hiệu lực của chương trình: ưu tiên cấu trúc items[] (mở rộng ERD);
   * fallback applicableProductIds + value (% cho mọi màu) khi admin chưa cấu hình items.
   */
  public List<Voucher.FlashSaleItem> effectiveItems(Voucher program) {
    if (program.getItems() != null && !program.getItems().isEmpty()) {
      return program.getItems();
    }
    List<Voucher.FlashSaleItem> out = new ArrayList<>();
    if (program.getApplicableProductIds() != null) {
      for (String pid : program.getApplicableProductIds()) {
        Voucher.FlashSaleItem it = new Voucher.FlashSaleItem();
        it.setProductId(pid);
        it.setDiscountPercent(program.getValue());
        it.setMaxDiscount(program.getMaxDiscount());
        out.add(it);
      }
    }
    return out;
  }

  public Voucher.FlashSaleItem findItem(Voucher program, String productId, String variantId) {
    if (program == null || productId == null) return null;
    for (Voucher.FlashSaleItem item : effectiveItems(program)) {
      if (!productId.equals(item.getProductId())) continue;
      if (item.getVariantId() == null || item.getVariantId().equals(variantId)) return item;
    }
    return null;
  }

  public boolean isItemSoldOut(Voucher.FlashSaleItem item) {
    return item.getItemQuota() != null && item.getItemSoldCount() >= item.getItemQuota();
  }

  public boolean isProgramSoldOut(Voucher program) {
    return program.getTotalUsageLimit() > 0
        && program.getUsedCount() >= program.getTotalUsageLimit();
  }

  /**
   * Giá flash cuối cùng: giá cố định nếu cấu hình flashPrice; ngược lại % giảm
   * (trần maxDiscount) — kết quả làm tròn NGHÌN theo thông lệ giá VN
   * (spec §9: 650.000đ -25% = 487.500đ -> backend chốt 488.000đ).
   */
  public BigDecimal computeFlashPrice(Voucher.FlashSaleItem item, BigDecimal originalPrice) {
    if (originalPrice == null) return null;
    if (item.getFlashPrice() != null) return item.getFlashPrice();
    BigDecimal pct = item.getDiscountPercent();
    if (pct == null) return originalPrice;
    BigDecimal discount = originalPrice.multiply(pct)
        .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    if (item.getMaxDiscount() != null && discount.compareTo(item.getMaxDiscount()) > 0) {
      discount = item.getMaxDiscount();
    }
    BigDecimal raw = originalPrice.subtract(discount);
    if (raw.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;
    return raw.divide(BigDecimal.valueOf(1000), 0, RoundingMode.HALF_UP)
        .multiply(BigDecimal.valueOf(1000));
  }

  /** % hiển thị badge: cấu hình % -> dùng thẳng; giá cố định -> suy từ 2 mức giá (làm tròn). */
  public int discountPercentOf(Voucher.FlashSaleItem item, BigDecimal originalPrice,
      BigDecimal flashPrice) {
    if (item.getDiscountPercent() != null) {
      return item.getDiscountPercent().intValue();
    }
    if (originalPrice == null || flashPrice == null
        || originalPrice.compareTo(BigDecimal.ZERO) <= 0
        || flashPrice.compareTo(originalPrice) >= 0) {
      return 0;
    }
    return originalPrice.subtract(flashPrice)
        .multiply(BigDecimal.valueOf(100))
        .divide(originalPrice, 0, RoundingMode.HALF_UP)
        .intValue();
  }
}
