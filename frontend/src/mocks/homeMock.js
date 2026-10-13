/**
 * Mock data màn Trang chủ — SHAPE Y HỆT response API tương lai (02-ERD.md).
 * Đổi VITE_USE_MOCK=false để gọi API thật, không sửa component.
 *
 * Ghi chú: BANNER có thêm title/subtitle/ctaText so với ERD gốc
 * (cần cho text overlay hero — đã bổ sung vào 02-ERD.md).
 */

const img = (f) => `/images/${f}`;

/* ---------------- Banners (F-001: theo sortOrder, chỉ active) ---------------- */
export const mockBanners = [
  {
    id: 'bn1',
    imageUrl: img('hero-living.jpg'),
    linkUrl: '/danh-muc/sofa',
    sortOrder: 1,
    active: true,
    title: 'Khai trương — Giảm đến 20% sofa phòng khách',
    subtitle: 'Từ 12/10 đến 31/10 · Áp dụng cho 50+ mẫu sofa',
    ctaText: 'Mua ngay',
  },
  {
    id: 'bn2',
    imageUrl: img('bed-walnut.jpg'),
    linkUrl: '/danh-muc/tu-quan-ao',
    sortOrder: 2,
    active: true,
    title: 'Bộ sưu tập Gỗ Óc Chó 2026',
    subtitle: 'Vân gỗ tự nhiên · Bảo hành 5 năm',
    ctaText: 'Khám phá',
  },
  {
    id: 'bn3',
    imageUrl: img('sofa-2.jpg'),
    linkUrl: '/flash-sale',
    sortOrder: 3,
    active: true,
    title: 'Flash sale cuối tuần',
    subtitle: 'Giảm sâu giờ vàng 20h – 22h mỗi tối',
    ctaText: 'Săn ngay',
  },
  {
    // Banner đã tắt — chỉ hiện ở màn Quản lý banner (admin-banner.md §2.2);
    // phía khách homeApi lọc active=true nên banner này không lên trang chủ.
    id: 'bn4',
    imageUrl: img('bedroom-2.png'),
    linkUrl: '/danh-muc/giuong-ngu',
    sortOrder: 4,
    active: false,
    title: 'Nội thất phòng ngủ — Ưu đãi tháng 10',
    subtitle: 'Trọn bộ giường + tủ đồng bộ gỗ tự nhiên',
    ctaText: 'Xem ngay',
  },
];

/* ---------------- Categories (F-001: tối đa 8) ---------------- */
export const mockCategories = [
  { id: 'c1', name: 'Sofa', slug: 'sofa', parentId: null, imageUrl: img('sofa-nordic.jpg'), sortOrder: 1, active: true },
  { id: 'c2', name: 'Bàn ăn', slug: 'ban-an', parentId: null, imageUrl: img('dining-set.jpg'), sortOrder: 2, active: true },
  { id: 'c3', name: 'Giường ngủ', slug: 'giuong-ngu', parentId: null, imageUrl: img('bed-walnut.jpg'), sortOrder: 3, active: true },
  { id: 'c4', name: 'Tủ quần áo', slug: 'tu-quan-ao', parentId: null, imageUrl: img('bedroom-2.png'), sortOrder: 4, active: true },
  { id: 'c5', name: 'Kệ tivi', slug: 'ke-tivi', parentId: null, imageUrl: img('tv-stand.jpg'), sortOrder: 5, active: true },
  { id: 'c6', name: 'Bàn làm việc', slug: 'ban-lam-viec', parentId: null, imageUrl: img('desk.jpg'), sortOrder: 6, active: true },
  { id: 'c7', name: 'Ghế', slug: 'ghe', parentId: null, imageUrl: img('dining-2.jpg'), sortOrder: 7, active: true },
  { id: 'c8', name: 'Đèn & Decor', slug: 'den-decor', parentId: null, imageUrl: img('floor-lamp.jpg'), sortOrder: 8, active: true },
];

