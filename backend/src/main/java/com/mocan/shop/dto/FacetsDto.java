package com.mocan.shop.dto;

import lombok.Data;
import java.util.List;

/**
 * Tuỳ chọn filter động theo danh mục — khớp frontend getFacets().
 * colors: chỉ màu xuất hiện trong danh mục (inStock=false → chấm mờ + disabled ở FE).
 */
@Data
public class FacetsDto {
  private List<ColorOption> colors;
  private List<String> materials;

  @Data
  public static class ColorOption {
    private String name;
    private String colorHex;
    private boolean inStock;
  }
}
