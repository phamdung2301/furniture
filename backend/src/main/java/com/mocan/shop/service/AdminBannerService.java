package com.mocan.shop.service;

import com.mocan.shop.dto.AdminBannerDto;
import com.mocan.shop.dto.AdminBannerPatchRequest;
import com.mocan.shop.dto.AdminBannerReorderItemDto;
import com.mocan.shop.dto.AdminBannerReorderRequest;
import com.mocan.shop.dto.AdminBannerRequest;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Banner;
import com.mocan.shop.repository.BannerRepository;
import com.mocan.shop.service.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Quản lý banner (admin) — FR-027 · F-021 (admin-banner.md §8).
 * Banner chỉ có 8 trường theo ERD/model (id, imageUrl, linkUrl, title,
 * subtitle, ctaText, sortOrder, active) — KHÔNG có startAt/endAt nên không
 * có trạng thái "theo lịch". sortOrder là thứ tự của TOÀN BỘ danh sách
 * (banner đã tắt vẫn giữ vị trí); phía khách GET /banners chỉ lọc active.
 * Mọi thao tác đổi thứ tự đều chuẩn hoá sortOrder thành dãy liên tục 1..n.
 * Xóa là xóa cứng: không entity nào tham chiếu Banner (ERD §2).
 * Validate lỗi → 400 { field, message } theo contract §8.
 */
@Service
@RequiredArgsConstructor
public class AdminBannerService {

  private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
  private static final Set<String> ALLOWED_IMAGE_TYPES =
      Set.of("image/jpeg", "image/png", "image/webp");

  /** Giới hạn ký tự [Giả định của spec §4.2 — docs không ghi]. */
  private static final int MAX_TITLE_LENGTH = 80;
  private static final int MAX_SUBTITLE_LENGTH = 120;
  private static final int MAX_CTA_LENGTH = 20;

  private static final Comparator<Banner> BY_SORT_ORDER =
      Comparator.comparingInt(Banner::getSortOrder);

  private final BannerRepository bannerRepository;
  private final StorageService storageService;

  /* ------------------------------ Danh sách / chi tiết ------------------------------ */

  /** GET /admin/banners — toàn bộ (kể cả đã tắt), sortOrder tăng dần. */
  public List<AdminBannerDto> list() {
    return bannerRepository.findAllByOrderBySortOrderAsc().stream().map(this::toDto).toList();
  }

  public AdminBannerDto get(String id) {
    return toDto(findBanner(id));
  }

  /* ------------------------------ Tạo / Sửa ------------------------------ */

  public AdminBannerDto create(AdminBannerRequest req) {
    validate(req);
    Banner b = new Banner();
    applyFields(b, req);
    // Chèn vào vị trí sortOrder mong muốn (mặc định cuối danh sách),
    // các banner sau dịch xuống 1 bậc, rồi chuẩn hoá 1..n (§4.2).
    List<Banner> ordered = sortedAll();
    int pos = desiredPosition(req.getSortOrder(), ordered.size());
    ordered.add(pos - 1, b);
    bannerRepository.save(b);
    normalize(ordered);
    return toDto(b);
  }

  public AdminBannerDto update(String id, AdminBannerRequest req) {
    Banner b = findBanner(id);
    validate(req);
    applyFields(b, req);
    List<Banner> ordered = sortedAll();
    ordered.removeIf(x -> x.getId().equals(id));
    int pos = desiredPosition(req.getSortOrder(), ordered.size());
    ordered.add(pos - 1, b);
    bannerRepository.save(b);
    normalize(ordered);
    return toDto(b);
  }

  /* ------------------------------ Xóa / Patch / Reorder ------------------------------ */

  /** Xóa cứng → sau xóa chuẩn hoá sortOrder các banner còn lại thành 1..n (§6.2). */
  public void delete(String id) {
    Banner b = findBanner(id);
    bannerRepository.delete(b);
    normalize(sortedAll());
  }

  /** PATCH: { active } — bật/tắt nhanh, giữ nguyên dữ liệu và thứ tự (§6.1). */
  public AdminBannerDto patch(String id, AdminBannerPatchRequest req) {
    Banner b = findBanner(id);
    if (req != null && req.getActive() != null) {
      b.setActive(req.getActive());
      b = bannerRepository.save(b);
    }
    return toDto(b);
  }

  /**
   * PUT /reorder — nguyên tử theo danh sách ids FE gửi: mọi id phải tồn tại
   * và không trùng (sai → 400, không đổi gì). Id của banner không có trong
   * danh sách (dữ liệu lệch) được nối cuối theo thứ tự cũ. Gán sortOrder 1..n.
   */
  public List<AdminBannerReorderItemDto> reorder(AdminBannerReorderRequest req) {
    if (req == null || req.getIds() == null || req.getIds().isEmpty()) {
      throw badRequest("Danh sách thứ tự banner không hợp lệ.", "ids");
    }
    Map<String, Banner> byId = new LinkedHashMap<>();
    for (Banner b : sortedAll()) {
      byId.put(b.getId(), b);
    }
    Set<String> seen = new HashSet<>();
    List<Banner> ordered = new ArrayList<>();
    for (String id : req.getIds()) {
      Banner b = id == null ? null : byId.get(id);
      if (b == null) {
        throw badRequest("Danh sách thứ tự có banner không tồn tại.", "ids");
      }
      if (!seen.add(id)) {
        throw badRequest("Danh sách thứ tự có banner bị trùng.", "ids");
      }
      ordered.add(b);
    }
    for (Banner b : byId.values()) {
      if (!seen.contains(b.getId())) {
        ordered.add(b);
      }
    }
    normalize(ordered);
    return ordered.stream()
        .map(b -> new AdminBannerReorderItemDto(b.getId(), b.getSortOrder()))
        .toList();
  }