/* ---------------- Products ----------------
   Biến thể theo dõi đến cấp MÀU (QĐ 2026-10-10):
   mỗi màu = sku/giá/tồn kho riêng. colorHex chỉ phục vụ hiển thị. */
const v = (id, productId, sku, color, colorHex, price, stock, extra = {}) => ({
  id,
  productId,
  sku,
  color,
  colorHex,
  price,
  stock,
  lowStockThreshold: 5,
  lengthM: 1.8,
  widthM: 0.9,
  sizeLabel: '1.8m x 0.9m',
  materialNote: '',
  ...extra,
});

const p = (o) => ({
  description: '',
  specs: {},
  basePrice: 0,
  images: [],
  ratingAvg: 0,
  ratingCount: 0,
  soldCount: 0,
  featured: false,
  active: true,
  createdAt: '2026-09-01T00:00:00Z',
  badge: null,
  variants: [],
  ...o,
});

export const mockFeaturedProducts = [
  p({
    id: 'p1', name: 'Sofa góc L Nordic', slug: 'sofa-goc-l-nordic', categoryId: 'c1',
    description: 'Sofa góc L phong cách Nordic bọc vải bố cao cấp, sợi dệt dày dặn, chống xù và dễ vệ sinh. Đệm ngồi mút D40 đàn hồi êm ái, khung gỗ thông tự nhiên đã qua xử lý chống mối mọt, chân gỗ sồi vát chắc chắn.\n\nThiết kế góc L linh hoạt đảo trái/phải, phù hợp phòng khách chung cư và nhà phố. Màu sắc trung tính dễ phối với mọi phong cách nội thất.',
    specs: { 'Kích thước': '2.4m x 1.6m', 'Kích thước chiếm chỗ': '2.4m × 1.6m', 'Chất liệu': 'Vải bố', 'Bảo hành': '24 tháng', 'Xuất xứ': 'Việt Nam' },
    images: [{ url: img('sofa-nordic.jpg'), sortOrder: 1 }],
    ratingAvg: 4.8, ratingCount: 126, soldCount: 340, featured: true,
    badge: { type: 'bestseller', label: 'BÁN CHẠY' },
    variants: [
      v('v11', 'p1', 'SF-NRD-XAM', 'Xám', '#9AA0A6', 12900000, 12, { images: [{ url: img('sofa-nordic.jpg'), sortOrder: 1 }], lengthM: 2.0, widthM: 1.9, sizeLabel: '2.0m x 1.9m' }),
      v('v12', 'p1', 'SF-NRD-BE', 'Be', '#E8DCC8', 12900000, 8, { images: [{ url: img('sofa-2.jpg'), sortOrder: 1 }], lengthM: 2.0, widthM: 1.9, sizeLabel: '2.0m x 1.9m' }),
      v('v13', 'p1', 'SF-NRD-NAU', 'Nâu', '#7B5E42', 13400000, 5, { lengthM: 2.0, widthM: 1.9, sizeLabel: '2.0m x 1.9m' }),
    ],
  }),
  p({
    id: 'p2', name: 'Giường ngủ gỗ óc chó 1m8', slug: 'giuong-ngu-go-oc-cho-1m8', categoryId: 'c3',
    description: 'Giường gỗ óc chó tự nhiên, vân gỗ đẹp, chắc chắn.',
    specs: { 'Kích thước': '1.8m x 2.0m', 'Chất liệu': 'Gỗ óc chó', 'Bảo hành': '60 tháng' },
    images: [{ url: img('bed-walnut.jpg'), sortOrder: 1 }],
    ratingAvg: 4.9, ratingCount: 89, soldCount: 210, featured: true,
    variants: [
      v('v21', 'p2', 'GN-OCCHO-NAU', 'Nâu óc chó', '#4A3226', 15500000, 7),
      v('v22', 'p2', 'GN-OCCHO-VANG', 'Vàng sồi', '#C8A165', 14900000, 4),
    ],
  }),
  p({
    id: 'p3', name: 'Bàn trà gỗ sồi', slug: 'ban-tra-go-soi', categoryId: 'c1',
    description: 'Bàn trà gỗ sồi mặt tròn, chân tiện mỹ nghệ.',
    specs: { 'Kích thước': 'Ø 0.9m', 'Chất liệu': 'Gỗ sồi', 'Bảo hành': '12 tháng' },
    images: [{ url: img('coffee-table.jpg'), sortOrder: 1 }],
    ratingAvg: 4.7, ratingCount: 203, soldCount: 512, featured: true,
    variants: [
      v('v31', 'p3', 'BT-SOI-TN', 'Tự nhiên', '#D9BE8C', 3450000, 20),
      v('v32', 'p3', 'BT-SOI-TRANG', 'Trắng', '#F5F5F5', 3650000, 15),
    ],
  }),
  p({
    id: 'p4', name: 'Tủ quần áo 3 cánh', slug: 'tu-quan-ao-3-canh', categoryId: 'c4',
    description: 'Tủ quần áo 3 cánh lùa, gỗ công nghiệp phủ melamine chống xước.',
    specs: { 'Kích thước': '1.8m x 0.6m', 'Chất liệu': 'Gỗ MDF', 'Bảo hành': '24 tháng' },
    images: [{ url: img('bedroom-2.png'), sortOrder: 1 }],
    ratingAvg: 4.6, ratingCount: 77, soldCount: 180, featured: true,
    variants: [
      v('v41', 'p4', 'TQA-TRANG', 'Trắng', '#F5F5F5', 8900000, 9),
      v('v42', 'p4', 'TQA-NAU', 'Nâu', '#7B5E42', 8900000, 6),
      v('v43', 'p4', 'TQA-XAM', 'Xám', '#9AA0A6', 9200000, 3),
    ],
  }),
  p({
    id: 'p13', name: 'Sofa da bò Ý', slug: 'sofa-da-bo-y', categoryId: 'c1',
    description: 'Sofa da bò Ý nhập khẩu, đường may thủ công.',
    specs: { 'Kích thước': '2.2m x 0.95m', 'Chất liệu': 'Da bò Ý', 'Bảo hành': '36 tháng' },
    images: [{ url: img('sofa-nordic.jpg'), sortOrder: 1 }],
    ratingAvg: 4.9, ratingCount: 45, soldCount: 60, featured: true,
    variants: [
      v('v131', 'p13', 'SF-DAY-NAU', 'Nâu', '#5A3A28', 18500000, 0),
      v('v132', 'p13', 'SF-DAY-DEN', 'Đen', '#2B2B2B', 18500000, 0),
    ],
  }),
];

