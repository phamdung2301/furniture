/**
 * API module Viết/Sửa/Xóa đánh giá — F-012 · FR-017 · US-011.
 *
 * Contract (khớp backend):
 *   GET  /products/{slug}/reviews/eligibility
 *     -> { canReview, hasReviewed, reason, purchasedColors[], reviewId?, orderId? }
 *        reason: "OK" | "NOT_LOGGED_IN" | "NOT_PURCHASED" | "NOT_COMPLETED" | "ALREADY_REVIEWED"
 *   POST /reviews/images (multipart) -> { urls: [] }
 *   POST /products/{slug}/reviews   body { rating 1-5, comment?, imageUrls[]?, color?, orderId }
 *     -> 201 { review, summary: { average, total, distribution } }
 *   PUT    /reviews/{id} -> { review, summary }
 *   DELETE /reviews/{id} -> 204
 *
 * Khi backend chưa sẵn sàng, dùng mock data thao tác trực tiếp trên mảng
 * mockReviews (homeMock.js) — trang chi tiết đọc lại mảng này nên thấy ngay.
 * Đổi VITE_USE_MOCK=false để gọi API thật — không sửa component.
 */
import axiosClient from './axiosClient';
import { mockAllProducts, mockReviews } from '../mocks/homeMock';
import { getUser, isLoggedIn } from '../utils/auth';
import { summarizeReviews } from './productApi';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lỗi HTTP giả lập cho mock — gắn .status như productApi.notFoundError. */
function httpError(message, status, extra) {
  const e = new Error(message);
  e.status = status;
  if (extra) Object.assign(e, extra);
  return e;
}

/** Từ khóa thô tục [Giả định — F-012 filter từ khóa] → 422. */
const PROFANITY = ['dm', 'đm', 'vcl', 'vãi'];

function containsProfanity(text) {
  const t = (text || '').toLowerCase();
  return PROFANITY.some((w) => t.includes(w));
}

function findProductOrThrow(slug) {
  const product = mockAllProducts.find((p) => p.slug === slug);
  if (!product || product.active === false) {
    throw httpError('Không tìm thấy sản phẩm', 404);
  }
  return product;
}

function mockSummary(product) {
  const reviews = mockReviews.filter((r) => r.productId === product.id);
  return summarizeReviews(product, reviews);
}

function findMockReview(id) {
  return mockReviews.find((r) => r.id === id) || null;
}

function validatePayload(payload) {
  const { rating, comment } = payload;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw httpError('Số sao đánh giá không hợp lệ.', 400);
  }
  if (comment != null && comment.length > 1000) {
    throw httpError('Bình luận không được vượt quá 1000 ký tự.', 400);
  }
  if (comment && containsProfanity(comment)) {
    throw httpError('Bình luận chứa từ ngữ không phù hợp. Vui lòng chỉnh sửa lại.', 422);
  }
}

/**
 * Điều kiện được đánh giá — F-012 (5 case §2 spec).
 * Mock: user demo đã login có 1 đơn HOÀN THÀNH chứa sản phẩm (màu Xám + Be)
 *   → case 5 đủ điều kiện. Chưa login → case 1.
 */
export async function getEligibility(slug) {
  if (!USE_MOCK) {
    const { data } = await axiosClient.get(`/products/${slug}/reviews/eligibility`);
    return data;
  }
  await delay(MOCK_DELAY);
  const product = findProductOrThrow(slug);
  if (!isLoggedIn()) {
    return {
      canReview: false,
      hasReviewed: false,
      reason: 'NOT_LOGGED_IN',
      purchasedColors: [],
    };
  }
  const user = getUser();
  const mine = mockReviews.find(
    (r) => r.productId === product.id && r.userId && user && r.userId === user.id
  );
  if (mine) {
    return {
      canReview: false,
      hasReviewed: true,
      reason: 'ALREADY_REVIEWED',
      purchasedColors: ['Xám', 'Be'],
      reviewId: mine.id,
      orderId: mine.orderId || null,
    };
  }
  return {
    canReview: true,
    hasReviewed: false,
    reason: 'OK',
    purchasedColors: ['Xám', 'Be'],
    orderId: 'DH-MOCK-0001',
  };
}

