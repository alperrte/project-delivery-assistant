package com.pda.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeAll;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class MeetingV59MigrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");
    static final String OWNER = "00000000-0000-0000-0000-000000000001";
    static final String ATTENDEE = "00000000-0000-0000-0000-000000000002";
    static final String PROJECT = "00000000-0000-0000-0000-0000000000f1";
    static final String OLD = "00000000-0000-0000-0000-0000000000a1";
    static final String LINKED = "00000000-0000-0000-0000-0000000000a2";
    static final String SOLO = "00000000-0000-0000-0000-0000000000a3";

    @BeforeAll static void isolatedDatabases() throws SQLException {
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            for (String database : List.of("upgrade57", "upgrade58", "fresh59", "dependency59"))
                sql.execute("CREATE DATABASE " + database);
        }
    }

    static String url(String database) {
        return postgres.getJdbcUrl().replace("/" + postgres.getDatabaseName(), "/" + database);
    }

    Flyway flyway(String schema, String target) {
        return Flyway.configure().dataSource(url(schema), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").schemas(schema).defaultSchema(schema).target(target).load();
    }

    Connection connection(String schema) throws SQLException {
        var connection = DriverManager.getConnection(url(schema), postgres.getUsername(), postgres.getPassword());
        connection.setSchema(schema);
        return connection;
    }

    static String one(Statement sql, String query) throws SQLException {
        try (var rows = sql.executeQuery(query)) { assertTrue(rows.next()); return rows.getString(1); }
    }

    static void meeting(Statement sql, String id, String project, String room) throws SQLException {
        sql.execute("INSERT INTO meetings(id,project_id,organizer_id,title,starts_at,ends_at,zone_id,status,room_name,created_at,updated_at) VALUES ('"
                + id + "'," + (project == null ? "NULL" : "'" + project + "'") + ",'" + OWNER
                + "','Synthetic migration fixture',now()+interval '1 day',now()+interval '2 days','UTC','SCHEDULED','" + room + "',now(),now())");
    }

    static void fixture(Statement sql) throws SQLException {
        for (String id : List.of(OWNER, ATTENDEE))
            sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES ('"
                    + id + "','" + id + "@example.test','n" + id.substring(24) + "','ACTIVE','VERIFIED','USER',now(),now())");
        sql.execute("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) VALUES ('"
                + PROJECT + "','Synthetic project','migration-project','ACTIVE','MEDIUM','PRIVATE','" + OWNER + "',now(),now())");
        meeting(sql, OLD, PROJECT, "old-room");
        sql.execute("INSERT INTO meeting_attendees(meeting_id,user_id) VALUES ('" + OLD + "','" + ATTENDEE + "')");
        sql.execute("INSERT INTO meeting_participants(id,meeting_id,user_id,identity,display_name) VALUES (gen_random_uuid(),'" + OLD + "','" + ATTENDEE + "','user-a','Synthetic attendee')");
        sql.execute("INSERT INTO meeting_agenda(meeting_id,position,content) VALUES ('" + OLD + "',0,'Synthetic agenda')");
    }

    // Compare every field of every meeting-owned row, including timestamps, except the intentionally removed archive.
    static Map<String, List<String>> snapshot(Connection connection) throws SQLException {
        var tables = new ArrayList<String>();
        try (var sql = connection.createStatement(); var rows = sql.executeQuery("SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name LIKE 'meeting%' ORDER BY table_name")) {
            while (rows.next()) tables.add(rows.getString(1));
        }
        var snapshot = new TreeMap<String, List<String>>();
        for (String table : tables) {
            var values = new ArrayList<String>();
            try (var sql = connection.createStatement(); var rows = sql.executeQuery("SELECT (to_jsonb(t)-'legacy_project_id')::text FROM \"" + table + "\" t ORDER BY 1")) {
                while (rows.next()) values.add(rows.getString(1));
            }
            snapshot.put(table, values);
        }
        return snapshot;
    }

    static void schemaAssertions(Statement sql) throws SQLException {
        assertEquals("0", one(sql, "SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='meetings' AND column_name='legacy_project_id'"));
        assertEquals("YES", one(sql, "SELECT is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='meetings' AND column_name='project_id'"));
        assertEquals("FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL", one(sql, "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='meetings'::regclass AND conname='meetings_project_id_fkey'"));
        assertEquals("1", one(sql, "SELECT count(*) FROM pg_indexes WHERE schemaname=current_schema() AND tablename='meetings' AND indexname='meeting_project_idx'"));
    }

    @Test void v57UpgradePreservesOldMeetingsAsIndependentAndAllTheirRelatedRows() throws Exception {
        String schema = "upgrade57";
        flyway(schema, "57").migrate();
        try (var connection = connection(schema); var sql = connection.createStatement()) {
            fixture(sql);
            flyway(schema, "58").migrate();
            assertEquals(PROJECT, one(sql, "SELECT legacy_project_id FROM meetings WHERE id='" + OLD + "'"));
            var before = snapshot(connection);
            assertEquals(1, flyway(schema, "59").migrate().migrationsExecuted);
            assertEquals(before, snapshot(connection));
            assertEquals("0", one(sql, "SELECT count(project_id) FROM meetings"));
            schemaAssertions(sql);
        }
    }

    @Test void v58UpgradePreservesHybridDataAndProjectDeletionOnlyClearsTheActiveLink() throws Exception {
        String schema = "upgrade58";
        flyway(schema, "57").migrate();
        try (var connection = connection(schema); var sql = connection.createStatement()) {
            fixture(sql);
            flyway(schema, "58").migrate();
            meeting(sql, LINKED, PROJECT, "linked-room");
            meeting(sql, SOLO, null, "solo-room");
            sql.execute("INSERT INTO meeting_attendees(meeting_id,user_id) VALUES ('" + LINKED + "','" + ATTENDEE + "')");
            sql.execute("INSERT INTO meeting_participants(id,meeting_id,user_id,identity,display_name) VALUES (gen_random_uuid(),'" + LINKED + "','" + ATTENDEE + "','user-b','Synthetic attendee')");
            // Another schema's namesake must never be altered by the migration.
            sql.execute("CREATE SCHEMA decoy59");
            sql.execute("CREATE TABLE decoy59.meetings (legacy_project_id uuid)");
            sql.execute("INSERT INTO decoy59.meetings VALUES ('" + PROJECT + "')");
            var before = snapshot(connection);
            assertEquals(1, flyway(schema, "59").migrate().migrationsExecuted);
            assertEquals(before, snapshot(connection));
            schemaAssertions(sql);
            assertEquals(PROJECT, one(sql, "SELECT project_id FROM meetings WHERE id='" + LINKED + "'"));
            assertEquals(PROJECT, one(sql, "SELECT legacy_project_id FROM decoy59.meetings"));
            sql.execute("DELETE FROM projects WHERE id='" + PROJECT + "'");
            assertEquals("3", one(sql, "SELECT count(*) FROM meetings"));
            assertEquals("0", one(sql, "SELECT count(project_id) FROM meetings"));
            assertEquals("2", one(sql, "SELECT count(*) FROM meeting_attendees"));
            assertEquals("2", one(sql, "SELECT count(*) FROM meeting_participants"));
            assertEquals("2", one(sql, "SELECT count(*) FROM meetings WHERE organizer_id='" + OWNER + "' AND id IN ('" + OLD + "','" + LINKED + "')"));
            flyway(schema, "59").validate();
            assertEquals(0, flyway(schema, "59").migrate().migrationsExecuted);
        }
    }

    @Test void cleanDatabaseRunsTheWholeHistoryAndValidates() throws Exception {
        var latest = flyway("fresh59", "59");
        assertEquals(59, latest.migrate().migrationsExecuted);
        latest.validate();
        try (var connection = connection("fresh59"); var sql = connection.createStatement()) { schemaAssertions(sql); }
        assertEquals(0, latest.migrate().migrationsExecuted);
    }

    @Test void unexpectedDependentViewBlocksTheDropWithoutCascading() throws Exception {
        String schema = "dependency59";
        flyway(schema, "58").migrate();
        try (var connection = connection(schema); var sql = connection.createStatement()) {
            sql.execute("CREATE VIEW legacy_reference AS SELECT legacy_project_id FROM meetings");
            assertThrows(org.flywaydb.core.api.FlywayException.class, () -> flyway(schema, "59").migrate());
            assertEquals("1", one(sql, "SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='meetings' AND column_name='legacy_project_id'"));
            assertEquals("0", one(sql, "SELECT count(*) FROM legacy_reference"));
            assertEquals("58", one(sql, "SELECT max(version::int) FROM flyway_schema_history WHERE success"));
        }
    }
}
