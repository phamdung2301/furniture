package com.mocan.shop.dto;

import lombok.Data;

import java.util.List;

/**
 * Body PUT /admin/banners/reorder — TOÀN BỘ ids theo thứ tự mới
 * (admin-banner.md §3/§8). Service gán lại sortOrder thành dãy 1..n.
 */
@Data
public class AdminBannerReorderRequest {
  private List<String> ids;
}
