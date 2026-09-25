# -----------------------------
# 1️⃣ Build Stage
# -----------------------------
FROM maven:3.9.16-eclipse-temurin-25 AS builder

WORKDIR /build

# Dependency cache
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Source code
COPY src ./src

# Build
RUN mvn clean package -DskipTests -B


# -----------------------------
# 2️⃣ Runtime Stage
# -----------------------------
FROM eclipse-temurin:25-jre-alpine

WORKDIR /app

COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]