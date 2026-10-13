package com.mocan.shop.service;

import com.mocan.shop.dto.AddressDto;
import com.mocan.shop.dto.AddressRequest;
import com.mocan.shop.exception.ApiException;
import com.mocan.shop.model.Address;
import com.mocan.shop.repository.AddressRepository;
import com.mocan.shop.util.PhoneUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Sổ địa chỉ — F-011 / FR-009.
 * Tối đa 5 địa chỉ/user [Giả định]; luôn có đúng 1 mặc định;
 * xóa địa chỉ đang mặc định → chuyển mặc định sang địa chỉ còn lại đầu tiên.
 */
@Service
@RequiredArgsConstructor
public class AddressService {

  private static final int MAX_ADDRESSES = 5;

  private final AddressRepository addressRepository;

  public List<AddressDto> list(String userId) {
    List<Address> all = addressRepository.findByUserIdOrderByCreatedAtAsc(userId);
    ensureOneDefault(userId, all);
    return all.stream().map(this::toDto).collect(Collectors.toList());
  }

  public AddressDto create(String userId, AddressRequest req) {
    validate(req);
    long count = addressRepository.countByUserId(userId);
    if (count >= MAX_ADDRESSES) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "ADDRESS_LIMIT",
          "Bạn đã lưu tối đa 5 địa chỉ.");
    }
    boolean makeDefault = Boolean.TRUE.equals(req.getIsDefault()) || count == 0;
    if (makeDefault) clearDefault(userId);

    Address a = new Address();
    a.setUserId(userId);
    copy(req, a);
    a.setDefault(makeDefault);
    a.setCreatedAt(Instant.now());
    return toDto(addressRepository.save(a));
  }

  public AddressDto update(String userId, String id, AddressRequest req) {
    validate(req);
    Address a = addressRepository.findByIdAndUserId(id, userId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ADDRESS_NOT_FOUND",
            "Không tìm thấy địa chỉ."));
    copy(req, a);
    if (Boolean.TRUE.equals(req.getIsDefault())) {
      clearDefault(userId);
      a.setDefault(true);
    } else if (Boolean.FALSE.equals(req.getIsDefault())) {
      a.setDefault(false);
    }
    Address saved = addressRepository.save(a);
    ensureOneDefault(userId, addressRepository.findByUserIdOrderByCreatedAtAsc(userId));
    return toDto(saved);
  }

  public void delete(String userId, String id) {
    Address a = addressRepository.findByIdAndUserId(id, userId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ADDRESS_NOT_FOUND",
            "Không tìm thấy địa chỉ."));
    boolean wasDefault = a.isDefault();
    addressRepository.delete(a);
    if (wasDefault) {
      List<Address> rest = addressRepository.findByUserIdOrderByCreatedAtAsc(userId);
      if (!rest.isEmpty()) {
        Address first = rest.get(0);
        first.setDefault(true);
        addressRepository.save(first);
      }
    }
  }

  /** Đảm bảo bất biến "luôn có đúng 1 mặc định" nếu còn địa chỉ nào. */
  private void ensureOneDefault(String userId, List<Address> all) {
    if (all.isEmpty()) return;
    long defaults = all.stream().filter(Address::isDefault).count();
    if (defaults != 1) {
      List<Address> mutable = new ArrayList<>(all);
      for (Address a : mutable) a.setDefault(false);
      mutable.get(0).setDefault(true);
      addressRepository.saveAll(mutable);
      for (int i = 0; i < all.size(); i++) all.get(i).setDefault(mutable.get(i).isDefault());
    }
  }

  private void clearDefault(String userId) {
    List<Address> all = addressRepository.findByUserIdOrderByCreatedAtAsc(userId);
    boolean changed = false;
    for (Address a : all) {
      if (a.isDefault()) { a.setDefault(false); changed = true; }
    }
    if (changed) addressRepository.saveAll(all);
  }

  private void copy(AddressRequest req, Address a) {
    a.setLabel(req.getLabel() != null ? req.getLabel().trim() : null);
    a.setReceiverName(req.getReceiverName().trim());
    a.setPhone(PhoneUtil.normalize(req.getPhone()));
    a.setProvince(req.getProvince().trim());
    a.setDistrict(req.getDistrict().trim());
    a.setWard(req.getWard().trim());
    a.setDetail(req.getDetail().trim());
    a.setNote(req.getNote() != null ? req.getNote().trim() : null);
  }

  private void validate(AddressRequest req) {
    if (req == null) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ADDRESS",
        "Thiếu thông tin địa chỉ.");
    if (blank(req.getReceiverName())) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ADDRESS",
        "Vui lòng nhập họ tên người nhận.");
    String phone = PhoneUtil.normalize(req.getPhone());
    if (!PhoneUtil.isValidVn(phone)) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ADDRESS",
        "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).");
    if (blank(req.getProvince())) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ADDRESS",
        "Vui lòng chọn Tỉnh/Thành phố.");
    if (blank(req.getDistrict())) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ADDRESS",
        "Vui lòng chọn Quận/Huyện.");
    if (blank(req.getWard())) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ADDRESS",
        "Vui lòng chọn Phường/Xã.");
    if (blank(req.getDetail())) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ADDRESS",
        "Vui lòng nhập địa chỉ chi tiết (số nhà, đường).");
  }

  private boolean blank(String s) {
    return s == null || s.trim().isEmpty();
  }

  private AddressDto toDto(Address a) {
    AddressDto d = new AddressDto();
    d.setId(a.getId());
    d.setLabel(a.getLabel());
    d.setReceiverName(a.getReceiverName());
    d.setPhone(a.getPhone());
    d.setProvince(a.getProvince());
    d.setDistrict(a.getDistrict());
    d.setWard(a.getWard());
    d.setDetail(a.getDetail());
    d.setNote(a.getNote());
    d.setDefault(a.isDefault());
    d.setFullAddress(String.join(", ",
        nn(a.getDetail()), nn(a.getWard()), nn(a.getDistrict()), nn(a.getProvince())));
    return d;
  }

  private String nn(String s) {
    return s != null ? s : "";
  }
}
