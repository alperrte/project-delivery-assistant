package com.pda.notification;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class TaskStatusNotificationMigrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @Test void existingReadAndUnreadNotificationsSurviveAndIncompleteSnapshotsAreRejected() {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .target("55").load().migrate();
        JdbcTemplate db = new JdbcTemplate(new DriverManagerDataSource(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
        UUID user = UUID.randomUUID(), legacy = UUID.randomUUID(), read = UUID.randomUUID();
        db.update("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) "
                + "VALUES (?, 'migration@example.test', 'migration_user', 'ACTIVE', 'VERIFIED', 'USER', now(), now())", user);
        for (UUID id : new UUID[]{legacy, read}) {
            db.update("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,resource_type,resource_id) "
                    + "VALUES (?, ?, 'TASK_STATUS_CHANGED', 'Task status changed', 'Legacy message', ?, now(), 'TASK', ?)",
                    id, user, id.equals(read), UUID.randomUUID());
        }
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).load().migrate();
        assertEquals(2, db.queryForObject("SELECT count(*) FROM notifications", Integer.class));
        assertEquals("Legacy message", db.queryForObject("SELECT message FROM notifications WHERE id=?", String.class, legacy));
        assertFalse(db.queryForObject("SELECT is_read FROM notifications WHERE id=?", Boolean.class, legacy));
        assertTrue(db.queryForObject("SELECT is_read FROM notifications WHERE id=?", Boolean.class, read));
        assertNull(db.queryForObject("SELECT task_status_current FROM notifications WHERE id=?", String.class, legacy));
        assertThrows(DataIntegrityViolationException.class,
                () -> db.update("UPDATE notifications SET task_status_current='DONE' WHERE id=?", legacy));
        db.update("UPDATE notifications SET task_status_previous='IN_PROGRESS',task_status_current='DONE',task_key=?,task_title=?,actor_nickname=? WHERE id=?",
                "K".repeat(125), "T".repeat(160), "n".repeat(32), legacy);
        assertEquals("DONE", db.queryForObject("SELECT task_status_current FROM notifications WHERE id=?", String.class, legacy));
        assertThrows(DataIntegrityViolationException.class,
                () -> db.update("UPDATE notifications SET task_status_current='INVALID' WHERE id=?", legacy));
        assertThrows(DataIntegrityViolationException.class,
                () -> db.update("UPDATE notifications SET type='TASK_ASSIGNED' WHERE id=?", legacy));
    }
}
