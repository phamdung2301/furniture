package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/**
 * Response phân trang — shape khớp frontend catalogApi.getProducts().
 * page: 1-indexed (theo F-002 contract).
 */
@Data
public class PageResponseDto<T> {
  private List<T> content;
  private long totalElements;
  private int totalPages;
  private int page;
  private int size;

  public static <T> PageResponseDto<T> of(List<T> content, long totalElements, int page, int size) {
    PageResponseDto<T> r = new PageResponseDto<>();
    r.setContent(content);
    r.setTotalElements(totalElements);
    r.setTotalPages(size > 0 ? (int) Math.ceil((double) totalElements / size) : 0);
    r.setPage(page);
    r.setSize(size);
    return r;
  }
}
