package com.mocan.shop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serve file upload (ảnh review...) tại /uploads/** từ thư mục
 * cấu hình app.upload.dir (mặc định "uploads" — thư mục làm việc của backend).
 * GET /uploads/** đã được permitAll trong SecurityConfig.
 */
@Configuration
public class UploadConfig implements WebMvcConfigurer {

  @Value("${app.upload.dir:uploads}")
  private String uploadDir;

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry.addResourceHandler("/uploads/**")
        .addResourceLocations("file:" + uploadDir + "/");
  }
}
