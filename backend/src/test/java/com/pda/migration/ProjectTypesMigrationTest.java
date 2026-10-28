package com.pda.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import com.pda.shared.testing.TestPostgres;
import java.sql.DriverManager;
import java.sql.SQLException;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers(disabledWithoutDocker = true)
class ProjectTypesMigrationTest {
    @Container static TestPostgres postgres = new TestPostgres("postgres:18-alpine");

    @Test
    void upgradePreservesEveryLegacyTypeAndEnforcesANonemptyUniqueEnumSet() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target("47").load().migrate();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            for (String type : new String[]{"WEB", "MOBILE", "AI", "DESKTOP", "OTHER"}) {
                sql.execute("INSERT INTO projects(id,name,slug,created_by,status,priority,visibility,project_type,created_at,updated_at) "
                        + "VALUES(gen_random_uuid(),'Legacy " + type + "','legacy-" + type + "',gen_random_uuid(),'PLANNING','MEDIUM','PRIVATE','" + type + "',now(),now())");
            }
            var latest = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .locations("classpath:db/migration").target("48").load();
            assertEquals(1, latest.migrate().migrationsExecuted);
            try (var rows = sql.executeQuery("SELECT project_type,project_types,name FROM projects")) {
                int count = 0;
                while (rows.next()) {
                    count++;
                    assertArrayEquals(new String[]{rows.getString(1)}, (String[]) rows.getArray(2).getArray());
                    assertEquals("Legacy " + rows.getString(1), rows.getString(3));
                }
                assertEquals(5, count);
            }
            assertEquals(5, sql.executeUpdate("UPDATE projects SET project_types=ARRAY['WEB','MOBILE','OTHER']"));
            for (String invalid : new String[]{"ARRAY[]::varchar[]", "ARRAY['WEB','WEB']", "ARRAY['UNKNOWN']", "ARRAY['WEB',NULL]", "NULL"}) {
                assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE projects SET project_types=" + invalid));
            }
            latest.validate();
        }
    }
}
