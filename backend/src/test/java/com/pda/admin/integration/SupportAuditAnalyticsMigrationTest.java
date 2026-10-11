package com.pda.admin.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.nio.file.Path;
import com.pda.migration.LegacyMigrations;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.TestMethodOrder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * V69 (support requests), V70 (audit events) and V71 (call-to-action clicks and client errors) on a database that already
 * holds data: nothing existing is touched, the new tables start empty, their constraints refuse malformed rows and the
 * dependants of an analytics session follow it when it is deleted.
 */
@Testcontainers(disabledWithoutDocker = true)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SupportAuditAnalyticsMigrationTest {

    @TempDir
    static Path legacyDirectory;
    static String legacyLocation;

    @BeforeAll
    static void legacyHistory() throws Exception {
        legacyLocation = LegacyMigrations.extractTo(legacyDirectory);
    }

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    private static void migrateTo(String version) {
        var configuration = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations(legacyLocation);
        if (version != null) {
            configuration.target(MigrationVersion.fromVersion(version));
        }
        configuration.load().migrate();
    }

    private static Connection connection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private static void execute(Connection connection, String sql, Object... arguments) throws SQLException {
        try (var statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < arguments.length; i++) {
                statement.setObject(i + 1, arguments[i]);
            }
            statement.executeUpdate();
        }
    }

    private static long count(Connection connection, String table) throws SQLException {
        try (var statement = connection.prepareStatement("SELECT count(*) FROM " + table);
             var result = statement.executeQuery()) {
            result.next();
            return result.getLong(1);
        }
    }

    private static List<String> columns(Connection connection, String table) throws SQLException {
        List<String> columns = new ArrayList<>();
        try (var statement = connection.prepareStatement(
                "SELECT column_name FROM information_schema.columns WHERE table_name = ? ORDER BY column_name")) {
            statement.setString(1, table);
            try (var result = statement.executeQuery()) {
                while (result.next()) {
                    columns.add(result.getString(1));
                }
            }
        }
        return columns;
    }

    @Test
    @Order(1)
    void theNewTablesArriveEmptyNextToUntouchedExistingData() throws Exception {
        migrateTo("68");
        UUID contact = UUID.randomUUID();
        UUID session = UUID.randomUUID();
        try (Connection connection = connection()) {
            execute(connection, "INSERT INTO contact_requests (id, created_at, delivery_status) VALUES (?, now(), 'SENT')", contact);
            execute(connection, """
                    INSERT INTO analytics_sessions (id, visitor_id, started_at, last_seen_at, engaged_seconds, page_views,
                        entry_path, source_type, consent_version)
                    VALUES (?, ?, now(), now(), 5, 1, '/', 'DIRECT', 1)
                    """, session, UUID.randomUUID());
            execute(connection, "INSERT INTO analytics_page_views (id, session_id, path, occurred_at) VALUES (?, ?, '/', now())",
                    UUID.randomUUID(), session);
        }

        migrateTo(null);

        try (Connection connection = connection()) {
            assertEquals(1, count(connection, "contact_requests"), "the content-free delivery records stay as they were");
            assertEquals(List.of("created_at", "delivery_status", "id"), columns(connection, "contact_requests"));
            assertEquals(1, count(connection, "analytics_sessions"));
            assertEquals(1, count(connection, "analytics_page_views"));
            for (String table : new String[] {"support_requests", "admin_audit_events", "analytics_cta_clicks",
                    "analytics_client_errors"}) {
                assertEquals(0, count(connection, table), table);
            }
            assertEquals(List.of("category", "created_at", "delivery_status", "email", "first_name", "id", "last_name",
                    "message", "status", "status_changed_at"), columns(connection, "support_requests"));
            assertEquals(List.of("action", "actor_user_id", "id", "occurred_at", "outcome", "target_id", "target_type"),
                    columns(connection, "admin_audit_events"));
            assertEquals(List.of("cta_id", "id", "occurred_at", "session_id"), columns(connection, "analytics_cta_clicks"));
            assertEquals(List.of("error_kind", "id", "occurred_at", "path", "session_id"),
                    columns(connection, "analytics_client_errors"));
        }
    }

    @Test
    @Order(2)
    void theConstraintsRefuseMalformedRowsAndTheLastNameMayBeEmpty() throws Exception {
        migrateTo(null);
        try (Connection connection = connection()) {
            String support = """
                    INSERT INTO support_requests (id, created_at, category, first_name, last_name, email, message, status,
                                                  status_changed_at, delivery_status)
                    VALUES (?, now(), ?, 'Ece', NULL, 'a@b.co', 'Bir mesaj gövdesi.', ?, now(), ?)
                    """;
            execute(connection, support, UUID.randomUUID(), "DATA_REQUEST", "IN_PROGRESS", "FAILED");
            for (Object[] bad : new Object[][] {{"SALES", "NEW", "SENT"}, {"BUG", "DONE", "SENT"}, {"BUG", "NEW", "QUEUED"}}) {
                assertThrows(SQLException.class, () -> execute(connection, support, UUID.randomUUID(), bad[0], bad[1], bad[2]));
            }
            assertThrows(SQLException.class, () -> execute(connection, """
                    INSERT INTO support_requests (id, created_at, category, first_name, email, message, status_changed_at,
                                                  delivery_status)
                    VALUES (?, now(), 'GENERAL', 'Ece', 'a@b.co', ?, now(), 'SENT')
                    """, UUID.randomUUID(), "x".repeat(5_001)));

            String audit = """
                    INSERT INTO admin_audit_events (id, occurred_at, actor_user_id, action, target_type, target_id, outcome)
                    VALUES (?, now(), NULL, ?, ?, NULL, ?)
                    """;
            execute(connection, audit, UUID.randomUUID(), "ADMIN_SIGN_IN", "SYSTEM", "DENIED");
            for (Object[] bad : new Object[][] {{"DELETE_EVERYTHING", "SYSTEM", "SUCCESS"}, {"USER_DISABLE", "PROJECT", "SUCCESS"},
                    {"USER_DISABLE", "USER", "MAYBE"}}) {
                assertThrows(SQLException.class, () -> execute(connection, audit, UUID.randomUUID(), bad[0], bad[1], bad[2]));
            }

            UUID session = UUID.randomUUID();
            execute(connection, """
                    INSERT INTO analytics_sessions (id, visitor_id, started_at, last_seen_at, engaged_seconds, page_views,
                        entry_path, source_type, consent_version)
                    VALUES (?, ?, now(), now(), 0, 0, '/', 'DIRECT', 1)
                    """, session, UUID.randomUUID());
            String cta = "INSERT INTO analytics_cta_clicks (id, session_id, cta_id, occurred_at) VALUES (?, ?, ?, now())";
            execute(connection, cta, UUID.randomUUID(), session, "landing_register");
            for (String bad : new String[] {"Landing Register", "landing-register", "<script>", "", "9lives"}) {
                assertThrows(SQLException.class, () -> execute(connection, cta, UUID.randomUUID(), session, bad), bad);
            }
            assertThrows(SQLException.class, () -> execute(connection, cta, UUID.randomUUID(), UUID.randomUUID(), "landing_login"));
            String error = "INSERT INTO analytics_client_errors (id, session_id, path, error_kind, occurred_at) VALUES (?, ?, '/', ?, now())";
            execute(connection, error, UUID.randomUUID(), session, "CHUNK_LOAD");
            assertThrows(SQLException.class, () -> execute(connection, error, UUID.randomUUID(), session, "TypeError"));
            assertThrows(SQLException.class, () -> execute(connection, error, UUID.randomUUID(), session, "render"));

            // Deleting the session takes its clicks and errors along.
            assertEquals(1, count(connection, "analytics_cta_clicks"));
            assertEquals(1, count(connection, "analytics_client_errors"));
            execute(connection, "DELETE FROM analytics_sessions WHERE id = ?", session);
            assertEquals(0, count(connection, "analytics_cta_clicks"));
            assertEquals(0, count(connection, "analytics_client_errors"));
            assertTrue(count(connection, "support_requests") >= 1);
        }
    }
}
