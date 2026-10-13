# 04 — User stories — Web bán hàng nội thất

> Mỗi story: vai trò · mong muốn · acceptance criteria Given/When/Then · liên kết → function (03) → FR (01) → entity (02).

## Vai trò: Khách vãng lai (GUEST)

### US-001 — Xem trang chủ
Là khách vãng lai, tôi muốn thấy banner, danh mục và sản phẩm nổi bật ngay trang chủ để nắm nhanh shop bán gì.
- **Given** trang chủ có banner đang bật và sản phẩm `featured`
- **When** tôi mở trang chủ
- **Then** tôi thấy banner theo đúng thứ tự, 3 khối sản phẩm (nổi bật/bán chạy/mới nhất), mỗi khối ≤ 10 item
- → F-001 → FR-001 → Banner, Product, Category

### US-002 — Tìm sofa dưới 10 triệu còn hàng
Là khách vãng lai, tôi muốn lọc sofa theo giá và tình trạng còn hàng để không mất thời gian vào món không mua được.
- **Given** tôi đang ở danh mục Sofa
- **When** tôi đặt lọc giá 0–10.000.000đ và sắp xếp giá tăng dần
- **Then** danh sách chỉ hiện sofa active trong khoảng giá, "giá từ" là giá variant rẻ nhất còn hàng, phân trang 24 item/trang
- → F-002 → FR-002, FR-003 → Product, ProductVariant, Category

### US-003 — Tìm kiếm "bàn trà gỗ"
Là khách vãng lai, tôi muốn gõ từ khóa và ra đúng sản phẩm kể cả khi gõ không dấu.
- **Given** có sản phẩm "Bàn trà gỗ sồi"
- **When** tôi tìm `ban tra go`
- **Then** sản phẩm đó xuất hiện trong kết quả, xếp trên các kết quả kém liên quan hơn
- → F-003 → FR-004 → Product

### US-004 — Chọn biến thể trước khi mua
Là khách vãng lai, tôi muốn chọn màu/kích thước/chất liệu và thấy giá + tồn kho tương ứng để quyết định.
- **Given** tôi mở chi tiết một chiếc ghế có 3 biến thể màu
- **When** tôi chọn màu "Xám"
- **Then** giá, tồn kho và ảnh hiển thị theo biến thể Xám; biến thể hết hàng bị disable
- → F-004 → FR-005 → Product, ProductVariant

### US-005 — Giỏ hàng không cần đăng nhập
Là khách vãng lai, tôi muốn thêm ghế vào giỏ mà chưa cần tài khoản.
- **Given** giỏ đang trống
- **When** tôi thêm 2 chiếc ghế (biến thể Xám) vào giỏ
- **Then** giỏ hiện 2 chiếc, subtotal đúng, giỏ vẫn còn sau khi tải lại trang
- → F-005 → FR-007 → Cart, ProductVariant

## Vai trò: Khách hàng (CUSTOMER)

### US-006 — Đăng ký và giữ lại giỏ hàng cũ
Là khách mới, tôi muốn đăng ký xong thì giỏ hàng lúc chưa đăng nhập vẫn còn nguyên.
- **Given** tôi có 2 món trong giỏ local (chưa login)
- **When** tôi đăng ký/đăng nhập thành công
- **Then** giỏ server gộp với giỏ local, không mất món nào
- → F-006, F-010 → FR-008, FR-014 → Cart, User

### US-007 — Đặt hàng và áp voucher
Là khách hàng, tôi muốn đặt 1 bộ sofa, áp voucher NOITHAT50 và trả COD.
- **Given** giỏ có 1 sofa variant còn hàng, voucher NOITHAT50 còn hiệu lực và đơn đạt giá trị tối thiểu
- **When** tôi checkout với địa chỉ mặc định, nhập voucher, chọn COD
- **Then** đơn được tạo ở trạng thái MỚI với `orderNumber`, discount tính đúng (có trần `maxDiscount`), `stock` variant bị trừ, `usedCount` voucher tăng 1
- → F-007 → FR-009, FR-011, FR-019 → Order, Payment, ProductVariant, Voucher

