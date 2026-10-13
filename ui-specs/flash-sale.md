# Spec giao diện — Flash sale (phía khách hàng) (flash-sale)

- **Dự án:** noi-that-shop · **Màn:** Flash sale (màn 13, wave 3: Tương tác — màn khách cuối)
- **Nguồn:** FR-028 · FR-019 · F-022 · US-018 · Entities: Voucher (`type=FLASH_SALE`), Product, ProductVariant
- **Trạng thái:** DRAFT → chuyển live-ui-builder dựng demo
- **Phạm vi:** trang `/flash-sale` + khối flash sale ở trang chủ (§6 — trang chủ hiện CHƯA có khối này, chỉ có item nav + hero banner 3 trỏ sang `/flash-sale` theo §2.3/§2.4 trang-chu) + hiển thị giá flash nhất quán ở trang chi tiết / QuickView (§5.3, ghi chú tích hợp — không redesign các màn đó).
- **Design system:** tái dùng nguyên xi §0 của `trang-chu.md` (tokens warm wood, Be Vietnam Pro, Nút Primary/Secondary, Badge, Product Card). Thêm 1 component mới: `CountdownTimer` (§3) + `FlashSaleCard` (§4) mở rộng từ ProductCard.
- **Nguyên tắc giá (bắt buộc):** FE **không tự tính** giá flash sale. Mọi giá flash hiển thị đều do backend trả về (đã áp %/giá cố định theo cấu hình chương trình). FE chỉ định dạng `vi-VN + đ` và so sánh để vẽ badge/tiến độ.

---

## §1. Trang `/flash-sale` — bố cục tổng thể

- Route `/flash-sale` (thêm route mới vào `App.jsx`, cạnh `/yeu-thich`).
- Breadcrumb: `Trang chủ → Flash sale`.
- Thứ tự khối (top → bottom):
  1. **Banner chương trình** (§2) — tên + khung giờ + countdown + tiến độ toàn chương trình.
  2. **Dòng ghi chú** (chỉ khi chương trình đang diễn ra): `Giá flash sale áp dụng khi thêm vào giỏ trong thời gian chương trình. Không áp dụng cùng mã giảm giá khác.` — 13px `--text-muted`, căn giữa dưới banner. (Nguồn: F-022 "không cộng dồn với voucher thường", US-018.)
  3. **Grid sản phẩm flash sale** (§4) — toàn bộ món trong chương trình, không phân trang, không SortDropdown (thứ tự = thứ tự admin cấu hình trong chương trình **[Giả định]** — `applicableProductIds` giữ thứ tự mảng).
- Grid: 4 cột desktop · 3 tablet · 2 mobile, gap `20px` (đúng §2.6 trang-chu).
- Trang dùng Header/Footer chung như mọi màn (Header đã có sẵn trong các page khác — builder theo pattern page hiện có).

---

## §2. Banner chương trình

### 2.1 Hình thức
- Khối full-width trong container, bo `20px`, nền gradient `--brand-900 → --brand-700`, chữ trắng; padding `28px` desktop / `20px` mobile.
- Hàng trên: icon ⚡ trong vòng tròn nền `--accent` + tiêu đề `Flash sale` 28px/800 (nhãn cố định — entity Voucher **không có field tên chương trình**, xem divergence §10) + badge trạng thái (§2.2).
- Hàng giữa (desktop 2 cột, mobile xếp chồng):
  - Trái: dòng khung giờ `Diễn ra từ {startAt: dd/MM/yyyy HH:mm} đến {endAt: dd/MM/yyyy HH:mm}` 14px trắng 85% + dòng phụ theo trạng thái (§2.2).
  - Phải: **CountdownTimer** (§3) + nhãn phía trên (`Kết thúc sau` khi đang diễn ra · `Bắt đầu sau` khi sắp diễn ra).
- Hàng dưới: **thanh tiến độ toàn chương trình** (§2.3) — chỉ hiện khi đang diễn ra.

