package com.mocan.shop.config;

import com.mocan.shop.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Phân quyền 3 vai trò (01-SRE.md §3). Trang chủ public GET;
 * các endpoint còn lại yêu cầu JWT (sẽ mở rộng theo từng màn).
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
  private final JwtAuthFilter jwtAuthFilter;

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .csrf(csrf -> csrf.disable())
        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            // Preflight CORS (OPTIONS không mang credentials) phải qua trước mọi rule:
            // nếu không, browser nhận 403 ở preflight và mọi API cần đăng nhập đều lỗi.
            .requestMatchers(HttpMethod.OPTIONS, "/**")
            .permitAll()
            .requestMatchers(HttpMethod.GET,
                "/banners/**", "/categories/**", "/products/**", "/reviews/**", "/uploads/**",
                "/flash-sale/**")
            .permitAll()
            .requestMatchers("/auth/**", "/otp/**")
            .permitAll()
            .requestMatchers(HttpMethod.POST, "/cart/validate")
            .permitAll()
            // QUAN TRỌNG: matcher này phải đứng TRƯỚC "/shipping/**" hasRole ADMIN bên dưới —
            // Spring Security duyệt matcher theo thứ tự khai báo, dòng nào khớp trước thì thắng.
            .requestMatchers(HttpMethod.POST, "/shipping/quote", "/vouchers/validate")
            .permitAll()
            // IPN MoMo là server-to-server (MoMo gọi, không có JWT) — PUBLIC nhưng an toàn
            // nhờ verify chữ ký HMAC-SHA256 trong PaymentService trước mọi cập nhật.
            .requestMatchers(HttpMethod.POST, "/payments/momo/ipn")
            .permitAll()
            .requestMatchers("/reports/**", "/shipping/**")
            .hasRole("ADMIN")
            // Khu vực quản trị (màn 14–22): chỉ ADMIN — JWT mang ROLE_ADMIN.
            // Đặt TRƯỚC anyRequest().authenticated() để CUSTOMER bị 403 thay vì lọt qua.
            .requestMatchers("/admin/**")
            .hasRole("ADMIN")
            .anyRequest()
            .authenticated())
        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }
}
