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
class LogoShapeMigrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Test
    void v42BackfillsExistingRowsAndEnforcesSupportedValues() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target("41").load().migrate();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            sql.execute("INSERT INTO organizations(id,name,slug,owner_user_id,status,created_at,updated_at) "
                    + "VALUES(gen_random_uuid(),'Old org','old-org',gen_random_uuid(),'ACTIVE',now(),now())");
            sql.execute("INSERT INTO projects(id,name,slug,created_by,status,priority,visibility,created_at,updated_at) "
                    + "VALUES(gen_random_uuid(),'Old project','old-project',gen_random_uuid(),'PLANNING','MEDIUM','PRIVATE',now(),now())");
            var latest = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .locations("classpath:db/migration").target("42").load();
            assertEquals(1, latest.migrate().migrationsExecuted);
            for (String table : new String[]{"projects", "organizations"}) {
                try (var rows = sql.executeQuery("SELECT logo_shape FROM " + table)) {
                    assertTrue(rows.next());
                    assertEquals("SQUARE", rows.getString(1));
                }
                assertEquals(1, sql.executeUpdate("UPDATE " + table + " SET logo_shape='CIRCLE'"));
                assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE " + table + " SET logo_shape='TRIANGLE'"));
                assertThrows(SQLException.class, () -> sql.executeUpdate("UPDATE " + table + " SET logo_shape=NULL"));
            }
            latest.validate();
            assertEquals(0, latest.migrate().migrationsExecuted);
        }
    }
}