### 2.2 Badge + dòng phụ theo trạng thái chương trình

| Trạng thái | Điều kiện | Badge | Dòng phụ |
|---|---|---|---|
| **Đang diễn ra** | `startAt ≤ now < endAt` và `usedCount < totalUsageLimit` | `ĐANG DIỄN RA` — nền `--error`, chữ trắng, pulse nhẹ | `Nhanh tay kẻo hết — số lượng có hạn.` |
| **Sắp diễn ra** | `now < startAt` | `SẮP DIỄN RA` — nền `--accent`, chữ `--brand-900` | `Chương trình bắt đầu lúc {startAt: HH:mm dd/MM/yyyy}.` |
| **Đã kết thúc** | `now ≥ endAt` hoặc `usedCount ≥ totalUsageLimit` hoặc không có chương trình | — (không render banner, đi thẳng §7.2 empty state) | — |

### 2.3 Thanh tiến độ toàn chương trình (F-022 output: "% đã bán")
- Thanh ngang full-width banner: nền trắng 25%, phần đã bán nền `--accent`, cao `10px`, bo `999px`.
- Text phải thanh (trắng, 13px/600): `Đã bán {usedCount}/{totalUsageLimit} suất · {percent}%` — percent = `round(usedCount / totalUsageLimit × 100)`.
- Khi còn ≤ 10% suất: text thêm ` — sắp hết suất!` và phần fill chuyển `--error`.

---

## §3. Component `CountdownTimer` (mới, dùng chung trang + trang chủ)

- **Props:** `targetAt` (ISO), `serverNow` (ISO — mốc "hiện tại" backend trả kèm để FE hiệu chỉnh lệch đồng hồ máy khách: offset = `serverNow − Date.now()` lúc tải trang, cộng offset vào mọi lần tính), `compact` (bool), `onExpire` (callback).
- **Hiển thị (bản đầy đủ):** 4 ô số — `Ngày : Giờ : Phút : Giây`; mỗi ô: số 24px/800 nền trắng 12% bo `10px`, nhãn nhỏ 11px dưới số (`Ngày/Giờ/Phút/Giây`). Số luôn 2 chữ số (ngày có thể 1–2 chữ số, không ép 0 phía trước nếu ≥ 10... giữ 2 chữ số cho đồng nhất: `02`).
- **Bản rút gọn (`compact`, cho trang chủ §6):** 3 ô `Giờ : Phút : Giây`; nếu còn > 24 giờ thì ô đầu đổi thành `{n} ngày {hh} giờ` dạng text (không ô ngày riêng).
- **Hành vi:**
  - Tick mỗi 1 giây (`setInterval`), tính `remaining = targetAt − (Date.now() + offset)`; `remaining ≤ 0` → dừng tick, gọi `onExpire` 1 lần (trang refetch trạng thái chương trình — chuyển trạng thái không reload trang, §8).
  - Còn < 1 giờ: ô Phút + Giây chuyển nền `--error`; còn < 5 phút: thêm pulse 1s cho ô Giây (tắt khi `prefers-reduced-motion`).
  - Tab ẩn (visibilitychange) → tạm dừng interval, quay lại tab thì tính lại ngay từ mốc tuyệt đối (không trôi giờ).

---

## §4. Component `FlashSaleCard` (mới, mở rộng ProductCard)

Dùng khung card §0.4 trang-chu (ảnh 4/3, tên, sao, chấm màu, nút tim wishlist — giữ nguyên hành vi của `ProductCard` hiện có) và **thay khối giá + thêm tiến độ + nút mua**:

### 4.1 Badge
- Góc trên-trái ảnh: Badge `-{discountPercent}%` (Badge `type="sale"` — nền `--error`, chữ trắng; pattern đã có ở §0.4). `discountPercent` do backend trả (đã làm tròn), FE không tự tính.
- Hết suất của món (§4.3): thay badge % bằng overlay giữa ảnh `Hết hàng flash sale` (pattern overlay `Hết hàng` §0.4: nền đen 55% + chữ trắng 14px/600).

