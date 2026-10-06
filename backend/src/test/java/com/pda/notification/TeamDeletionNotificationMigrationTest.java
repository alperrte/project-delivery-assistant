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
class TeamDeletionNotificationMigrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @Test void v56HistorySurvivesAndEventDedupAndSnapshotConstraintsAreEnforced() {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .target("56").load().migrate();
        JdbcTemplate db = new JdbcTemplate(new DriverManagerDataSource(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), old = UUID.randomUUID();
        for (UUID user : new UUID[]{a, b}) {
            db.update("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) "
                    + "VALUES (?, ?, ?, 'ACTIVE', 'VERIFIED', 'USER', now(), now())", user,
                    user + "@example.test", user.toString().substring(0, 16));
        }
        db.update("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,read_at,resource_type,resource_id,"
                        + "task_status_previous,task_status_current,task_key,task_title,actor_nickname) "
                        + "VALUES (?, ?, 'TASK_STATUS_CHANGED', 'Task completed', 'Old snapshot', true, now(), now(), 'TASK', ?,"
                        + "'IN_PROGRESS','DONE','PDA-1','Old task','actor')", old, a, UUID.randomUUID());
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).load().migrate();
        assertEquals("Old snapshot", db.queryForObject("SELECT message FROM notifications WHERE id=?", String.class, old));
        assertTrue(db.queryForObject("SELECT is_read FROM notifications WHERE id=?", Boolean.class, old));
        assertNotNull(db.queryForObject("SELECT read_at FROM notifications WHERE id=?", java.sql.Timestamp.class, old));
        assertEquals("DONE", db.queryForObject("SELECT task_status_current FROM notifications WHERE id=?", String.class, old));
        assertNull(db.queryForObject("SELECT popup_presented_at FROM notifications WHERE id=?", java.sql.Timestamp.class, old));
        assertThrows(DataIntegrityViolationException.class,
                () -> db.update("UPDATE notifications SET popup_presented_at=now() WHERE id=?", old));
        assertThrows(DataIntegrityViolationException.class,
                () -> db.update("UPDATE notifications SET team_deleted_team_name='Unexpected' WHERE id=?", old));
        UUID event = UUID.randomUUID(), team = UUID.randomUUID(), project = UUID.randomUUID();
        UUID notification = insert(db, a, a, project, team, event);
        assertThrows(DataIntegrityViolationException.class, () -> insert(db, a, a, project, team, event));
        insert(db, b, a, project, team, event);
        assertEquals(2, db.queryForObject("SELECT count(*) FROM notifications WHERE source_event_id=?", Integer.class, event));
        assertEquals("Team snapshot", db.queryForObject("SELECT team_deleted_team_name FROM notifications WHERE id=?", String.class, notification));
        db.update("UPDATE notifications SET popup_presented_at=now() WHERE id=?", notification);
        assertFalse(db.queryForObject("SELECT is_read FROM notifications WHERE id=?", Boolean.class, notification));
        assertThrows(DataIntegrityViolationException.class,
                () -> db.update("UPDATE notifications SET team_deleted_at=NULL WHERE id=?", notification));
        assertThrows(DataIntegrityViolationException.class,
                () -> db.update("UPDATE notifications SET source_event_id=NULL WHERE id=?", notification));
        assertThrows(DataIntegrityViolationException.class,
                () -> db.update("UPDATE notifications SET resource_type='TASK' WHERE id=?", notification));
        assertThrows(DataIntegrityViolationException.class,
                () -> db.update("UPDATE notifications SET task_status_current='DONE' WHERE id=?", notification));
        assertEquals(2, db.queryForObject("SELECT count(*) FROM pg_indexes WHERE indexname IN "
                + "('uk_notifications_source_recipient','ix_notifications_team_popup_pending')", Integer.class));
    }

    private UUID insert(JdbcTemplate db, UUID recipient, UUID actor, UUID project, UUID team, UUID event) {
        UUID id = UUID.randomUUID();
        db.update("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,actor_user_id,project_id,"
                        + "resource_type,resource_id,source_event_id,team_deleted_project_name,team_deleted_team_name,team_deleted_at) "
                        + "VALUES (?, ?, 'SQUAD_DELETED', 'Team deleted', 'Snapshot', false, now(), ?, ?, 'SQUAD', ?, ?,"
                        + "'Project snapshot','Team snapshot',now())", id, recipient, actor, project, team, event);
        return id;
    }
}