export const mockBestSellers = [
  p({
    id: 'p5', name: 'Ghế ăn bọc vải', slug: 'ghe-an-boc-vai', categoryId: 'c7',
    description: 'Ghế ăn bọc vải êm ái, chân gỗ chắc chắn.',
    specs: { 'Kích thước': '0.45m x 0.5m', 'Chất liệu': 'Vải + gỗ', 'Bảo hành': '12 tháng' },
    images: [{ url: img('dining-2.jpg'), sortOrder: 1 }],
    ratingAvg: 4.8, ratingCount: 412, soldCount: 980,
    badge: { type: 'bestseller', label: 'BÁN CHẠY' },
    variants: [
      v('v51', 'p5', 'GA-VAI-XAM', 'Xám', '#9AA0A6', 1450000, 40, { lengthM: 0.5, widthM: 0.4, sizeLabel: '0.5m x 0.4m' }),
      v('v52', 'p5', 'GA-VAI-REU', 'Xanh rêu', '#6B7F5E', 1450000, 32, { lengthM: 0.5, widthM: 0.4, sizeLabel: '0.5m x 0.4m' }),
      v('v53', 'p5', 'GA-VAI-BE', 'Be', '#E8DCC8', 1450000, 25, { lengthM: 0.5, widthM: 0.4, sizeLabel: '0.5m x 0.4m' }),
    ],
  }),
  p({
    id: 'p6', name: 'Kệ tivi gỗ tự nhiên', slug: 'ke-tivi-go-tu-nhien', categoryId: 'c5',
    description: 'Kệ tivi gỗ tự nhiên 2 ngăn kéo, mặt đá chống xước.',
    specs: { 'Kích thước': '1.8m x 0.4m', 'Chất liệu': 'Gỗ tự nhiên', 'Bảo hành': '24 tháng' },
    images: [{ url: img('tv-stand.jpg'), sortOrder: 1 }],
    ratingAvg: 4.7, ratingCount: 356, soldCount: 870,
    variants: [
      v('v61', 'p6', 'KTV-TN', 'Tự nhiên', '#D9BE8C', 4200000, 18),
      v('v62', 'p6', 'KTV-NAUDAM', 'Nâu đậm', '#3E2A1E', 4400000, 11),
    ],
  }),
  p({
    id: 'p7', name: 'Bàn làm việc chân sắt', slug: 'ban-lam-viec-chan-sat', categoryId: 'c6',
    description: 'Bàn làm việc mặt gỗ chân sắt sơn tĩnh điện, chịu lực tốt.',
    specs: { 'Kích thước': '1.2m x 0.6m', 'Chất liệu': 'Gỗ + sắt', 'Bảo hành': '12 tháng' },
    images: [{ url: img('desk.jpg'), sortOrder: 1 }],
    ratingAvg: 4.6, ratingCount: 289, soldCount: 760,
    variants: [
      v('v71', 'p7', 'BLV-TRANG', 'Trắng', '#F5F5F5', 2750000, 22),
      v('v72', 'p7', 'BLV-DEN', 'Đen', '#2B2B2B', 2750000, 19),
      v('v73', 'p7', 'BLV-GO', 'Gỗ', '#A0714F', 2950000, 14),
    ],
  }),
  p({
    id: 'p8', name: 'Sofa băng 2 chỗ', slug: 'sofa-bang-2-cho', categoryId: 'c1',
    description: 'Sofa băng 2 chỗ nhỏ gọn, phù hợp căn hộ chung cư.',
    specs: { 'Kích thước': '1.8m x 0.9m', 'Chất liệu': 'Vải bố', 'Bảo hành': '24 tháng' },
    images: [{ url: img('sofa-2.jpg'), sortOrder: 1 }],
    ratingAvg: 4.7, ratingCount: 264, soldCount: 690,
    badge: { type: 'sale', label: '-15%' },
    variants: [
      v('v81', 'p8', 'SF2-BE', 'Be', '#E8DCC8', 9800000, 10),
      v('v82', 'p8', 'SF2-XAM', 'Xám', '#9AA0A6', 9800000, 7),
    ],
  }),
];

