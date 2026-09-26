package com.pda.auth.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.sql.DriverManager;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers(disabledWithoutDocker = true)
class PendingLocalAccountMigrationTest {

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @Test
    void v4ActivatesExistingLocalPendingAccountsWithoutMarkingEmailVerified() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target(MigrationVersion.fromVersion("3"))
                .load().migrate();
        UUID userId = UUID.randomUUID();
        try (var connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var insert = connection.prepareStatement("""
                     INSERT INTO users (id, email, nickname, password_hash, account_status,
                                        email_verification_status, global_role, created_at, updated_at)
                     VALUES (?, ?, ?, ?, 'PENDING_VERIFICATION', 'PENDING', 'USER', ?, ?)
                     """)) {
            insert.setObject(1, userId);
            insert.setString(2, userId + "@example.test");
            insert.setString(3, "u" + userId.toString().replace("-", "").substring(0, 20));
            insert.setString(4, new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()));
            OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
            insert.setObject(5, now);
            insert.setObject(6, now);
            insert.executeUpdate();
        }
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").load().migrate();
        try (var connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var select = connection.prepareStatement(
                     "SELECT account_status, email_verification_status, email_verified_at FROM users WHERE id = ?")) {
            select.setObject(1, userId);
            try (var result = select.executeQuery()) {
                result.next();
                assertEquals("ACTIVE", result.getString(1));
                assertEquals("PENDING", result.getString(2));
                assertEquals(null, result.getObject(3));
            }
        }
    }
}