/** Viết đánh giá mới — unique {productId, userId} (409 nếu trùng). */
export async function createReview(slug, { rating, comment, imageUrls, color, orderId }) {
  const payload = { rating, comment, imageUrls, color, orderId };
  if (!USE_MOCK) {
    const { data } = await axiosClient.post(`/products/${slug}/reviews`, payload);
    return data;
  }
  await delay(MOCK_DELAY);
  const user = getUser();
  if (!user) throw httpError('Bạn cần đăng nhập để viết đánh giá.', 401);
  const product = findProductOrThrow(slug);
  validatePayload(payload);
  const existing = mockReviews.find(
    (r) => r.productId === product.id && r.userId && r.userId === user.id
  );
  if (existing) {
    throw httpError('Bạn đã đánh giá sản phẩm này rồi.', 409, {
      reviewId: existing.id,
      review: existing,
    });
  }
  const review = {
    id: `rm${Date.now()}`,
    productId: product.id,
    userId: user.id,
    userName: user.name || user.phone || 'Khách hàng',
    rating,
    comment: comment || '',
    images: imageUrls || [],
    color: color || null,
    orderId: orderId || null,
    verifiedPurchase: true,
    createdAt: new Date().toISOString(),
  };
  mockReviews.unshift(review);
  return { review, summary: mockSummary(product) };
}

/** Sửa đánh giá — chỉ chính chủ (403 nếu không phải chủ). */
export async function updateReview(id, { rating, comment, imageUrls, color, orderId }) {
  const payload = { rating, comment, imageUrls, color, orderId };
  if (!USE_MOCK) {
    const { data } = await axiosClient.put(`/reviews/${id}`, payload);
    return data;
  }
  await delay(MOCK_DELAY);
  const user = getUser();
  const review = findMockReview(id);
  if (!review) throw httpError('Không tìm thấy đánh giá.', 404);
  if (!user || (review.userId && review.userId !== user.id)) {
    throw httpError('Bạn chỉ có thể sửa đánh giá của chính mình.', 403);
  }
  validatePayload(payload);
  Object.assign(review, {
    rating,
    comment: comment || '',
    images: imageUrls || [],
    color: color || review.color || null,
    updatedAt: new Date().toISOString(),
  });
  const product = mockAllProducts.find((p) => p.id === review.productId);
  return { review, summary: product ? mockSummary(product) : null };
}

/** Xóa đánh giá — chỉ chính chủ. Mock trả thêm summary mới để page cập nhật. */
export async function deleteReview(id) {
  if (!USE_MOCK) {
    await axiosClient.delete(`/reviews/${id}`);
    return {};
  }
  await delay(MOCK_DELAY);
  const user = getUser();
  const idx = mockReviews.findIndex((r) => r.id === id);
  if (idx === -1) throw httpError('Không tìm thấy đánh giá.', 404);
  const review = mockReviews[idx];
  if (!user || (review.userId && review.userId !== user.id)) {
    throw httpError('Bạn chỉ có thể xóa đánh giá của chính mình.', 403);
  }
  mockReviews.splice(idx, 1);
  const product = mockAllProducts.find((p) => p.id === review.productId);
  return { summary: product ? mockSummary(product) : null };
}

/** Upload ảnh minh họa — multipart, gọi NGAY khi user chọn file. */
export async function uploadImages(files) {
  if (!USE_MOCK) {
    const form = new FormData();
    (files || []).forEach((f) => form.append('images', f));
    const { data } = await axiosClient.post('/reviews/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
  await delay(800);
  const seed = Date.now();
  return {
    urls: (files || []).map(
      (_, i) => `https://picsum.photos/seed/review-${seed}-${i}/400/400`
    ),
  };
}
