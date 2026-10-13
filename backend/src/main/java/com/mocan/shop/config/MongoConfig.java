package com.mocan.shop.config;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;

/**
 * Cấu hình MongoDB TƯỜNG MINH — database được chỉ định rõ ràng qua biến môi trường,
 * không trông chờ vào default im lặng của driver (URI thiếu database → driver tự
 * dùng database "test" mà không báo lỗi).
 *
 * <p>Thứ tự ưu tiên giá trị: biến môi trường thật của OS > file backend/.env
 * (được tự nạp lúc khởi động) > giá trị mặc định bên dưới.</p>
 *
 * <p>Khi các bean này tồn tại, Spring Boot sẽ KHÔNG tự tạo MongoClient /
 * MongoDatabaseFactory / MongoTemplate nữa (ConditionalOnMissingBean), nên các
 * giá trị {@code spring.data.mongodb.*} trong application.yml không còn hiệu lực —
 * mọi thứ đi qua đúng database khai báo ở đây.</p>
 */
@Configuration
public class MongoConfig {

  @Value("${MONGODB_URI:mongodb://localhost:27017/mocan_shop}")
  private String mongoUri;

  @Value("${MONGODB_DATABASE:mocan_shop}")
  private String databaseName;

  @Bean(destroyMethod = "close")
  public MongoClient mongoClient() {
    return MongoClients.create(mongoUri);
  }

  @Bean
  public MongoDatabaseFactory mongoDbFactory(MongoClient mongoClient) {
    // databaseName tường minh — thắng database trong URI, không bao giờ rơi vào "test".
    return new SimpleMongoClientDatabaseFactory(mongoClient, databaseName);
  }

  @Bean
  public MongoTemplate mongoTemplate(MongoDatabaseFactory mongoDbFactory) {
    return new MongoTemplate(mongoDbFactory);
  }
}
