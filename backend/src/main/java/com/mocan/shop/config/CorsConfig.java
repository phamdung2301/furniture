package com.mocan.shop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

/**
 * CORS — dev mặc định cho phép Vite :5173; production thêm origin của frontend
 * deploy qua biến CORS_ALLOWED_ORIGINS (nhiều origin phân cách bằng dấu phẩy).
 * VD: CORS_ALLOWED_ORIGINS=https://mocan-fe.onrender.com,http://localhost:5173
 */
@Configuration
public class CorsConfig {

  @Value("${CORS_ALLOWED_ORIGINS:http://localhost:5173}")
  private String allowedOrigins;

  @Bean
  public WebMvcConfigurer corsConfigurer() {
    String[] origins = Arrays.stream(allowedOrigins.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .toArray(String[]::new);
    return new WebMvcConfigurer() {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOrigins(origins)
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true);
      }
    };
  }
}