### 4.2 Khối giá (thay dòng giá thường của ProductCard)
- Dòng 1: giá flash `flashPrice` — 18px/700 màu `--error` + nhãn nhỏ `Giá flash sale` 11px `--text-muted` phía trên (thay cho nhãn `Giá từ`; nếu món có nhiều màu áp flash ở các mức khác nhau thì hiện `Giá từ` + giá flash thấp nhất — backend trả `flashPrice` của variant mặc định F-004 kèm cờ `hasMultipleFlashPrices` **[Giả định field hiển thị]**).
- Dòng 2: giá gốc gạch ngang 13px `--text-muted`: `{originalPrice}đ`.
- Ẩn chấm màu? **Không** — giữ nguyên chấm màu như ProductCard (khách biết món có những màu nào; màu không thuộc chương trình thì khi vào chi tiết giá của màu đó là giá thường — backend quyết định theo từng variant, §5.1).

### 4.3 Thanh tiến độ suất của món + nút mua
- Dưới khối giá: thanh tiến độ cao `8px` bo `999px`, nền `#F3E3DC`, fill gradient `--error → --accent`; text 12px `--text-muted` dưới thanh: `Đã bán {itemSoldCount}/{itemQuota}`.
  - `itemQuota` / `itemSoldCount`: suất và số đã bán **của riêng món (theo sản phẩm/màu áp dụng)** — **[Giả định mở rộng ERD]**: Voucher hiện chỉ có `totalUsageLimit`/`usedCount` ở cấp chương trình; cần backend bổ sung quota/soldCount theo từng item trong cấu hình chương trình (chi tiết §10). Nếu backend chưa trả 2 field này → ẩn thanh theo món, chỉ giữ tiến độ toàn chương trình ở banner (§2.3).
  - Còn ≤ 20% suất của món: text đổi màu `--error` + thêm ` — sắp hết!`.
- **Nút mua:** Primary nhỏ full-width cuối card, nhãn `Mua ngay`:
  - Món có **đúng 1 màu còn hàng thuộc chương trình** → bấm: thêm thẳng variant đó vào giỏ (hành vi §5.2) + toast `Đã thêm {tên sản phẩm} ({màu}) vào giỏ hàng.` + badge giỏ header cập nhật (pattern `addToCart` trang chủ hiện có).
  - Món có **nhiều màu** → bấm: mở `QuickViewModal` (đã có) để chọn màu; trong modal, màu thuộc chương trình hiện giá flash + badge `-{percent}%`, màu không thuộc hiện giá thường (§5.3).
  - **Hết suất của món** (`itemSoldCount ≥ itemQuota`) hoặc **hết hàng tồn kho** (mọi variant stock = 0 — phân biệt rõ 2 khái niệm): nút disabled, nhãn đổi `Hết hàng flash sale` (hết suất) / `Hết hàng` (hết tồn kho). Card vẫn click được vào trang chi tiết.
  - **Chương trình sắp diễn ra:** nút disabled, nhãn `Sắp mở bán` (mọi card).
- Click card (ngoài nút mua/tim) → `/san-pham/:slug` như ProductCard.

---

## §5. Cơ chế giá flash sale (giỏ hàng + checkout) — backend quyết định

### 5.1 Nguồn giá
- Chương trình áp cho **sản phẩm/màu chỉ định** (F-022 input: "danh sách sản phẩm/màu áp dụng"): 1 item chương trình = 1 product, có thể giới hạn ở một số variant (màu) của product đó.
- Mỗi item cấu hình **1 trong 2 kiểu giảm**: giá flash cố định (`flashPrice`) **hoặc** % giảm (`discountPercent`, có thể kèm trần `maxDiscount` theo field Voucher sẵn có). Backend tính `flashPrice` cuối cùng và trả về trong mọi response có variant đó khi chương trình đang diễn ra (field bổ sung, §9): `flashSale: { programId, flashPrice, discountPercent, endAt, itemSoldOut } | null` ở cấp **variant**.
- FE ở mọi màn (trang flash sale, chi tiết, QuickView, giỏ) chỉ hiển thị `flashPrice` backend trả — tuyệt đối không tự nhân % ở client (tránh lệch làm tròn).

