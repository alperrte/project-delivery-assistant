package com.pda.shared;

import static org.junit.jupiter.api.Assertions.*;

import com.pda.shared.testing.TestPostgres;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class TestPostgresIsolationTest {
    @Test
    void handlesShareTheServerButNeverTablesOrLifecycle() throws Exception {
        try (var first = new TestPostgres("postgres:17-alpine");
             var second = new TestPostgres("postgres:17-alpine")) {
            String firstUrl = first.getJdbcUrl(), secondUrl = second.getJdbcUrl();
            assertNotEquals(firstUrl, secondUrl);
            assertEquals(firstUrl.substring(0, firstUrl.lastIndexOf('/')), secondUrl.substring(0, secondUrl.lastIndexOf('/')));
            try (var a = DriverManager.getConnection(firstUrl, first.getUsername(), first.getPassword());
                 var b = DriverManager.getConnection(secondUrl, second.getUsername(), second.getPassword());
                 var sqlA = a.createStatement(); var sqlB = b.createStatement()) {
                sqlA.execute("CREATE TABLE isolation_probe(id int)");
                try (var rows = sqlB.executeQuery("SELECT to_regclass('public.isolation_probe')")) {
                    assertTrue(rows.next()); assertNull(rows.getString(1));
                }
                first.stop();
                try (var rows = sqlB.executeQuery("SELECT 1")) { assertTrue(rows.next()); assertEquals(1, rows.getInt(1)); }
                assertThrows(IllegalStateException.class, first::getJdbcUrl);
            }
        }
    }

    @Test
    void rejectsExternalOrUnreviewedDatabaseImages() {
        assertThrows(IllegalArgumentException.class, () -> new TestPostgres("postgres:latest"));
        assertThrows(IllegalArgumentException.class, () -> new TestPostgres("remote.example/postgres:17-alpine"));
    }
}
