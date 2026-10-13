package com.mocan.shop.config;

import com.mongodb.ConnectionString;
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
 * <p>Database được chốt theo thứ tự: database ghi sẵn trong MONGODB_URI (nếu có,
 * đúng thói quen project insurance của bạn) &gt; biến MONGODB_DATABASE &gt;
 * mặc định "mocan_shop". Không bao giờ để driver tự rơi vào database "test".</p>
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
    // Ưu tiên database ghi sẵn trong URI (đúng thói quen project insurance của bạn:
    // mongodb://localhost:27017/furniture -> dùng "furniture").
    // Chỉ khi URI không kèm database mới dùng MONGODB_DATABASE — không bao giờ
    // để driver lặng lẽ rơi vào database "test" (bài học 2026-10-13).
    String database = new ConnectionString(mongoUri).getDatabase();
    if (database == null || database.isBlank()) {
      database = databaseName;
    }
    return new SimpleMongoClientDatabaseFactory(mongoClient, database);
  }

  @Bean
  public MongoTemplate mongoTemplate(MongoDatabaseFactory mongoDbFactory) {
    return new MongoTemplate(mongoDbFactory);
  }
}