### 5.2 Thêm vào giỏ
- FE gửi request thêm giỏ **như bình thường** (F-005: `variantId`, `qty`) — không gửi giá. Backend tự resolve: variant thuộc chương trình **đang diễn ra** + còn suất của món + còn suất toàn chương trình → giá dòng giỏ = `flashPrice`, dòng giỏ gắn cờ `flashSaleProgramId` **[Giả định mở rộng CART_ITEM]** để FE vẽ badge `Flash sale` nhỏ cạnh giá ở trang giỏ/mini-cart (tích hợp màn 5 — ghi chú, không redesign màn giỏ).
- Giới hạn **1 khách tối đa 2 suất / chương trình** (F-022 **[Giả định]**): "suất" = tổng số lượng (qty) các món flash sale của khách trong 1 chương trình. Backend kiểm khi thêm giỏ + khi chốt đơn. Nếu vượt: thêm giỏ bị từ chối với message `Mỗi khách hàng tối đa 2 suất cho mỗi chương trình flash sale.` — FE hiện toast đỏ message này. Khách vãng lai chưa login vẫn thêm giỏ được (giỏ local — giới hạn chỉ chốt cứng ở checkout, nơi bắt buộc login theo QĐ 2026-10-10; FE không tự chặn ở local).

### 5.3 Nhất quán ở trang chi tiết + QuickView (ghi chú tích hợp màn 4)
- Variant thuộc chương trình đang diễn ra → khối giá ở trang chi tiết hiện: giá flash (`--error`) + giá gốc gạch ngang + Badge `-{percent}%`; dưới khối giá thêm dòng mini: ⚡ `Flash sale kết thúc sau` + CountdownTimer compact + thanh tiến độ của món (§4.3 thu gọn). Nút "Thêm vào giỏ"/"Mua ngay" hoạt động như thường — giá vào giỏ do backend resolve (§5.2).
- Variant thuộc chương trình **sắp diễn ra** → hiện giá thường + dòng ghi chú `⚡ Sắp flash sale từ {startAt: HH:mm dd/MM}` (không hiện giá flash dự kiến ở chi tiết — tránh khách chờ/khiếu nại lệch giá; trang `/flash-sale` thì hiện giá flash dự kiến vì đó là trang chương trình, §8.2).

### 5.4 Checkout — chốt giá + tranh suất (F-022 rules + edge case)
- Trước khi tạo đơn, backend validate lại từng dòng flash sale (mẫu validate giá/tồn đã có ở màn 5/7):
  - Chương trình **đã kết thúc / hết suất của món / hết suất toàn chương trình** sau khi khách thêm giỏ → dòng đó **về giá thường**, checkout hiện banner cảnh báo giá thay đổi (pattern F-005 đã có): `Chương trình flash sale đã kết thúc hoặc hết suất — {tên sản phẩm} trở về giá thường {originalPrice}đ.` Khách xác nhận mới tạo đơn.
  - **Tranh suất cuối** (2 khách cùng chốt): `usedCount` tăng nguyên tử khi tạo đơn thành công; người sau nhận lỗi hết suất → áp xử lý như trên (về giá thường + cảnh báo), không tạo đơn giá flash.
  - Còn hạn + còn suất → chốt đúng giá flash vào snapshot đơn (như snapshot giá F-007), `usedCount` +qty, `itemSoldCount` +qty.
- **Không cộng dồn voucher thường** (F-022, FR-019, US-018): mã giảm giá thường **không áp dụng lên các dòng flash sale**. Nếu đơn gồm toàn món flash sale → ô voucher ở checkout báo `Đơn hàng flash sale không áp dụng thêm mã giảm giá.`; nếu đơn hỗn hợp → voucher chỉ tính trên tổng các dòng thường (hiển thị tách dòng ở tóm tắt đơn là việc của màn 7 — spec này chỉ chốt rule + message, ghi chú tích hợp).

