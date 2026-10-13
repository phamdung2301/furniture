# Spec giao diện — Flash sale & Phí ship admin (admin-flash-sale-phi-ship)

- **Dự án:** noi-that-shop · **Màn:** 22 — màn cuối (wave 4 — admin), gồm 2 khối độc lập trên 2 route
- **Nguồn:** FR-028/F-022/US-019 (flash sale) + FR-029/F-023/US-021 (phí ship) · Entity: Voucher (`type=FLASH_SALE`, `items[]`), ShippingRule
- **Design system:** layout §A + §B của `admin-dashboard.md`.
- **Nguyên tắc:** màn 13 đã ship toàn bộ logic khách + `FlashSaleService` (claim suất nguyên tử, giới hạn 2 suất/khách, không cộng dồn voucher thường, hoàn suất khi hủy). Màn này CHỈ thêm CRUD cấu hình admin — tuyệt đối không viết lại logic claim/giá.

## Phần A — `/admin/flash-sale` (FR-028)
### A.1 Bảng chương trình
Cột: Tên/code · Khung giờ (startAt → endAt) · Số món · Đã bán / Tổng suất (`usedCount / totalUsageLimit` + thanh tiến độ) · Trạng thái suy ra (Sắp diễn ra / Đang chạy / Đã kết thúc / Đã tắt — từ active + thời gian, không lưu thêm trạng thái) · Hành động.
### A.2 Form (slide-over)
code*, startAt*, endAt* (endAt > startAt), totalUsageLimit*, active; danh sách món: thêm sản phẩm → chọn màu cụ thể hoặc mọi màu (`FlashSaleItem.variantId` null) → chọn 1 trong 2 kiểu giảm: `flashPrice` cố định HOẶC `discountPercent` (+ maxDiscount) → `itemQuota` tùy chọn theo món. Validate: mỗi món chỉ 1 kiểu giảm; flashPrice < giá gốc của variant; không trùng product+variant trong cùng chương trình.
### A.3 Sửa/xóa theo vòng đời
Chương trình đang chạy hoặc đã có suất bán (`usedCount > 0` / `itemSoldCount > 0`) → không xóa cứng, không sửa giá/món; chỉ tắt (active=false) hoặc rút ngắn endAt. Chưa chạy + chưa bán → sửa/xóa tự do sau confirm §B.3. (Cùng triết lý F-018 voucher đã dùng thì chỉ tắt.)
### A.4 API dự kiến
`GET/POST /admin/flash-sales` · `PUT /admin/flash-sales/{id}` · `PATCH /admin/flash-sales/{id}/active` · `DELETE /admin/flash-sales/{id}` — dùng lại entity Voucher type=FLASH_SALE + DTO của FlashSaleService màn 13.

## Phần B — `/admin/phi-ship` (FR-029)
### B.1 Bảng nấc phí
Cột: Khoảng diện tích (`minAreaM2` → `maxAreaM2`, null = không giới hạn, hiển thị "trở lên") · Phí · Trạng thái active. Sort theo minAreaM2 tăng dần. Dưới bảng: ngưỡng miễn phí hiện tại + giải thích công thức `totalAreaM2 = Σ(lengthM × widthM × qty)` (US-021).
### B.2 Form & validate
minAreaM2* (≥0), maxAreaM2 (> min, hoặc trống = không giới hạn), fee* (≥0), active. **Chặn nấc chồng lấn** với nấc active khác — validate cả FE lẫn BE, lỗi nêu rõ nấc bị chồng. Các nấc active phải phủ liên tục từ 0 — thiếu khoảng → cảnh báo vàng (đơn rơi vào khoảng trống sẽ không tra được phí ở checkout).
### B.3 Ngưỡng miễn phí & trần 10 m²
- Ngưỡng miễn phí (tổng tiền đơn ≥ X → phí 0; hiện tại đã ship ở màn 7: miễn phí đơn ≥ 10.000.000đ): builder kiểm tra ngưỡng này đang nằm ở config/ShippingService chỗ nào trước khi làm form sửa — nếu đang hardcode thì đây là lúc chuyển thành cấu hình, ghi rõ thay đổi trong code.
- Đơn có totalArea > 10 m² → "Liên hệ báo giá" + chặn checkout online [Giả định F-023] — rule chạm vào checkout màn 7: sau khi sửa cấu hình ship phải regression-check checkout (phí hiển thị, tooltip breakdown, chặn >10 m²).
### B.4 API dự kiến
`GET/POST /admin/shipping-rules` · `PUT/DELETE /admin/shipping-rules/{id}` · cấu hình ngưỡng miễn phí theo cơ chế B.3 chốt được. Dưới `/admin/**` → ADMIN. Lưu ý SecurityConfig: matcher `POST /shipping/quote` public phải đứng trước `/shipping/**` hasRole ADMIN — CRUD admin nên đặt dưới `/admin/shipping-rules` để khỏi đụng bẫy thứ tự matcher đó.

## Đóng dự án
Đây là màn 22/22: sau màn này là ZIP toàn dự án cuối cùng + checklist bàn giao (tên thương hiệu, format nội dung chuyển khoản, credentials MoMo/OTP thật, biến ADMIN_* để tạo admin thật) — xem bản chuẩn bị bàn giao đi kèm.
