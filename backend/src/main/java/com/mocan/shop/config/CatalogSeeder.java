package com.mocan.shop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.mocan.shop.model.Banner;
import com.mocan.shop.model.Category;
import com.mocan.shop.model.Product;
import com.mocan.shop.model.ProductVariant;
import com.mocan.shop.model.ShippingConfig;
import com.mocan.shop.model.ShippingRule;
import com.mocan.shop.model.Voucher;
import com.mocan.shop.repository.BannerRepository;
import com.mocan.shop.repository.CategoryRepository;
import com.mocan.shop.repository.ProductRepository;
import com.mocan.shop.repository.ProductVariantRepository;
import com.mocan.shop.repository.ShippingConfigRepository;
import com.mocan.shop.repository.ShippingRuleRepository;
import com.mocan.shop.repository.VoucherRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Nạp dữ liệu mẫu (catalog) vào MongoDB trong lần chạy đầu tiên — để backend
 * thật (VITE_USE_MOCK=false) có ngay dữ liệu như bản mock frontend.
 *
 * Nguồn: classpath seed/catalog.json, trích xuất từ mock frontend
 * (frontend/src/mocks/homeMock.js — categories/products/banners,
 * api/voucherApi.js — NOITHAT50/NOITHAT10, mocks/flashSaleMock.js — chương
 * trình flash sale mẫu) + bảng phí ship docs/02-ERD.md §4.
 *
 * IDEMPOTENT theo TỪNG collection: collection nào đã có dữ liệu thì BỎ QUA
 * toàn bộ phần đó (không ghi đè, không xóa) — dữ liệu admin đã sửa qua các
 * màn quản trị luôn an toàn khi restart app. Hệ quả: muốn nạp lại từ đầu
 * thì xóa collection tương ứng trong Mongo rồi khởi động lại.
 *
 * Thứ tự nạp: categories -> products + variants -> banners -> vouchers
 * (kèm chương trình flash sale) -> shipping rules + shipping config.
 * Quan hệ được resolve bằng slug/SKU tại thời điểm nạp (JSON seed dùng
 * categorySlug / productSlug / variantSku, KHÔNG dùng id của mock):
 * product.categoryId trỏ category thật trong DB, variant.productId trỏ
 * product thật trong DB — kể cả khi các collection đó có từ trước.
 *
 * Chương trình flash sale mẫu: ngày giờ tính TƯƠNG ĐỐI lúc chạy theo giờ
 * Asia/Ho_Chi_Minh (bắt đầu hôm qua 20:00, chạy 2 ngày, kết thúc 22:00 —
 * khớp programDates() của flashSaleMock) nên trang /flash-sale chạy thật
 * ngay sau khi seed, không bị hết hạn như ngày tĩnh.
 *
 * Runner này độc lập với AdminBootstrap (collection users) — AdminBootstrap
 * không khai @Order nên không đặt @Order ở đây; thứ tự giữa hai runner
 * không ảnh hưởng kết quả. Lỗi ở bất kỳ section nào chỉ log ERROR, không
 * làm app khởi động thất bại.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CatalogSeeder implements CommandLineRunner {

  private static final String SEED_PATH = "seed/catalog.json";
  private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

  private final ObjectMapper objectMapper = new ObjectMapper()
          .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  private final CategoryRepository categoryRepository;
  private final ProductRepository productRepository;
  private final ProductVariantRepository variantRepository;
  private final BannerRepository bannerRepository;
  private final VoucherRepository voucherRepository;
  private final ShippingRuleRepository shippingRuleRepository;
  private final ShippingConfigRepository shippingConfigRepository;

  @Override
  public void run(String... args) {
    CatalogSeed seed;
    try (InputStream in = new ClassPathResource(SEED_PATH).getInputStream()) {
      seed = objectMapper.readValue(in, CatalogSeed.class);
    } catch (Exception e) {
      log.error("CatalogSeeder: khong doc duoc {} -> bo qua nap du lieu mau. Loi: {}",
          SEED_PATH, e.getMessage());
      return;
    }
    seedCategories(seed);
    seedProducts(seed);
    seedBanners(seed);
    seedVouchers(seed);
    seedShipping(seed);
  }

  // ------------------------------------------------------------------
  // Categories
  // ------------------------------------------------------------------
  private void seedCategories(CatalogSeed seed) {
    try {
      if (categoryRepository.count() > 0) {
        log.info("CatalogSeeder: categories da co du lieu -> bo qua.");
        return;
      }
      // Hai lượt: danh mục gốc trước (parentSlug = null), danh mục con sau.
      Map<String, String> idBySlug = new HashMap<>();
      List<CategorySeed> pending = new ArrayList<>(seed.getCategories());
      for (int pass = 0; pass < 2 && !pending.isEmpty(); pass++) {
        List<CategorySeed> next = new ArrayList<>();
        for (CategorySeed cs : pending) {
          String parentId = null;
          if (cs.getParentSlug() != null) {
            parentId = idBySlug.get(cs.getParentSlug());
            if (parentId == null) {
              next.add(cs); // cha chưa nạp (hoặc không tồn tại) -> thử lượt sau
              continue;
            }
          }
          Category c = new Category();
          c.setName(cs.getName());
          c.setSlug(cs.getSlug());
          c.setParentId(parentId);
          c.setImageUrl(cs.getImageUrl());
          c.setSortOrder(cs.getSortOrder());
          c.setActive(cs.isActive());
          c.setCreatedAt(Instant.now()); // mock không có createdAt -> lấy lúc nạp
          idBySlug.put(cs.getSlug(), categoryRepository.save(c).getId());
        }
        pending = next;
      }
      for (CategorySeed cs : pending) {
        log.warn("CatalogSeeder: bo qua danh muc {} — khong tim thay danh muc cha {}.",
            cs.getSlug(), cs.getParentSlug());
      }
      log.info("CatalogSeeder: da nap {} danh muc.", idBySlug.size());
    } catch (Exception e) {
      log.error("CatalogSeeder: loi khi nap categories: {}", e.getMessage());
    }
  }

  // ------------------------------------------------------------------
  // Products + variants (collection riêng product_variants, liên kết productId)
  // ------------------------------------------------------------------
  private void seedProducts(CatalogSeed seed) {
    try {
      if (productRepository.count() > 0) {
        log.info("CatalogSeeder: products da co du lieu -> bo qua (ke ca variants).");
        return;
      }
      int productCount = 0;
      int variantCount = 0;
      for (ProductSeed ps : seed.getProducts()) {
        Category category = ps.getCategorySlug() == null ? null
            : categoryRepository.findBySlug(ps.getCategorySlug()).orElse(null);
        if (category == null) {
          log.warn("CatalogSeeder: bo qua san pham {} — khong tim thay danh muc {}.",
              ps.getSlug(), ps.getCategorySlug());
          continue;
        }
        Product p = new Product();
        p.setName(ps.getName());
        p.setSlug(ps.getSlug());
        p.setCategoryId(category.getId());
        p.setDescription(ps.getDescription());
        p.setSpecs(ps.getSpecs());
        p.setBasePrice(ps.getBasePrice());
        p.setBadge(ps.getBadge());
        p.setImages(ps.getImages());
        p.setRatingAvg(ps.getRatingAvg());
        p.setRatingCount(ps.getRatingCount());
        p.setSoldCount(ps.getSoldCount());
        p.setFeatured(ps.isFeatured());
        p.setActive(ps.isActive());
        p.setCreatedAt(parseInstant(ps.getCreatedAt()));
        Product saved = productRepository.save(p);
        productCount++;
        for (VariantSeed vs : ps.getVariants()) {
          ProductVariant v = new ProductVariant();
          v.setProductId(saved.getId());
          v.setSku(vs.getSku());
          v.setColor(vs.getColor());
          v.setColorHex(vs.getColorHex());
          v.setPrice(vs.getPrice());
          v.setStock(vs.getStock());
          v.setLowStockThreshold(vs.getLowStockThreshold());
          v.setLengthM(vs.getLengthM());
          v.setWidthM(vs.getWidthM());
          v.setSizeLabel(vs.getSizeLabel());
          v.setMaterialNote(vs.getMaterialNote());
          variantRepository.save(v);
          variantCount++;
        }
      }
      log.info("CatalogSeeder: da nap {} san pham, {} bien the mau.", productCount, variantCount);
    } catch (Exception e) {
      log.error("CatalogSeeder: loi khi nap products: {}", e.getMessage());
    }
  }

  // ------------------------------------------------------------------
  // Banners
  // ------------------------------------------------------------------
  private void seedBanners(CatalogSeed seed) {
    try {
      if (bannerRepository.count() > 0) {
        log.info("CatalogSeeder: banners da co du lieu -> bo qua.");
        return;
      }
      int n = 0;
      for (Banner b : seed.getBanners()) {
        b.setId(null);
        bannerRepository.save(b);
        n++;
      }
      log.info("CatalogSeeder: da nap {} banner.", n);
    } catch (Exception e) {
      log.error("CatalogSeeder: loi khi nap banners: {}", e.getMessage());
    }
  }

  // ------------------------------------------------------------------
  // Vouchers + chương trình flash sale mẫu (cùng collection vouchers)
  // ------------------------------------------------------------------
  private void seedVouchers(CatalogSeed seed) {
    try {
      if (voucherRepository.count() > 0) {
        log.info("CatalogSeeder: vouchers da co du lieu -> bo qua (ke ca flash sale mau).");
        return;
      }
      int n = 0;
      for (VoucherSeed vs : seed.getVouchers()) {
        Voucher v = new Voucher();
        v.setCode(vs.getCode());
        v.setType(vs.getType());
        v.setValue(vs.getValue());
        v.setMaxDiscount(vs.getMaxDiscount());
        v.setMinOrderValue(vs.getMinOrderValue());
        v.setApplicableCategories(List.of());
        v.setApplicableProductIds(List.of());
        v.setStartAt(parseInstant(vs.getStartAt()));
        v.setEndAt(parseInstant(vs.getEndAt()));
        v.setTotalUsageLimit(vs.getTotalUsageLimit());
        v.setPerUserLimit(vs.getPerUserLimit());
        v.setUsedCount(vs.getUsedCount());
        v.setActive(vs.isActive());
        voucherRepository.save(v);
        n++;
      }
      log.info("CatalogSeeder: da nap {} voucher.", n);
      seedFlashSaleProgram(seed.getFlashSaleProgram());
    } catch (Exception e) {
      log.error("CatalogSeeder: loi khi nap vouchers: {}", e.getMessage());
    }
  }

  /**
   * Chương trình flash sale = Voucher type=FLASH_SALE + items[] (FlashSaleService).
   * items trong JSON tham chiếu productSlug + variantSku -> resolve sang id DB
   * tại đây. Món nào không resolve được thì bỏ qua món đó (log WARN); không
   * resolve được món nào thì không tạo chương trình.
   */
  private void seedFlashSaleProgram(FlashSaleSeed fs) {
    if (fs == null) return;
    try {
      List<Voucher.FlashSaleItem> items = new ArrayList<>();
      for (FlashItemSeed is : fs.getItems()) {
        Product product = productRepository.findAll().stream()
            .filter(p -> is.getProductSlug().equals(p.getSlug()))
            .findFirst().orElse(null);
        if (product == null) {
          log.warn("CatalogSeeder: flash sale — khong tim thay san pham slug {} -> bo qua mon.",
              is.getProductSlug());
          continue;
        }
        ProductVariant variant = variantRepository.findByProductId(product.getId()).stream()
            .filter(v -> is.getVariantSku().equals(v.getSku()))
            .findFirst().orElse(null);
        if (variant == null) {
          log.warn("CatalogSeeder: flash sale — khong tim thay variant SKU {} cua {} -> bo qua mon.",
              is.getVariantSku(), is.getProductSlug());
          continue;
        }
        Voucher.FlashSaleItem item = new Voucher.FlashSaleItem();
        item.setProductId(product.getId());
        item.setVariantId(variant.getId());
        item.setFlashPrice(is.getFlashPrice());
        item.setDiscountPercent(is.getDiscountPercent());
        item.setItemQuota(is.getItemQuota());
        item.setItemSoldCount(is.getItemSoldCount());
        items.add(item);
      }
      if (items.isEmpty()) {
        log.warn("CatalogSeeder: flash sale mau — khong mon nao resolve duoc -> khong tao chuong trinh.");
        return;
      }
      FlashSchedule sch = fs.getSchedule();
      LocalDate startDate = LocalDate.now(SHOP_ZONE).plusDays(sch.getStartDaysOffset());
      LocalDate endDate = startDate.plusDays(sch.getDurationDays());
      Instant startAt = ZonedDateTime.of(startDate, LocalTime.of(sch.getStartHour(), 0), SHOP_ZONE).toInstant();
      Instant endAt = ZonedDateTime.of(endDate, LocalTime.of(sch.getEndHour(), 0), SHOP_ZONE).toInstant();

      Voucher program = new Voucher();
      program.setCode(fs.getCode());
      program.setName(fs.getName());
      program.setType("FLASH_SALE");
      program.setMinOrderValue(BigDecimal.ZERO);
      program.setApplicableCategories(List.of());
      program.setApplicableProductIds(List.of());
      program.setStartAt(startAt);
      program.setEndAt(endAt);
      program.setTotalUsageLimit(fs.getTotalUsageLimit());
      program.setUsedCount(fs.getUsedCount());
      program.setActive(fs.isActive());
      program.setItems(items);
      voucherRepository.save(program);
      log.info("CatalogSeeder: da nap chuong trinh flash sale mau '{}' ({} mon, {} -> {}).",
          fs.getCode(), items.size(), startAt, endAt);
    } catch (Exception e) {
      log.error("CatalogSeeder: loi khi nap flash sale mau: {}", e.getMessage());
    }
  }

  // ------------------------------------------------------------------
  // Shipping rules + shipping config
  // ------------------------------------------------------------------
  private void seedShipping(CatalogSeed seed) {
    try {
      if (shippingRuleRepository.count() > 0) {
        log.info("CatalogSeeder: shipping_rules da co du lieu -> bo qua.");
      } else {
        int n = 0;
        for (ShippingRule r : seed.getShippingRules()) {
          r.setId(null);
          shippingRuleRepository.save(r);
          n++;
        }
        log.info("CatalogSeeder: da nap {} bac phi ship.", n);
      }
    } catch (Exception e) {
      log.error("CatalogSeeder: loi khi nap shipping rules: {}", e.getMessage());
    }
    try {
      if (shippingConfigRepository.count() > 0) {
        log.info("CatalogSeeder: shipping_configs da co du lieu -> bo qua.");
      } else if (seed.getShippingConfig() != null) {
        ShippingConfig cfg = seed.getShippingConfig();
        cfg.setId(null);
        if (cfg.getKey() == null) cfg.setKey(ShippingConfig.KEY_SHIPPING);
        shippingConfigRepository.save(cfg);
        log.info("CatalogSeeder: da nap shipping config (freeThreshold = {}).", cfg.getFreeThreshold());
      }
    } catch (Exception e) {
      log.error("CatalogSeeder: loi khi nap shipping config: {}", e.getMessage());
    }
  }

  /** Parse ISO-8601: chấp nhận cả dạng 'Z' (Instant) lẫn có offset (+07:00). */
  private Instant parseInstant(String s) {
    if (s == null || s.isBlank()) return null;
    try {
      return Instant.parse(s);
    } catch (Exception e) {
      return OffsetDateTime.parse(s).toInstant();
    }
  }

  // ------------------------------------------------------------------
  // DTO đọc seed/catalog.json (chỉ dùng nội bộ seeder).
  // Banner / ShippingRule / ShippingConfig dùng thẳng class model vì field
  // trong JSON khớp 1-1 với model; id luôn null trong JSON (DB tự sinh).
  // ------------------------------------------------------------------
  @Data
  public static class CatalogSeed {
    private List<CategorySeed> categories = List.of();
    private List<ProductSeed> products = List.of();
    private List<Banner> banners = List.of();
    private List<VoucherSeed> vouchers = List.of();
    private FlashSaleSeed flashSaleProgram;
    private List<ShippingRule> shippingRules = List.of();
    private ShippingConfig shippingConfig;
  }

  @Data
  public static class CategorySeed {
    private String name;
    private String slug;
    private String parentSlug;
    private String imageUrl;
    private int sortOrder;
    private boolean active;
  }

  @Data
  public static class ProductSeed {
    private String name;
    private String slug;
    private String categorySlug;
    private String description;
    private Map<String, String> specs;
    private BigDecimal basePrice;
    private Product.Badge badge;
    private List<Product.ProductImage> images;
    private BigDecimal ratingAvg;
    private int ratingCount;
    private int soldCount;
    private boolean featured;
    private boolean active;
    private String createdAt;
    private List<VariantSeed> variants = List.of();
  }

  @Data
  public static class VariantSeed {
    private String sku;
    private String color;
    private String colorHex;
    private BigDecimal price;
    private int stock;
    private int lowStockThreshold;
    private BigDecimal lengthM;
    private BigDecimal widthM;
    private String sizeLabel;
    private String materialNote;
  }

  @Data
  public static class VoucherSeed {
    private String code;
    private String type;
    private BigDecimal value;
    private BigDecimal maxDiscount;
    private BigDecimal minOrderValue;
    private String startAt;
    private String endAt;
    private int totalUsageLimit;
    private Integer perUserLimit;
    private int usedCount;
    private boolean active;
  }

  @Data
  public static class FlashSaleSeed {
    private String code;
    private String name;
    private int totalUsageLimit;
    private int usedCount;
    private boolean active;
    private FlashSchedule schedule;
    private List<FlashItemSeed> items = List.of();
  }

  @Data
  public static class FlashSchedule {
    private int startDaysOffset;
    private int startHour;
    private int durationDays;
    private int endHour;
  }

  @Data
  public static class FlashItemSeed {
    private String productSlug;
    private String variantSku;
    private BigDecimal flashPrice;
    private BigDecimal discountPercent;
    private Integer itemQuota;
    private int itemSoldCount;
  }
}