---

## §6. Khối flash sale ở trang chủ (BỔ SUNG MỚI)

Trang chủ hiện **chưa có** khối này (chỉ có item nav `Flash sale` §2.3 trang-chu + hero banner 3 trỏ sang `/flash-sale`). Bổ sung 1 section mới:

- **Vị trí:** ngay sau khối "Danh mục nổi bật", trước "Sản phẩm nổi bật" (khách thấy ưu đãi sớm; không xáo trộn thứ tự các khối hiện có phía dưới).
- **Section header:** trái: ⚡ + H2 `Flash sale` (chữ `--error`) + CountdownTimer `compact` ngay cạnh (chip nền `#FDECEA`, số `--error`); phải: link `Xem tất cả →` → `/flash-sale` (SectionHeader tái dùng, thêm slot countdown **[mở rộng component]**).
- **Nội dung:** 1 hàng **4 món đầu** của chương trình (grid 4 cột desktop · 2 mobile — mobile hiện 2 món đầu + link xem tất cả), dùng `FlashSaleCard` (§4) nguyên vẹn (gồm tiến độ + nút Mua ngay).
- **Điều kiện hiển thị:** chỉ render khi có chương trình **đang diễn ra hoặc sắp diễn ra** (sắp diễn ra: card ở trạng thái `Sắp mở bán`, countdown đếm tới `startAt`). Không có chương trình / đã kết thúc → **ẩn cả khối** (đúng pattern empty trang chủ §5 trang-chu).
- **Trạng thái:** loading → skeleton 4 card shimmer; error → **ẩn khối** (không chặn trang chủ, khác khối sản phẩm thường — flash sale là khối phụ trợ) + log lỗi; empty → ẩn khối.

---

## §7. Trạng thái loading / empty / error của trang `/flash-sale`

### 7.1 Loading
- Banner: skeleton khối bo 20px shimmer (nền `#EFE7DA`).
- Grid: 8 skeleton card (tái dùng `SkeletonCard` màn 1).

### 7.2 Empty — chương trình đã kết thúc / chưa có chương trình
- Breadcrumb giữ nguyên. Khối giữa trang: icon ⚡ outline lớn màu `--border` + H2 `Chương trình đã kết thúc` + text phụ `Đợt flash sale này đã khép lại. Xem thêm nhiều ưu đãi khác đang chờ bạn nhé.` + nút Primary `Khám phá sản phẩm` → `/`.
- Dưới khối empty: section `Gợi ý cho bạn` — grid 4 ProductCard bán chạy (tái dùng dữ liệu khối "Bán chạy nhất" trang chủ / API gợi ý, §9) + link `Xem tất cả →`.
- Nếu có chương trình **sắp diễn ra tiếp theo** → không vào trạng thái này; trang hiện trạng thái sắp diễn ra của chương trình đó (§8.2).

### 7.3 Error
- Banner lỗi inline: ⚠️ `Không tải được chương trình flash sale. Kiểm tra mạng rồi thử lại nhé.` + nút Secondary `Thử lại` (pattern §5 trang-chu) — gọi lại API chương trình.

---

## §8. Hành vi theo trạng thái chương trình (trang `/flash-sale`)

### 8.1 Đang diễn ra
- Như §1–§5. Countdown đếm tới `endAt`. Countdown về 0 → refetch: nếu không còn chương trình active → chuyển §7.2 (không reload). Hết suất toàn chương trình trong lúc đang xem (phát hiện khi refetch định kỳ 60s hoặc khi thao tác mua bị từ chối) → banner chuyển trạng thái kết thúc + toàn bộ nút mua disabled + toast `Chương trình flash sale đã hết suất.` → sau đó render §7.2 khi refetch xác nhận.

