package com.mocan.shop.config;

import com.mocan.shop.model.User;
import com.mocan.shop.repository.UserRepository;
import com.mocan.shop.util.PhoneUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Bootstrap tài khoản ADMIN đầu tiên — màn 14–22 / FR-020..FR-029.
 *
 * Vì sao cần file này: AuthService.register() chỉ cấp ROLE_CUSTOMER và không
 * có endpoint/seed nào tạo ADMIN, trong khi SecurityConfig khóa toàn bộ
 * /admin/** bằng hasRole("ADMIN"). Không có bootstrap này, backend thật
 * (VITE_USE_MOCK=false) không bao giờ đăng nhập admin được — tài khoản
 * admin demo hiện tại chỉ tồn tại ở mock phía frontend.
 *
 * Cách dùng (chỉ qua ENV, tuyệt đối không hardcode mật khẩu):
 *   ADMIN_EMAIL=admin@mocan.vn ADMIN_PHONE=0909999999 \
 *   ADMIN_PASSWORD=<mat-khau-it-nhat-8-ky-tu> \
 *   ADMIN_FULL_NAME="Quan tri Moc An"  ./mvnw spring-boot:run
 * (hoặc đặt app.admin.* trong application.yml — đã khai sẵn với ${ADMIN_*}.)
 *
 * Hành vi:
 * - Thiếu/sai định dạng bất kỳ biến bắt buộc nào (email, phone VN hợp lệ,
 *   password >= 8) -> chỉ log WARN rồi bỏ qua, app vẫn khởi động bình thường.
 * - Đã có user với email hoặc phone đó:
 *     + đã có ROLE_ADMIN -> không đụng vào (không reset mật khẩu khi restart).
 *     + chưa có ROLE_ADMIN -> chỉ log WARN, KHÔNG tự nâng quyền tài khoản
 *       khách hàng sẵn có (tránh leo thang quyền ngoài ý muốn).
 * - Chưa có -> tạo user ACTIVE, phoneVerified=true (bắt buộc: AuthService
 *   chặn cấp token khi chưa xác thực SĐT theo FR-030), roles=[ROLE_ADMIN].
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrap implements CommandLineRunner {

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  @Value("${app.admin.email:}")
  private String adminEmail;

  @Value("${app.admin.password:}")
  private String adminPassword;

  @Value("${app.admin.phone:}")
  private String adminPhone;

  @Value("${app.admin.full-name:Quản trị Mộc An}")
  private String adminFullName;

  @Override
  public void run(String... args) {
    String email = adminEmail == null ? "" : adminEmail.trim().toLowerCase();
    String phone = PhoneUtil.normalize(adminPhone);
    String password = adminPassword == null ? "" : adminPassword;

    if (email.isEmpty() || password.isEmpty() || phone == null || phone.isEmpty()) {
      log.warn("AdminBootstrap: chua cau hinh ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_PHONE "
          + "-> bo qua tao tai khoan admin. Khu vuc /admin se khong dang nhap duoc "
          + "bang backend that cho den khi cac bien nay duoc dat.");
      return;
    }
    if (!PhoneUtil.isValidVn(phone)) {
      log.warn("AdminBootstrap: ADMIN_PHONE khong dung dinh dang SDT VN -> bo qua.");
      return;
    }
    if (password.length() < 8) {
      log.warn("AdminBootstrap: ADMIN_PASSWORD can it nhat 8 ky tu -> bo qua.");
      return;
    }

    Optional<User> byEmail = userRepository.findByEmail(email);
    Optional<User> byPhone = userRepository.findByPhone(phone);
    Optional<User> existing = byEmail.isPresent() ? byEmail : byPhone;
    if (existing.isPresent()) {
      User user = existing.get();
      if (user.getRoles() != null && user.getRoles().contains("ROLE_ADMIN")) {
        log.info("AdminBootstrap: tai khoan admin da ton tai ({}) -> giu nguyen, "
            + "khong reset mat khau.", email);
      } else {
        log.warn("AdminBootstrap: email/SDT nay da thuoc mot tai khoan khong phai ADMIN "
            + "-> khong tu nang quyen. Hay dung email/SDT khac cho ADMIN_*.");
      }
      return;
    }

    User admin = new User();
    admin.setFullName(adminFullName == null || adminFullName.isBlank()
        ? "Quản trị Mộc An" : adminFullName.trim());
    admin.setEmail(email);
    admin.setPhone(phone);
    admin.setPasswordHash(passwordEncoder.encode(password));
    admin.setPhoneVerified(true);
    admin.setRoles(List.of("ROLE_ADMIN"));
    admin.setStatus("ACTIVE");
    admin.setFailedLoginAttempts(0);
    admin.setCreatedAt(Instant.now());
    userRepository.save(admin);
    log.info("AdminBootstrap: da tao tai khoan ADMIN dau tien cho {} ({}). "
        + "Dang nhap bang email/SDT + ADMIN_PASSWORD, sau do nen doi mat khau.", email, phone);
  }
}