export const mockNewestProducts = [  p({
    id: 'p9', name: 'Đèn sàn trang trí', slug: 'den-san-trang-tri', categoryId: 'c8',
    description: 'Đèn sàn ánh sáng vàng ấm, chụp vải cao cấp.',
    specs: { 'Chiều cao': '1.6m', 'Chất liệu': 'Kim loại + vải', 'Bảo hành': '12 tháng' },
    images: [{ url: img('floor-lamp.jpg'), sortOrder: 1 }],
    ratingAvg: 5.0, ratingCount: 12, soldCount: 30, createdAt: '2026-10-05T00:00:00Z',
    badge: { type: 'new', label: 'MỚI' },
    variants: [
      v('v91', 'p9', 'DS-DEN', 'Đen', '#2B2B2B', 890000, 25),
      v('v92', 'p9', 'DS-VANGDONG', 'Vàng đồng', '#C9A227', 990000, 18),
    ],
  }),
  p({
    id: 'p10', name: 'Bàn console hành lang', slug: 'ban-console-hanh-lang', categoryId: 'c8',
    description: 'Bàn console kim loại mạ đồng, mặt kính cường lực.',
    specs: { 'Kích thước': '1.0m x 0.35m', 'Chất liệu': 'Kim loại + kính', 'Bảo hành': '12 tháng' },
    images: [{ url: img('side-table.jpg'), sortOrder: 1 }],
    ratingAvg: 5.0, ratingCount: 5, soldCount: 12, createdAt: '2026-10-03T00:00:00Z',
    badge: { type: 'new', label: 'MỚI' },
    variants: [v('v101', 'p10', 'BCS-VANGDONG', 'Vàng đồng', '#C9A227', 3100000, 8)],
  }),
  p({
    id: 'p11', name: 'Ghế lười hạt xốp', slug: 'ghe-luoi-hat-xop', categoryId: 'c7',
    description: 'Ghế lười hạt xốp êm ái, vỏ tháo giặt được.',
    specs: { 'Kích thước': 'Ø 0.9m', 'Chất liệu': 'Vải + xốp', 'Bảo hành': '6 tháng' },
    images: [{ url: img('beanbag.png'), sortOrder: 1 }],
    ratingAvg: 4.8, ratingCount: 31, soldCount: 85, createdAt: '2026-10-01T00:00:00Z',
    badge: { type: 'new', label: 'MỚI' },
    variants: [
      v('v111', 'p11', 'GL-XAM', 'Xám', '#9AA0A6', 650000, 30),
      v('v112', 'p11', 'GL-HONG', 'Hồng pastel', '#F2CFCF', 650000, 22),
      v('v113', 'p11', 'GL-XANH', 'Xanh', '#7FA6B8', 680000, 16),
    ],
  }),
];