### 8.2 Sắp diễn ra
- Banner theo §2.2 (badge `SẮP DIỄN RA`, countdown đếm tới `startAt`, **không** hiện thanh tiến độ toàn chương trình — chưa bán suất nào).
- Card hiện **giá flash dự kiến** (backend trả `flashPrice` như bình thường) + giá gốc gạch ngang + badge % — nhưng nút mua disabled nhãn `Sắp mở bán`, không có thanh tiến độ theo món; thêm dòng nhỏ trên grid: `Giá hiển thị là giá flash sale dự kiến, áp dụng khi chương trình bắt đầu.`
- Countdown về 0 → refetch → chuyển sang trạng thái đang diễn ra (bật nút mua, hiện tiến độ) không reload trang.

### 8.3 Ưu tiên chọn chương trình hiển thị
- API trả về **1 chương trình hiện hành**: đang diễn ra (nếu có) → sắp diễn ra gần nhất (nếu không có cái đang diễn ra) → `null`. FE không tự chọn.

---

## §9. Contract backend + dữ liệu mẫu (builder implement)

**Endpoints:**
- `GET /flash-sale/current` — public → `{ program: FlashSaleProgram | null }`:
  ```
  FlashSaleProgram {
    id, startAt, endAt, serverNow,            // ISO 8601; serverNow để hiệu chỉnh countdown (§3)
    totalUsageLimit, usedCount,                // suất toàn chương trình (Voucher F-022)
    items: [{
      productId, slug, name, image, ratingAvg, ratingCount, badge,
      colors: [{ color, colorHex, stock }],    // như ProductCard hiện có
      variantId,                               // variant mặc định F-004 (để Mua ngay 1-màu + QuickView)
      originalPrice, flashPrice, discountPercent,
      itemQuota, itemSoldCount,                // [Giả định mở rộng] suất theo món; thiếu → null (ẩn thanh §4.3)
      soldOut                                  // hết suất món hoặc hết tồn kho (backend tính)
    }]
  }
  ```
- Field bổ sung ở các response variant hiện có (chi tiết sản phẩm / QuickView / giỏ): `flashSale: { programId, flashPrice, discountPercent, endAt, itemSoldOut } | null` (§5.1, §5.3).
- Thêm giỏ / checkout: **không đổi contract** F-005/F-007 — backend resolve giá + trả lỗi/gắn cờ theo §5.2, §5.4.
- Gợi ý ở empty state (§7.2): tái dùng `GET /home/best-sellers` hiện có của trang chủ (không bịa endpoint mới).
- Thêm entry `/flash-sale` vào vite proxy (bài học /claims — verify trong file).

**Dữ liệu mẫu demo** (chương trình đang diễn ra; `startAt` = hôm qua 20:00, `endAt` = ngày mai 22:00 để countdown có cả Ngày; `totalUsageLimit = 100`, `usedCount = 73` (73% — bằng tổng đã bán từng món: 14 + 29 + 6 + 4 + 20)):
1. **Sofa góc L Nordic** (Xám) — giảm 30% (US-018): gốc `12.900.000đ` → flash `9.030.000đ`, badge `-30%`, suất món 20, đã bán 14.
2. **Ghế ăn bọc vải** (Be) — giá cố định: gốc `1.450.000đ` → flash `990.000đ`, badge `-32%`, suất món 30, đã bán 29 (sắp hết — demo trạng thái ≤ 20% còn lại... còn 1/30 → text đỏ `sắp hết!`).
3. **Bàn trà gỗ Sồi** (Tự nhiên) — giảm 20%: gốc `3.450.000đ` → flash `2.760.000đ`, badge `-20%`, suất món 15, đã bán 6.
4. **Đèn sàn trang trí** (Đen) — giá cố định: gốc `890.000đ` → flash `749.000đ`, badge `-16%`, suất món 15, đã bán 4.
5. **Ghế lười hạt xốp** (Xám) — giảm 25%: gốc `650.000đ` → flash `487.500đ` → làm tròn flash `488.000đ` **[số demo — backend chốt số cuối]**, suất món 20, đã bán 20 → **hết suất: overlay `Hết hàng flash sale` + nút disabled**.
- Toggle demo (cho live-ui-builder): `Đang diễn ra` (mặc định, dữ liệu trên) / `Sắp diễn ra` (chương trình bắt đầu ngày mai 20:00, 3 món, nút `Sắp mở bán`) / `Đã kết thúc` (empty state §7.2 + gợi ý bán chạy) / `Lỗi tải` (error §7.3).

