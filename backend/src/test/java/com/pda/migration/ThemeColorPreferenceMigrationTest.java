package com.pda.migration;

import com.pda.shared.testing.TestPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.DriverManager;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class ThemeColorPreferenceMigrationTest {
    @Container static TestPostgres postgres = new TestPostgres("postgres:18-alpine");

    @Test
    void upgradesV59PreservesExistingChoicesAndEnforcesCanonicalColorsAndBounds() throws Exception {
        flyway("59").migrate();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) "
                    + "VALUES('00000000-0000-0000-0000-000000000060','theme@example.test','theme_fixture','ACTIVE','VERIFIED','USER',now(),now())");
            sql.execute("INSERT INTO user_preferences(user_id,locale,theme,motion,theme_transition,language_transition,navbar_mode,updated_at) "
                    + "VALUES('00000000-0000-0000-0000-000000000060','de','dark','off',false,false,'auto-hide','2026-01-01T00:00:00Z')");
            var latest = flyway("60");
            assertEquals(1, latest.migrate().migrationsExecuted);
            try (var rows = sql.executeQuery("SELECT * FROM user_preferences")) {
                assertTrue(rows.next());
                assertEquals("de", rows.getString("locale"));
                assertEquals("dark", rows.getString("theme"));
                assertEquals("off", rows.getString("motion"));
                assertFalse(rows.getBoolean("theme_transition"));
                assertFalse(rows.getBoolean("language_transition"));
                assertEquals("auto-hide", rows.getString("navbar_mode"));
                assertEquals(java.time.Instant.parse("2026-01-01T00:00:00Z"), rows.getTimestamp("updated_at").toInstant());
                assertEquals("SOLID", rows.getString("theme_type"));
                assertEquals("#1B5FE0", rows.getString("solid_color"));
                assertEquals("#1B5FE0", rows.getString("gradient_start_color"));
                assertEquals("#8B5CF6", rows.getString("gradient_end_color"));
                assertEquals(135, rows.getInt("gradient_angle"));
            }
            for (String assignment : new String[]{"theme_type='ANIMATED'", "theme_type=NULL", "solid_color='red'",
                    "solid_color='#aabbcc'", "solid_color='#fff'", "solid_color=NULL", "gradient_start_color='#XX0000'",
                    "gradient_end_color='#12345678'", "gradient_angle=-1", "gradient_angle=361", "gradient_angle=NULL"}) {
                assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE user_preferences SET " + assignment), assignment);
            }
            for (int angle : new int[]{0, 360}) {
                assertEquals(1, sql.executeUpdate("UPDATE user_preferences SET theme_type='GRADIENT', solid_color='#000000', "
                        + "gradient_start_color='#DEDEDE', gradient_end_color='#EFEFEF', gradient_angle=" + angle));
            }
            latest.validate();
            assertEquals(0, latest.migrate().migrationsExecuted);
            sql.execute("DELETE FROM users WHERE id='00000000-0000-0000-0000-000000000060'");
            try (var rows = sql.executeQuery("SELECT count(*) FROM user_preferences")) {
                assertTrue(rows.next());
                assertEquals(0, rows.getInt(1));
            }
        }
    }

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target(target).load();
    }
}