### US-008 — Hết hàng đúng lúc 2 người mua
Là khách hàng, tôi muốn hệ thống từ chối thẳng thắn nếu món tôi mua vừa bị người khác mua hết.
- **Given** variant chỉ còn 1 chiếc, 2 khách checkout cùng lúc
- **When** cả hai bấm đặt hàng
- **Then** 1 đơn thành công, đơn còn lại báo "sản phẩm vừa hết hàng", kho không bao giờ âm
- → F-007 → FR-011 → ProductVariant, Order

### US-009 — Theo dõi đơn đang giao
Là khách hàng, tôi muốn biết đơn của mình đang ở đâu.
- **Given** đơn NT-20261010-0001 ở trạng thái ĐANG GIAO
- **When** tôi mở chi tiết đơn
- **Then** tôi thấy timeline MỚI → ĐÃ XÁC NHẬN → ĐANG GIAO kèm thời gian từng mốc
- → F-009 → FR-012, FR-016 → Order

### US-010 — Hủy đơn mới đặt
Là khách hàng, tôi muốn hủy đơn vừa đặt nhầm.
- **Given** đơn của tôi đang ở trạng thái MỚI
- **When** tôi bấm Hủy đơn và xác nhận
- **Then** đơn chuyển ĐÃ HỦY, tồn kho được hoàn, voucher được hoàn lượt dùng
- → F-009 → FR-013 → Order, ProductVariant, Voucher

### US-011 — Đánh giá sau khi nhận hàng
Là khách hàng, tôi muốn đánh giá 5 sao chiếc bàn vừa nhận.
- **Given** đơn chứa chiếc bàn đã ở trạng thái HOÀN THÀNH
- **When** tôi gửi đánh giá 5 sao + bình luận
- **Then** review được lưu, `ratingAvg`/`ratingCount` của sản phẩm cập nhật; tôi không thể đánh giá lần 2 cho cùng sản phẩm
- → F-012 → FR-017 → Review, Product, Order

### US-012 — Thanh toán ví điện tử thất bại
Là khách hàng, tôi muốn đơn không bị treo vô thời hạn nếu ví thanh toán lỗi.
- **Given** tôi chọn ví điện tử và được chuyển sang cổng thanh toán
- **When** giao dịch ví thất bại / tôi không hoàn tất trong 30 phút
- **Then** đơn tự hủy, tồn kho hoàn lại, tôi nhận thông báo rõ lý do
- → F-008 → FR-010 → Payment, Order

## Vai trò: Quản trị viên (ADMIN)

### US-013 — Thêm sản phẩm mới có biến thể
Là admin, tôi muốn thêm "Sofa góc L" với 4 biến thể màu, mỗi biến thể giá/tồn kho riêng.
- **Given** tôi ở trang quản lý sản phẩm
- **When** tôi nhập thông tin, upload 6 ảnh, thêm 4 biến thể (mỗi biến thể có SKU, giá, tồn kho)
- **Then** sản phẩm xuất hiện ở catalog với "giá từ" = giá variant rẻ nhất; SKU trùng bị từ chối
- → F-014 → FR-020 → Product, ProductVariant

### US-014 — Xác nhận và giao đơn
Là admin, tôi muốn xác nhận đơn mới và chuyển sang đang giao.
- **Given** đơn NT-20261010-0001 ở trạng thái MỚI, đã thanh toán COD (chưa thu)
- **When** tôi bấm Xác nhận rồi cập nhật ĐANG GIAO kèm mã vận đơn
- **Then** trạng thái đổi đúng thứ tự vòng đời, `statusHistory` ghi đủ 3 mốc
- → F-016 → FR-022, FR-012 → Order

### US-015 — Cảnh báo sắp hết hàng
Là admin, tôi muốn biết sớm variant nào sắp hết để nhập thêm.
- **Given** variant "Ghế ăn - Đen" còn 3 chiếc, ngưỡng cảnh báo là 5
- **When** tôi mở trang tồn kho
- **Then** variant đó nằm trong danh sách cảnh báo, tôi thấy được số lượng và SKU
- → F-017 → FR-023 → ProductVariant

