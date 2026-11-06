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
class AnimatedThemePreferenceMigrationTest {
    @Container static TestPostgres postgres = new TestPostgres("postgres:18-alpine");

    @Test
    void v61PreservesBothOldThemeTypesAndAddsSilentConstrainedAnimationPreferences() throws Exception {
        flyway("60").migrate();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            for (String type : new String[]{"SOLID", "GRADIENT"}) {
                String id = "SOLID".equals(type) ? "00000000-0000-0000-0000-000000000061" : "00000000-0000-0000-0000-000000000062";
                sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) "
                        + "VALUES('" + id + "','" + type + "@example.test','" + type + "','ACTIVE','VERIFIED','USER',now(),now())");
                sql.execute("INSERT INTO user_preferences(user_id,locale,theme,motion,theme_transition,language_transition,navbar_mode,updated_at,theme_type,solid_color,gradient_start_color,gradient_end_color,gradient_angle) "
                        + "VALUES('" + id + "','de','dark','off',false,false,'auto-hide','2026-01-01T00:00:00Z','" + type + "','#001122','#AABBCC','#DDEEFF',360)");
            }
            String legacyQuery = "SELECT json_agg(t ORDER BY user_id)::text FROM (SELECT user_id,locale,theme,motion,theme_transition,language_transition,navbar_mode,updated_at,theme_type,solid_color,gradient_start_color,gradient_end_color,gradient_angle FROM user_preferences) t";
            String before;
            try (var rows = sql.executeQuery(legacyQuery)) { assertTrue(rows.next()); before = rows.getString(1); }
            var latest = flyway("61");
            assertEquals(1, latest.migrate().migrationsExecuted);
            try (var rows = sql.executeQuery(legacyQuery)) { assertTrue(rows.next()); assertEquals(before, rows.getString(1)); }
            try (var rows = sql.executeQuery("SELECT * FROM user_preferences")) {
                int count = 0;
                while (rows.next()) {
                    count++;
                    assertEquals("THUNDERSTORM", rows.getString("animation_preset"));
                    assertFalse(rows.getBoolean("theme_sound_enabled"));
                    assertEquals(50, rows.getInt("theme_sound_volume"));
                    assertTrue(rows.getBoolean("theme_animation_enabled"));
                }
                assertEquals(2, count);
            }
            for (String assignment : new String[]{"theme_type='VIDEO'", "animation_preset='FOG'", "animation_preset='rain'",
                    "animation_preset=NULL", "theme_sound_enabled=NULL", "theme_sound_volume=-1", "theme_sound_volume=101",
                    "theme_sound_volume=NULL", "theme_animation_enabled=NULL"}) {
                assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE user_preferences SET " + assignment), assignment);
            }
            for (String preset : new String[]{"THUNDERSTORM", "RAIN", "SNOW", "WATER"}) for (int volume : new int[]{0, 100}) {
                assertEquals(2, sql.executeUpdate("UPDATE user_preferences SET theme_type='ANIMATED',animation_preset='" + preset
                        + "',theme_sound_enabled=true,theme_sound_volume=" + volume + ",theme_animation_enabled=false"));
            }
            latest.validate();
            assertEquals(0, latest.migrate().migrationsExecuted);
        }
    }

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target(target).load();
    }
}
