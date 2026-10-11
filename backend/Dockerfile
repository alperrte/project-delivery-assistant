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

# An unprivileged account (uid 10001) for the application. The image still starts as root so the development compose
# keeps working with volumes created earlier; docker-compose.prod.yml starts it with `user: "10001:10001"`. The media
# directory is created here, owned by that account, so a NEW named volume mounted on it is writable by it.
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app \
    && mkdir -p /app/organization-media && chown app:app /app/organization-media

COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
