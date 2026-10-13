/**
 * Dữ liệu địa giới mẫu (rút gọn) cho form địa chỉ màn Đặt hàng — F-007.
 * Tỉnh/Thành phố -> Quận/Huyện -> Phường/Xã (dropdown phụ thuộc).
 * Production: thay bằng API địa giới thật, không sửa component.
 */
export const vnProvinces = [
  {
    name: 'TP. Hồ Chí Minh',
    districts: [
      { name: 'Quận 1', wards: ['Phường Bến Nghé', 'Phường Bến Thành', 'Phường Cầu Kho'] },
      { name: 'Quận 3', wards: ['Phường Võ Thị Sáu', 'Phường 9', 'Phường 14'] },
      { name: 'TP. Thủ Đức', wards: ['Phường Linh Trung', 'Phường Hiệp Bình Chánh', 'Phường Thảo Điền'] },
    ],
  },
  {
    name: 'Hà Nội',
    districts: [
      { name: 'Quận Hoàn Kiếm', wards: ['Phường Hàng Bạc', 'Phường Hàng Đào', 'Phường Tràng Tiền'] },
      { name: 'Quận Cầu Giấy', wards: ['Phường Dịch Vọng', 'Phường Nghĩa Đô', 'Phường Yên Hòa'] },
    ],
  },
  {
    name: 'Đà Nẵng',
    districts: [
      { name: 'Quận Hải Châu', wards: ['Phường Thạch Thang', 'Phường Hải Châu 1', 'Phường Phước Ninh'] },
      { name: 'Quận Sơn Trà', wards: ['Phường An Hải Bắc', 'Phường Mân Thái'] },
    ],
  },
  {
    name: 'Cần Thơ',
    districts: [
      { name: 'Quận Ninh Kiều', wards: ['Phường An Hòa', 'Phường Thới Bình', 'Phường Xuân Khánh'] },
    ],
  },
  {
    name: 'Bình Dương',
    districts: [
      { name: 'TP. Thủ Dầu Một', wards: ['Phường Phú Cường', 'Phường Hiệp Thành'] },
      { name: 'TP. Dĩ An', wards: ['Phường Dĩ An', 'Phường Tân Đông Hiệp'] },
    ],
  },
  {
    name: 'Đồng Nai',
    districts: [
      { name: 'TP. Biên Hòa', wards: ['Phường Quyết Thắng', 'Phường Tân Phong'] },
    ],
  },
];

export function findDistricts(provinceName) {
  return vnProvinces.find((p) => p.name === provinceName)?.districts || [];
}

export function findWards(provinceName, districtName) {
  return (
    findDistricts(provinceName).find((d) => d.name === districtName)?.wards || []
  );
}