---

## §10. Traceability + thuật ngữ + divergence

| Mục spec | Nguồn |
|---|---|
| Trang `/flash-sale` + đếm ngược + % đã bán + giá gốc gạch ngang | FR-028 · F-022 (output khách) · US-018 |
| Áp theo % hoặc giá cố định cho sản phẩm/màu chỉ định | FR-028 · F-022 (input admin) · Voucher `type=FLASH_SALE`, `value`, `applicableProductIds` |
| Suất toàn chương trình, hết giờ/hết suất → tự đóng, giá về thường | F-022 rules · Voucher `totalUsageLimit`, `usedCount`, `startAt`, `endAt` · US-019 |
| Tiến độ "Đã bán X/Y" từng món + badge `Hết hàng flash sale` + disable mua khi hết suất món | Task màn 13 · suy từ F-022 (suất) — quota theo món là **[Giả định mở rộng]** (xem divergence) |
| 1 khách tối đa 2 suất/chương trình | F-022 **[Giả định]** nguyên văn |
| Không cộng dồn voucher thường; checkout áp đúng giá sale | F-022 · FR-019 · US-018 (Then) |
| Tranh suất cuối → người sau báo hết suất | F-022 edge case |
| Thêm giỏ giữ contract F-005, backend resolve giá; cảnh báo giá đổi khi chốt | F-005 (pattern màn 5) · F-007 (pattern màn 7) |
| Khối flash sale trang chủ (countdown + 4 món + Xem tất cả) | FR-028 · §2.3/§2.4 trang-chu (nav + banner đã trỏ `/flash-sale`) |
| Hiển thị giá flash ở chi tiết/QuickView | F-022 (giá áp khi mua phải nhất quán mọi điểm bán) — ghi chú tích hợp màn 4 |
| Loading skeleton / empty / error + Thử lại | Operating rule 2 · §5 trang-chu |
| Text tiếng Việt, không lộ mã chương trình (`code`) ra UI | copy-ux-linter |

**Thuật ngữ mới đề xuất** (copy-ux-linter duyệt): `Flash sale` (đã dùng ở nav trang-chu) · `Đang diễn ra` · `Sắp diễn ra` · `Sắp mở bán` · `Hết hàng flash sale` · `Chương trình đã kết thúc` · `Đã bán {X}/{Y} suất` · `Giá flash sale`.

**Divergence docs cần doc-writer cập nhật** (operating rule 1):
1. `02-ERD.md` — VOUCHER (`type=FLASH_SALE`) cần bổ sung cấu trúc item theo chương trình: mỗi item gồm `productId` (+ `variantId` khi áp theo màu), kiểu giảm (`flashPrice` | `discountPercent`), `itemQuota`, `itemSoldCount`. Hiện ERD chỉ có quota ở cấp chương trình (`totalUsageLimit`/`usedCount`) — spec giữ nguyên 2 field này cho tiến độ + điều kiện đóng toàn chương trình.
2. `02-ERD.md` — CART_ITEM bổ sung `flashSaleProgramId` (nullable) để gắn badge ở giỏ + validate lại ở checkout (§5.2, §5.4).
3. VOUCHER không có field tên/mô tả chương trình → UI dùng nhãn cố định `Flash sale` + khung giờ (§2.1). Nếu admin cần đặt tên riêng (VD "Flash sale cuối tuần") thì bổ sung field `name` — quyết định ở màn admin 22.
