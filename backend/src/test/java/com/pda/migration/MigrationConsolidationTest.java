package com.pda.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.Arrays;
import java.util.stream.IntStream;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.exception.FlywayValidateException;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Executes both histories on real PostgreSQL; the reference archive is independent of the rewritten SQL. */
class MigrationConsolidationTest {
    @TempDir
    Path legacyDirectory;

    @ParameterizedTest
    @ValueSource(strings = {"postgres:17-alpine", "postgres:18-alpine"})
    void finalSchemaMatchesLegacyAndOldHistoryCannotBeSilentlyUpgraded(String image) throws Exception {
        String legacyLocation = LegacyMigrations.extractTo(legacyDirectory);
        try (var postgres = new PostgreSQLContainer(image)) {
            postgres.start();
            Flyway legacy = flyway(postgres, "legacy", legacyLocation);
            Flyway consolidated = flyway(postgres, "consolidated", "classpath:db/migration");
            assertEquals(59, legacy.migrate().migrationsExecuted);
            assertEquals(40, consolidated.migrate().migrationsExecuted);
            legacy.validate();
            consolidated.validate();
            assertEquals(IntStream.rangeClosed(1, 40).mapToObj(String::valueOf).toList(),
                    Arrays.stream(consolidated.info().applied())
                            .filter(migration -> migration.getScript().endsWith(".sql"))
                            .map(migration -> migration.getVersion().toString()).toList(),
                    "fresh-install versions must be contiguous V1 through V40");
            assertEquals(0, consolidated.migrate().migrationsExecuted, "second startup is idempotent");
            try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
                List<String> expected = snapshot(connection, "legacy");
                assertTrue(expected.stream().filter(row -> row.startsWith("RELATION|")).count() == 55,
                        "reference contains all 55 application tables");
                assertEquals(expected, snapshot(connection, "consolidated"),
                        "tables, live column order/types/defaults/nullability, constraints, indexes and sequences must match");
            }
            Flyway incompatible = flyway(postgres, "legacy", "classpath:db/migration");
            assertThrows(FlywayValidateException.class, incompatible::validate,
                    "applied pre-consolidation databases must fail validation, never be repaired automatically");
            legacy.validate(); // The rejected validation must not mutate the original history.
        }
    }

    private static Flyway flyway(PostgreSQLContainer postgres, String schema, String location) {
        return Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .schemas(schema).defaultSchema(schema).locations(location).load();
    }

    private static List<String> snapshot(Connection connection, String schema) throws Exception {
        // Only fixed test-owned schema names can reach this identifier; neither user nor application data is used.
        if (!List.of("legacy", "consolidated").contains(schema)) {
            throw new IllegalArgumentException("Unexpected test schema");
        }
        try (var statement = connection.createStatement()) {
            statement.execute("SET search_path TO " + schema + ", pg_catalog");
        }
        String query = """
                WITH relations AS (
                    SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                    WHERE n.nspname=? AND c.relname <> 'flyway_schema_history'
                      AND c.relname NOT LIKE 'flyway_schema_history_%'
                )
                SELECT 'RELATION|' || relname || '|' || relkind::text || '|' || relpersistence::text
                    FROM relations WHERE relkind IN ('r','p','v','m','S','f')
                UNION ALL
                SELECT 'COLUMN|' || c.relname || '|' || a.attname || '|' || format_type(a.atttypid,a.atttypmod)
                    || '|' || a.attnotnull || '|' || coalesce(pg_get_expr(d.adbin,d.adrelid),'')
                    || '|' || a.attidentity::text || '|' || a.attgenerated::text
                    || '|' || row_number() OVER (PARTITION BY c.relname ORDER BY a.attnum)
                    FROM relations c JOIN pg_attribute a ON a.attrelid=c.oid
                    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
                    WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m','f')
                UNION ALL
                SELECT 'CONSTRAINT|' || c.relname || '|' || x.conname || '|' || x.contype::text
                    || '|' || pg_get_constraintdef(x.oid) || '|' || x.convalidated
                    || '|' || x.condeferrable || '|' || x.condeferred
                    FROM relations c JOIN pg_constraint x ON x.conrelid=c.oid
                UNION ALL
                SELECT 'INDEX|' || c.relname || '|' || pg_get_indexdef(i.indexrelid)
                    || '|' || i.indisvalid || '|' || i.indisready
                    FROM relations c JOIN pg_index i ON i.indrelid=c.oid
                UNION ALL
                SELECT 'SEQUENCE|' || c.relname || '|' || format_type(s.seqtypid,NULL)
                    || '|' || s.seqstart || '|' || s.seqincrement || '|' || s.seqmax
                    || '|' || s.seqmin || '|' || s.seqcache || '|' || s.seqcycle
                    FROM relations c JOIN pg_sequence s ON s.seqrelid=c.oid
                ORDER BY 1
                """;
        List<String> result = new ArrayList<>();
        try (var statement = connection.prepareStatement(query)) {
            statement.setString(1, schema);
            try (var rows = statement.executeQuery()) {
                while (rows.next()) {
                    result.add(rows.getString(1).replace(schema + ".", ""));
                }
            }
        }
        return result;
    }
}
