package com.mocan.shop.controller;

import com.mocan.shop.dto.AddressDto;
import com.mocan.shop.dto.AddressRequest;
import com.mocan.shop.service.AddressService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Sổ địa chỉ giao hàng — F-011 / FR-009.
 * userId = JWT subject (SecurityContextHolder), pattern như CartController.
 */
@RestController
@RequiredArgsConstructor
public class AddressController {

  private final AddressService addressService;

  @GetMapping("/addresses")
  public List<AddressDto> list() {
    return addressService.list(currentUserId());
  }

  @PostMapping("/addresses")
  @ResponseStatus(HttpStatus.CREATED)
  public AddressDto create(@RequestBody AddressRequest request) {
    return addressService.create(currentUserId(), request);
  }

  @PutMapping("/addresses/{id}")
  public AddressDto update(@PathVariable String id, @RequestBody AddressRequest request) {
    return addressService.update(currentUserId(), id, request);
  }

  @DeleteMapping("/addresses/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable String id) {
    addressService.delete(currentUserId(), id);
  }

  private String currentUserId() {
    return SecurityContextHolder.getContext().getAuthentication().getName();
  }
}
