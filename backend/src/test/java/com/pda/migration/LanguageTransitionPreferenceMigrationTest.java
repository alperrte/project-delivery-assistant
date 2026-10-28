package com.pda.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import com.pda.shared.testing.TestPostgres;

import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers(disabledWithoutDocker = true)
class LanguageTransitionPreferenceMigrationTest {
    @Container static TestPostgres postgres = new TestPostgres("postgres:18-alpine");

    @Test
    void v50AddsLanguageTransitionColumnAndPreservesExistingPreferences() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target("49").load().migrate();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) "
                    + "VALUES('00000000-0000-0000-0000-000000000050','langpref@example.test','langpref','ACTIVE','VERIFIED','USER',now(),now())");
            sql.execute("INSERT INTO user_preferences(user_id,locale,theme,motion,theme_transition,navbar_mode,updated_at) "
                    + "VALUES('00000000-0000-0000-0000-000000000050','en','dark','on',true,'always-visible',now())");
            var latest = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .locations("classpath:db/migration").target("50").load();
            assertEquals(1, latest.migrate().migrationsExecuted);
            try (var rows = sql.executeQuery("SELECT locale,theme,motion,theme_transition,navbar_mode,language_transition FROM user_preferences WHERE user_id = '00000000-0000-0000-0000-000000000050'")) {
                assertTrue(rows.next());
                assertEquals("en", rows.getString(1));
                assertEquals("dark", rows.getString(2));
                assertEquals("on", rows.getString(3));
                assertTrue(rows.getBoolean(4));
                assertEquals("always-visible", rows.getString(5));
                assertNull(rows.getObject(6)); // NULL for existing row before explicit choice
            }
            assertEquals(1, sql.executeUpdate("UPDATE user_preferences SET language_transition = false WHERE user_id = '00000000-0000-0000-0000-000000000050'"));
            try (var rows = sql.executeQuery("SELECT language_transition FROM user_preferences WHERE user_id = '00000000-0000-0000-0000-000000000050'")) {
                assertTrue(rows.next());
                assertFalse(rows.getBoolean(1));
            }
            latest.validate();
            assertEquals(0, latest.migrate().migrationsExecuted);
        }
    }
}