/* ---------------- Bổ sung cho màn Danh mục (spec danh-muc.md §6.2) ----------------
   11 sản phẩm để demo lọc/phân trang có ý nghĩa. Shape y hệt ERD. */
export const mockCatalogExtra = [
  p({
    id: 'p14', name: 'Sofa vải 3 chỗ', slug: 'sofa-vai-3-cho', categoryId: 'c1',
    description: 'Sofa vải 3 chỗ dáng hiện đại, nệm êm, dễ vệ sinh.',
    specs: { 'Kích thước': '2.1m x 0.9m', 'Chất liệu': 'Vải bố', 'Bảo hành': '24 tháng' },
    images: [{ url: img('sofa-2.jpg'), sortOrder: 1 }],
    ratingAvg: 4.6, ratingCount: 58, soldCount: 190, createdAt: '2026-09-12T00:00:00Z',
    variants: [
      v('v141', 'p14', 'SFV3-XAM', 'Xám', '#9AA0A6', 7500000, 14, { lengthM: 2.1, widthM: 0.9, materialNote: 'Vải bố' }),
      v('v142', 'p14', 'SFV3-BE', 'Be', '#E8DCC8', 7500000, 9, { lengthM: 2.1, widthM: 0.9, materialNote: 'Vải bố' }),
    ],
  }),
  p({
    id: 'p15', name: 'Bàn ăn gỗ sồi 6 ghế', slug: 'ban-an-go-soi-6-ghe', categoryId: 'c2',
    description: 'Bộ bàn ăn gỗ sồi 6 ghế, mặt bàn chống thấm.',
    specs: { 'Kích thước': '1.8m x 0.9m', 'Chất liệu': 'Gỗ sồi', 'Bảo hành': '24 tháng' },
    images: [{ url: img('dining-set.jpg'), sortOrder: 1 }],
    ratingAvg: 4.7, ratingCount: 64, soldCount: 150, createdAt: '2026-08-20T00:00:00Z',
    variants: [
      v('v151', 'p15', 'BA-SOI-TN', 'Tự nhiên', '#D9BE8C', 12400000, 6, { lengthM: 1.8, widthM: 0.9, materialNote: 'Gỗ sồi' }),
    ],
  }),
  p({
    id: 'p16', name: 'Bàn ăn mặt đá 4 ghế', slug: 'ban-an-mat-da-4-ghe', categoryId: 'c2',
    description: 'Bàn ăn mặt đá 4 ghế chân kim loại, sang trọng.',
    specs: { 'Kích thước': '1.4m x 0.8m', 'Chất liệu': 'Đá + kim loại', 'Bảo hành': '24 tháng' },
    images: [{ url: img('dining-2.jpg'), sortOrder: 1 }],
    ratingAvg: 4.5, ratingCount: 41, soldCount: 98, createdAt: '2026-09-02T00:00:00Z',
    variants: [
      v('v161', 'p16', 'BA-DA-TRANG', 'Trắng', '#F5F5F5', 8900000, 8, { lengthM: 1.4, widthM: 0.8, materialNote: 'Đá + kim loại' }),
      v('v162', 'p16', 'BA-DA-DEN', 'Đen', '#2B2B2B', 8900000, 5, { lengthM: 1.4, widthM: 0.8, materialNote: 'Đá + kim loại' }),
    ],
  }),
  p({
    id: 'p17', name: 'Giường 1m6 gỗ sồi', slug: 'giuong-1m6-go-soi', categoryId: 'c3',
    description: 'Giường 1m6 gỗ sồi chắc chắn, đầu giường bọc nệm.',
    specs: { 'Kích thước': '1.6m x 2.0m', 'Chất liệu': 'Gỗ sồi', 'Bảo hành': '60 tháng' },
    images: [{ url: img('bed-walnut.jpg'), sortOrder: 1 }],
    ratingAvg: 4.6, ratingCount: 52, soldCount: 120, createdAt: '2026-08-28T00:00:00Z',
    variants: [
      v('v171', 'p17', 'G16-SOI-VANG', 'Vàng sồi', '#C8A165', 11200000, 7, { lengthM: 2.0, widthM: 1.6, materialNote: 'Gỗ sồi' }),
    ],
  }),
  p({
    id: 'p18', name: 'Tủ quần áo 2 cánh', slug: 'tu-quan-ao-2-canh', categoryId: 'c4',
    description: 'Tủ quần áo 2 cánh mở, nhiều ngăn treo đồ.',
    specs: { 'Kích thước': '1.2m x 0.6m', 'Chất liệu': 'Gỗ MDF', 'Bảo hành': '24 tháng' },
    images: [{ url: img('bedroom-2.png'), sortOrder: 1 }],
    ratingAvg: 4.5, ratingCount: 38, soldCount: 95, createdAt: '2026-09-08T00:00:00Z',
    variants: [
      v('v181', 'p18', 'TQA2-TRANG', 'Trắng', '#F5F5F5', 6500000, 11, { lengthM: 1.2, widthM: 0.6, materialNote: 'Gỗ MDF' }),
      v('v182', 'p18', 'TQA2-NAU', 'Nâu', '#7B5E42', 6500000, 6, { lengthM: 1.2, widthM: 0.6, materialNote: 'Gỗ MDF' }),
    ],
  }),
  p({
    id: 'p19', name: 'Kệ sách gỗ 5 tầng', slug: 'ke-sach-go-5-tang', categoryId: 'c5',
    description: 'Kệ sách gỗ 5 tầng, chịu lực tốt. Tạm xếp vào danh mục Kệ tivi.',
    specs: { 'Kích thước': '0.9m x 0.3m', 'Chất liệu': 'Gỗ tự nhiên', 'Bảo hành': '12 tháng' },
    images: [{ url: img('tv-stand.jpg'), sortOrder: 1 }],
    ratingAvg: 4.7, ratingCount: 29, soldCount: 70, createdAt: '2026-09-15T00:00:00Z',
    variants: [
      v('v191', 'p19', 'KS-TN', 'Tự nhiên', '#D9BE8C', 3200000, 13, { lengthM: 0.9, widthM: 0.3, materialNote: 'Gỗ tự nhiên' }),
    ],
  }),
  p({
    id: 'p20', name: 'Bàn làm việc chữ L', slug: 'ban-lam-viec-chu-l', categoryId: 'c6',
    description: 'Bàn làm việc chữ L rộng rãi, mặt gỗ chân sắt.',
    specs: { 'Kích thước': '1.4m x 1.4m', 'Chất liệu': 'Gỗ + sắt', 'Bảo hành': '12 tháng' },
    images: [{ url: img('desk.jpg'), sortOrder: 1 }],
    ratingAvg: 4.6, ratingCount: 47, soldCount: 110, createdAt: '2026-09-10T00:00:00Z',
    variants: [
      v('v201', 'p20', 'BLVL-TRANG', 'Trắng', '#F5F5F5', 4500000, 9, { lengthM: 1.4, widthM: 1.4, materialNote: 'Gỗ + sắt' }),
      v('v202', 'p20', 'BLVL-GO', 'Gỗ', '#A0714F', 4500000, 4, { lengthM: 1.4, widthM: 1.4, materialNote: 'Gỗ + sắt' }),
    ],
  }),
  p({
    id: 'p21', name: 'Ghế xoay văn phòng', slug: 'ghe-xoay-van-phong', categoryId: 'c7',
    description: 'Ghế xoay văn phòng lưng lưới thoáng mát, tay vịn điều chỉnh.',
    specs: { 'Kích thước': '0.65m x 0.65m', 'Chất liệu': 'Vải + nhựa', 'Bảo hành': '12 tháng' },
    images: [{ url: img('dining-2.jpg'), sortOrder: 1 }],
    ratingAvg: 4.5, ratingCount: 83, soldCount: 210, createdAt: '2026-08-15T00:00:00Z',
    variants: [
      v('v211', 'p21', 'GX-DEN', 'Đen', '#2B2B2B', 2200000, 26, { lengthM: 0.65, widthM: 0.65, materialNote: 'Vải + nhựa' }),
      v('v212', 'p21', 'GX-XAM', 'Xám', '#9AA0A6', 2200000, 18, { lengthM: 0.65, widthM: 0.65, materialNote: 'Vải + nhựa' }),
    ],
  }),
  p({
    id: 'p22', name: 'Đèn bàn học', slug: 'den-ban-hoc', categoryId: 'c8',
    description: 'Đèn bàn học chống cận, 3 chế độ sáng.',
    specs: { 'Chiều cao': '0.4m', 'Chất liệu': 'Kim loại', 'Bảo hành': '12 tháng' },
    images: [{ url: img('floor-lamp.jpg'), sortOrder: 1 }],
    ratingAvg: 4.4, ratingCount: 36, soldCount: 140, createdAt: '2026-09-18T00:00:00Z',
    variants: [
      v('v221', 'p22', 'DBH-TRANG', 'Trắng', '#F5F5F5', 550000, 30, { lengthM: 0.4, widthM: 0.25, materialNote: 'Kim loại' }),
      v('v222', 'p22', 'DBH-DEN', 'Đen', '#2B2B2B', 550000, 24, { lengthM: 0.4, widthM: 0.25, materialNote: 'Kim loại' }),
    ],
  }),
  p({
    id: 'p23', name: 'Gương trang trí tròn', slug: 'guong-trang-tri-tron', categoryId: 'c8',
    description: 'Gương trang trí tròn viền kim loại mạ đồng.',
    specs: { 'Đường kính': '0.8m', 'Chất liệu': 'Kính + kim loại', 'Bảo hành': '12 tháng' },
    images: [{ url: img('side-table.jpg'), sortOrder: 1 }],
    ratingAvg: 4.7, ratingCount: 22, soldCount: 55, createdAt: '2026-09-22T00:00:00Z',
    variants: [
      v('v231', 'p23', 'GTT-VANGDONG', 'Vàng đồng', '#C9A227', 1100000, 12, { lengthM: 0.8, widthM: 0.1, materialNote: 'Kính + kim loại' }),
    ],
  }),
  p({
    id: 'p24', name: 'Tủ giày thông minh', slug: 'tu-giay-thong-minh', categoryId: 'c4',
    description: 'Tủ giày cánh lật tiết kiệm diện tích, chứa 18 đôi.',
    specs: { 'Kích thước': '0.9m x 0.35m', 'Chất liệu': 'Gỗ MDF', 'Bảo hành': '12 tháng' },
    images: [{ url: img('bedroom-2.png'), sortOrder: 1 }],
    ratingAvg: 4.6, ratingCount: 19, soldCount: 48, createdAt: '2026-09-25T00:00:00Z',
    variants: [
      v('v241', 'p24', 'TG-TM-TRANG', 'Trắng', '#F5F5F5', 2300000, 15, { lengthM: 0.9, widthM: 0.35, materialNote: 'Gỗ MDF' }),
      v('v242', 'p24', 'TG-TM-NAU', 'Nâu', '#7B5E42', 2300000, 10, { lengthM: 0.9, widthM: 0.35, materialNote: 'Gỗ MDF' }),
    ],
  }),
];

