package com.pda.admin.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

/**
 * V67 and V68 on an existing database: sessions that predate the administrator sign-in carry no administrator mark, and
 * the administrator's forced first-login password change flag is cleared without touching any other account.
 */
@Testcontainers(disabledWithoutDocker = true)
class AdminAuthMigrationTest {

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @Test
    void existingSessionsStayUnmarkedAndOnlyAdministratorsLoseTheForcedPasswordChange() throws Exception {
        migrateTo("66");
        UUID admin = insertUser("ADMIN", true);
        UUID member = insertUser("USER", true);
        UUID adminSession = insertSession(admin);

        migrateTo(null);

        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            assertFalse(flag(connection, admin), "the administrator is no longer forced to change the password");
            assertTrue(flag(connection, member), "no other account is touched");
            try (var select = connection.prepareStatement("SELECT admin_verified_at FROM user_sessions WHERE id = ?")) {
                select.setObject(1, adminSession);
                try (var result = select.executeQuery()) {
                    assertTrue(result.next());
                    assertNull(result.getObject(1), "a session from before the change is not administrator-verified");
                }
            }
            try (var count = connection.prepareStatement("SELECT count(*) FROM admin_auth_tickets");
                 var result = count.executeQuery()) {
                result.next();
                assertEquals(0, result.getInt(1));
            }
        }
    }

    private static void migrateTo(String version) {
        var configuration = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration");
        if (version != null) {
            configuration.target(MigrationVersion.fromVersion(version));
        }
        configuration.load().migrate();
    }

    private static UUID insertUser(String role, boolean mustChange) throws Exception {
        UUID id = UUID.randomUUID();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var insert = connection.prepareStatement("""
                     INSERT INTO users (id, email, nickname, password_hash, account_status, email_verification_status,
                                        global_role, must_change_password, created_at, updated_at)
                     VALUES (?, ?, ?, ?, 'ACTIVE', 'VERIFIED', ?, ?, ?, ?)
                     """)) {
            OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
            insert.setObject(1, id);
            insert.setString(2, id + "@example.test");
            insert.setString(3, "u" + id.toString().replace("-", "").substring(0, 20));
            insert.setString(4, new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()));
            insert.setString(5, role);
            insert.setBoolean(6, mustChange);
            insert.setObject(7, now);
            insert.setObject(8, now);
            insert.executeUpdate();
        }
        return id;
    }

    private static UUID insertSession(UUID userId) throws Exception {
        UUID id = UUID.randomUUID();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var insert = connection.prepareStatement("""
                     INSERT INTO user_sessions (id, user_id, refresh_token_hash, created_at, expires_at)
                     VALUES (?, ?, ?, ?, ?)
                     """)) {
            OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
            insert.setObject(1, id);
            insert.setObject(2, userId);
            insert.setString(3, "a".repeat(64));
            insert.setObject(4, now);
            insert.setObject(5, now.plusDays(7));
            insert.executeUpdate();
        }
        return id;
    }

    private static boolean flag(java.sql.Connection connection, UUID userId) throws Exception {
        try (var select = connection.prepareStatement("SELECT must_change_password FROM users WHERE id = ?")) {
            select.setObject(1, userId);
            try (var result = select.executeQuery()) {
                assertTrue(result.next());
                return result.getBoolean(1);
            }
        }
    }
}