### US-016 — Xem báo cáo doanh thu tháng
Là admin, tôi muốn biết tháng này bán được bao nhiêu, món nào chạy nhất.
- **Given** có các đơn HOÀN THÀNH trong tháng 10
- **When** tôi mở báo cáo tháng 10, nhóm theo ngày
- **Then** tôi thấy tổng doanh thu, biểu đồ theo ngày, top 10 sản phẩm, doanh thu theo danh mục — chỉ tính đơn HOÀN THÀNH
- → F-020 → FR-026 → Order, Product, Category

### US-017 — Tạo voucher khai trương
Là admin, tôi muốn tạo voucher KHAITRUONG giảm 10% tối đa 200k cho đơn từ 1 triệu, dùng trong tháng 10, giới hạn 500 lượt.
- **Given** tôi nhập đúng các điều kiện trên
- **When** tôi lưu voucher
- **Then** khách áp được mã ở checkout; quá 500 lượt hoặc hết hạn thì mã báo không hợp lệ
- → F-018 → FR-024 → Voucher

## Vai trò bổ sung (quyết định 2026-10-10)

### US-018 — Săn flash sale
Là khách hàng, tôi muốn mua sofa đang flash sale giảm 30% trước khi hết suất.
- **Given** flash sale "Sofa góc L" còn suất và còn trong khung giờ
- **When** tôi mở trang flash sale và bấm mua
- **Then** tôi thấy đếm ngược, % suất đã bán, giá flash sale; checkout áp đúng giá sale và không cộng dồn voucher thường; hết suất → báo hết
- → F-022 → FR-028, FR-019 → Voucher, Product, ProductVariant

### US-019 — Admin tạo flash sale và mã giảm giá
Là admin, tôi muốn tạo flash sale cuối tuần cho 5 sản phẩm và 1 mã giảm giá đi kèm.
- **Given** tôi nhập danh sách sản phẩm, % giảm, khung giờ, tổng 100 suất
- **When** tôi lưu và bật chương trình
- **Then** trang flash sale hiển thị đúng giờ với đếm ngược; hết giờ hoặc hết 100 suất → tự đóng
- → F-022, F-018 → FR-028, FR-024 → Voucher

### US-020 — Xác thực SĐT trước khi mua
Là khách hàng mới, tôi muốn xác thực SĐT để được đặt hàng.
- **Given** tôi vừa đăng ký và nhập SĐT
- **When** tôi nhận OTP, nhập đúng trong 5 phút
- **Then** SĐT được xác thực; tôi đặt hàng được; nếu chưa xác thực mà bấm đặt hàng → bị chặn kèm hướng dẫn
- → F-024, F-007 → FR-030 → User

### US-021 — Thấy phí ship theo diện tích đơn
Là khách hàng, tôi muốn biết phí ship được tính thế nào khi mua sofa + bàn ăn.
- **Given** giỏ có sofa góc L (3.8 m²) và bàn ăn (1.6 m²)
- **When** tôi vào checkout
- **Then** phí ship hiển thị theo nấc 5.4 m² (nấc 3–6 m²), có dòng giải thích cách tính; đơn ≥ ngưỡng miễn phí → phí = 0
- → F-023, F-007 → FR-029 → ShippingRule, Order

---

## 5 câu hỏi mở cho chủ dự án — ✅ ĐÃ CHỐT ngày 2026-10-10

1. **Q1 — Thanh toán online:** ✅ Tích hợp **MoMo thật** (merchant account). → FR-010, F-008 cập nhật.
2. **Q2 — Giao hàng & phí ship:** ✅ Tự giao; phí ship tính theo **tổng diện tích đơn hàng** (nghiên cứu kích thước sản phẩm xem 02-ERD §4). → FR-029, F-023, `SHIPPING_RULE`.
3. **Q3 — Giá & tồn kho biến thể:** ✅ Theo dõi đến cấp **màu sắc** (mỗi màu: SKU/giá/tồn kho riêng; kích thước/chất liệu là thông số hiển thị).
4. **Q4 — Flash sale:** ✅ Có ngay từ đầu + admin cấu hình mã giảm giá. → FR-028, F-022.
5. **Q5 — Guest checkout:** ✅ **Không cho** — bắt buộc đăng nhập **và xác thực SĐT** (OTP). → FR-030, F-024; `Order.userId` bắt buộc.
