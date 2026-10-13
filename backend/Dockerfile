# Multi-stage build cho backend Spring Boot (Java 17).
# Render chạy Dockerfile này với build context = thư mục backend/.

# ---- Stage 1: build jar bằng Maven ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
# Tải dependencies trước để tận dụng Docker layer cache
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

# ---- Stage 2: chạy bằng JRE gọn nhẹ ----
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
# Render cấp cổng qua biến PORT (thường là 10000) — app PHẢI nghe đúng cổng này.
ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-8080} -jar app.jar"]