  /* ------------------------------ Upload ảnh ------------------------------ */

  /**
   * POST /admin/banners/images — lưu file qua StorageService (subdir "banners"),
   * trả { url } (≤5MB; JPG/PNG/WebP) — pattern upload dùng chung với màn 15/16.
   * URL dạng /uploads/banners/... ở chế độ local, URL S3/CDN ở chế độ s3.
   */
  public Map<String, String> uploadImage(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "NO_FILE", "Vui lòng chọn một ảnh.");
    }
    if (file.getSize() > MAX_IMAGE_BYTES) {
      throw new ApiException(
          HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Mỗi ảnh không được vượt quá 5MB.");
    }
    String contentType = file.getContentType();
    if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType.toLowerCase())) {
      throw new ApiException(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          "INVALID_FILE_TYPE",
          "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.");
    }
    return Map.of("url", storageService.store(file, "banners"));
  }

  /* ------------------------------ Validate ------------------------------ */

  private void validate(AdminBannerRequest req) {
    if (req == null) {
      throw badRequest("Dữ liệu banner không hợp lệ.", null);
    }
    if (req.getImageUrl() == null || req.getImageUrl().isBlank()) {
      throw badRequest("Ảnh banner là bắt buộc.", "imageUrl");
    }
    if (req.getTitle() == null || req.getTitle().isBlank()) {
      throw badRequest("Tiêu đề là bắt buộc.", "title");
    }
    if (req.getTitle().trim().length() > MAX_TITLE_LENGTH) {
      throw badRequest("Tiêu đề tối đa " + MAX_TITLE_LENGTH + " ký tự.", "title");
    }
    if (req.getSubtitle() != null && req.getSubtitle().trim().length() > MAX_SUBTITLE_LENGTH) {
      throw badRequest("Mô tả phụ tối đa " + MAX_SUBTITLE_LENGTH + " ký tự.", "subtitle");
    }
    if (req.getCtaText() != null && req.getCtaText().trim().length() > MAX_CTA_LENGTH) {
      throw badRequest("Chữ trên nút tối đa " + MAX_CTA_LENGTH + " ký tự.", "ctaText");
    }
    if (req.getLinkUrl() == null || req.getLinkUrl().isBlank()) {
      throw badRequest("Link đích là bắt buộc.", "linkUrl");
    }
    String link = req.getLinkUrl().trim();
    if (!link.startsWith("/") && !link.matches("(?i)^https?://.*")) {
      throw badRequest(
          "Link đích phải bắt đầu bằng / (trang trong cửa hàng) hoặc là địa chỉ web đầy đủ bắt đầu bằng http.",
          "linkUrl");
    }
    if (req.getSortOrder() != null && req.getSortOrder() < 1) {
      throw badRequest("Thứ tự hiển thị phải là số nguyên từ 1 trở lên.", "sortOrder");
    }
  }

  private ApiException badRequest(String message, String field) {
    return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message, field);
  }

  /* ------------------------------ Mapping / helpers ------------------------------ */

  private Banner findBanner(String id) {
    return bannerRepository
        .findById(id)
        .orElseThrow(
            () ->
                new ApiException(HttpStatus.NOT_FOUND, "BANNER_NOT_FOUND", "Không tìm thấy banner."));
  }

  /** Toàn bộ banner đã sort theo sortOrder hiện tại (bản sao list, entity gốc). */
  private List<Banner> sortedAll() {
    List<Banner> all = new ArrayList<>(bannerRepository.findAllByOrderBySortOrderAsc());
    all.sort(BY_SORT_ORDER);
    return all;
  }

  /** Vị trí chèn 1..(size+1): null → cuối danh sách; vượt biên → kẹp về biên. */
  private int desiredPosition(Integer sortOrder, int sizeExcludingSelf) {
    if (sortOrder == null) {
      return sizeExcludingSelf + 1;
    }
    return Math.min(Math.max(1, sortOrder), sizeExcludingSelf + 1);
  }

  /** Gán sortOrder = dãy liên tục 1..n theo thứ tự list và lưu các banner bị lệch. */
  private void normalize(List<Banner> ordered) {
    for (int i = 0; i < ordered.size(); i++) {
      Banner b = ordered.get(i);
      if (b.getSortOrder() != i + 1) {
        b.setSortOrder(i + 1);
        bannerRepository.save(b);
      }
    }
  }

  private void applyFields(Banner b, AdminBannerRequest req) {
    b.setImageUrl(req.getImageUrl().trim());
    b.setLinkUrl(req.getLinkUrl().trim());
    b.setTitle(req.getTitle().trim());
    b.setSubtitle(req.getSubtitle() == null ? "" : req.getSubtitle().trim());
    b.setCtaText(req.getCtaText() == null ? "" : req.getCtaText().trim());
    b.setActive(req.isActive());
    // sortOrder không gán trực tiếp: create/update chèn theo vị trí rồi normalize().
    if (req.getSortOrder() != null) {
      b.setSortOrder(req.getSortOrder());
    }
  }

  private AdminBannerDto toDto(Banner b) {
    AdminBannerDto dto = new AdminBannerDto();
    dto.setId(b.getId());
    dto.setImageUrl(b.getImageUrl());
    dto.setLinkUrl(b.getLinkUrl());
    dto.setTitle(b.getTitle());
    dto.setSubtitle(b.getSubtitle());
    dto.setCtaText(b.getCtaText());
    dto.setSortOrder(b.getSortOrder());
    dto.setActive(b.isActive());
    return dto;
  }
}
