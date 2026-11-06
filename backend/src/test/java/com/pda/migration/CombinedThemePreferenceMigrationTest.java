package com.pda.migration;

import com.pda.shared.testing.TestPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class CombinedThemePreferenceMigrationTest {
    @Container static TestPostgres postgres = new TestPostgres("postgres:18-alpine");

    @Test
    void v62PreservesEveryExistingPreferenceAndSupportsLongCombinedType() throws Exception {
        flyway("61").migrate();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            for (String type : new String[]{"SOLID", "GRADIENT", "ANIMATED"}) {
                UUID id = UUID.randomUUID();
                sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) "
                        + "VALUES('" + id + "','" + type + "@example.test','" + type + "','ACTIVE','VERIFIED','USER',now(),now())");
                sql.execute("INSERT INTO user_preferences(user_id,locale,theme,motion,theme_transition,language_transition,navbar_mode,updated_at,theme_type,solid_color,gradient_start_color,gradient_end_color,gradient_angle,animation_preset,theme_sound_enabled,theme_sound_volume,theme_animation_enabled) "
                        + "VALUES('" + id + "','de','dark','off',false,false,'auto-hide','2026-01-01T00:00:00Z','" + type
                        + "','#001122','#AABBCC','#DDEEFF',270,'WATER',true,73,false)");
            }
            String snapshot = "SELECT json_agg(p ORDER BY user_id)::text FROM user_preferences p";
            String before;
            try (var rows = sql.executeQuery(snapshot)) { assertTrue(rows.next()); before = rows.getString(1); }
            var latest = flyway("62");
            assertEquals(1, latest.migrate().migrationsExecuted);
            try (var rows = sql.executeQuery(snapshot)) { assertTrue(rows.next()); assertEquals(before, rows.getString(1)); }
            try (var rows = sql.executeQuery("SELECT character_maximum_length FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='theme_type'")) {
                assertTrue(rows.next()); assertEquals(24, rows.getInt(1));
            }
            for (String type : new String[]{"SOLID", "GRADIENT", "ANIMATED", "ANIMATED_GRADIENT"}) {
                assertEquals(3, sql.executeUpdate("UPDATE user_preferences SET theme_type='" + type + "'"));
            }
            for (String invalid : new String[]{"VIDEO", "animated_gradient", "GRADIENT_ANIMATED", "ANIMATED_GRADIENT_EXTRA"}) {
                assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE user_preferences SET theme_type='" + invalid + "'"));
            }
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE user_preferences SET theme_type=NULL"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE user_preferences SET theme_sound_volume=101"));
            assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE user_preferences SET gradient_angle=361"));
            latest.validate();
            assertEquals(0, latest.migrate().migrationsExecuted);
        }
    }

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target(target).load();
    }
}
