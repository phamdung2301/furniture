package com.mocan.shop.controller;

import com.mocan.shop.dto.CreateReviewRequest;
import com.mocan.shop.dto.PageResponseDto;
import com.mocan.shop.dto.ReviewDto;
import com.mocan.shop.dto.ReviewEligibilityDto;
import com.mocan.shop.dto.ReviewMutationResponse;
import com.mocan.shop.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Đánh giá sản phẩm — FR-017 / F-012.
 * Contract khớp frontend/src/api/reviewApi (api-contract-guard).
 * - GET /products/{slug}/reviews và .../eligibility: public.
 * - POST/PUT/DELETE và POST /reviews/images: cần JWT (userId = JWT subject).
 * page: 1-indexed.
 */
@RestController
@RequiredArgsConstructor
public class ReviewController {

  private final ReviewService reviewService;

  @GetMapping("/products/{slug}/reviews")
  public PageResponseDto<ReviewDto> getByProductSlug(
      @PathVariable String slug,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "5") int size) {
    return reviewService.getByProductSlug(slug, page, size);
  }

  /** Auth optional: không có JWT → NOT_LOGGED_IN. */
  @GetMapping("/products/{slug}/reviews/eligibility")
  public ReviewEligibilityDto eligibility(@PathVariable String slug) {
    return reviewService.eligibility(slug, optionalUserId());
  }

  @PostMapping("/products/{slug}/reviews")
  @ResponseStatus(HttpStatus.CREATED)
  public ReviewMutationResponse create(
      @PathVariable String slug,
      @RequestBody CreateReviewRequest req) {
    return reviewService.create(slug, requireUserId(), req);
  }

  @PutMapping("/reviews/{id}")
  public ReviewMutationResponse update(
      @PathVariable String id,
      @RequestBody CreateReviewRequest req) {
    return reviewService.update(id, requireUserId(), req);
  }

  @DeleteMapping("/reviews/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    reviewService.delete(id, requireUserId());
    return ResponseEntity.noContent().build();
  }

  @PostMapping(value = "/reviews/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public Map<String, List<String>> uploadImages(@RequestParam("files") List<MultipartFile> files) {
    requireUserId();
    return Map.of("urls", reviewService.uploadImages(files));
  }

  private String requireUserId() {
    String userId = optionalUserId();
    if (userId == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
    }
    return userId;
  }

  private String optionalUserId() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()
        || "anonymousUser".equals(auth.getPrincipal())) {
      return null;
    }
    return auth.getName();
  }
}
