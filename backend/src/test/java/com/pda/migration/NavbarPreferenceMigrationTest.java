package com.pda.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.DriverManager;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers(disabledWithoutDocker = true)
class NavbarPreferenceMigrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Test
    void v47PreservesExistingPreferencesAndRestrictsNavbarChoices() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target("46").load().migrate();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) "
                    + "VALUES('00000000-0000-0000-0000-000000000043','navbar@example.test','navbar','ACTIVE','VERIFIED','USER',now(),now())");
            sql.execute("INSERT INTO user_preferences(user_id,locale,theme,motion,theme_transition,updated_at) "
                    + "VALUES('00000000-0000-0000-0000-000000000043','de','dark','off',false,now())");
            var latest = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .locations("classpath:db/migration").target("47").load();
            assertEquals(1, latest.migrate().migrationsExecuted);
            try (var rows = sql.executeQuery("SELECT locale,theme,motion,theme_transition,navbar_mode FROM user_preferences")) {
                assertTrue(rows.next());
                assertEquals("de", rows.getString(1));
                assertEquals("dark", rows.getString(2));
                assertEquals("off", rows.getString(3));
                assertFalse(rows.getBoolean(4));
                assertNull(rows.getString(5));
            }
            for (String mode : new String[]{"always-visible", "auto-hide"}) {
                assertEquals(1, sql.executeUpdate("UPDATE user_preferences SET navbar_mode='" + mode + "'"));
            }
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE user_preferences SET navbar_mode='invalid'"));
            latest.validate();
            assertEquals(0, latest.migrate().migrationsExecuted);
        }
    }
}