/** Toàn bộ 23 sản phẩm — nguồn cho màn Danh mục (mock). */
export const mockAllProducts = [
  ...mockFeaturedProducts,
  ...mockBestSellers,
  ...mockNewestProducts,
  ...mockCatalogExtra,
];

/* ---------------- Reviews mẫu (F-012 / FR-017) ----------------
   5 review cho Sofa góc L Nordic (p1) — đúng spec §10 chi-tiet-san-pham.
   verifiedPurchase: chỉ đơn HOÀN THÀNH mới được đánh giá. */
const rimg = (f) => `/images/${f}`;

export const mockReviews = [
  {
    id: 'r1', productId: 'p1', userName: 'Minh Anh', rating: 5,
    comment: 'Sofa ngồi êm, vải bố dày dặn hơn mong đợi. Giao hàng cẩn thận.',
    images: [rimg('sofa-nordic.jpg'), rimg('sofa-2.jpg')],
    verifiedPurchase: true, createdAt: '2026-09-12T10:30:00Z',
  },
  {
    id: 'r2', productId: 'p1', userName: 'Hoàng Nam', rating: 5,
    comment: 'Màu xám đẹp, hợp phòng khách chung cư. Lắp đặt nhanh.',
    images: [],
    verifiedPurchase: true, createdAt: '2026-08-28T15:00:00Z',
  },
  {
    id: 'r3', productId: 'p1', userName: 'Thu Hằng', rating: 4,
    comment: 'Đệm hơi cứng tuần đầu, sau thì êm. Shop tư vấn nhiệt tình.',
    images: [],
    verifiedPurchase: true, createdAt: '2026-08-15T09:20:00Z',
  },
  {
    id: 'r4', productId: 'p1', userName: 'Đức Huy', rating: 5,
    comment: 'Đóng gói kỹ, không một vết xước. Sẽ ủng hộ tiếp.',
    images: [],
    verifiedPurchase: true, createdAt: '2026-08-02T14:45:00Z',
  },
  {
    id: 'r5', productId: 'p1', userName: 'Lan Phương', rating: 3,
    comment: 'Giao hơi chậm 2 ngày so với hẹn, nhưng sản phẩm ổn.',
    images: [],
    verifiedPurchase: true, createdAt: '2026-07-20T11:10:00Z',
  },
];
