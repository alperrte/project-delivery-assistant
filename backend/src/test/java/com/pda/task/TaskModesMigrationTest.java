package com.pda.task;

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
class TaskModesMigrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @Test void upgradesExistingAndArchivedDataWithoutLossAndLeavesNewProjectsUnconfigured() {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .target("53").load().migrate();
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
        UUID owner = UUID.randomUUID(), project = UUID.randomUUID(), task = UUID.randomUUID(), comment = UUID.randomUUID();
        insertProject(jdbc, project, owner, "legacy");
        jdbc.update("UPDATE projects SET archived_at=now() WHERE id=?", project);
        jdbc.update("INSERT INTO tasks(id,project_id,task_number,task_key,title,status,priority,created_by,created_at,updated_at,estimate_points,archived_at) "
                + "VALUES (?, ?, 1, 'LEG-1', 'Legacy task', 'BACKLOG', 'MEDIUM', ?, now(), now(), 8, now())", task, project, owner);
        jdbc.update("INSERT INTO task_watchers(task_id,user_id,created_at) VALUES (?, ?, now())", task, owner);
        jdbc.update("INSERT INTO task_comments(id,task_id,project_id,author_id,body,created_at) VALUES (?, ?, ?, ?, 'Keep comment', now())",
                comment, task, project, owner);
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).load().migrate();
        assertEquals("BOTH", jdbc.queryForObject("SELECT task_management_mode FROM projects WHERE id=?", String.class, project));
        assertEquals("ADVANCED", jdbc.queryForObject("SELECT creation_mode FROM tasks WHERE id=?", String.class, task));
        assertEquals(8, jdbc.queryForObject("SELECT estimate_points FROM tasks WHERE id=?", Integer.class, task));
        assertNotNull(jdbc.queryForObject("SELECT archived_at FROM tasks WHERE id=?", java.sql.Timestamp.class, task));
        assertEquals("Keep comment", jdbc.queryForObject("SELECT body FROM task_comments WHERE id=?", String.class, comment));
        assertTrue(jdbc.queryForObject("SELECT manual_watch FROM task_watchers WHERE task_id=?", Boolean.class, task));
        UUID newProject = UUID.randomUUID();
        insertProject(jdbc, newProject, owner, "new");
        assertNull(jdbc.queryForObject("SELECT task_management_mode FROM projects WHERE id=?", String.class, newProject));
        assertThrows(DataIntegrityViolationException.class,
                () -> jdbc.update("UPDATE projects SET task_management_mode='INVALID' WHERE id=?", newProject));
        assertThrows(DataIntegrityViolationException.class,
                () -> jdbc.update("UPDATE tasks SET creation_mode='BOTH' WHERE id=?", task));
        assertThrows(DataIntegrityViolationException.class,
                () -> jdbc.update("UPDATE tasks SET creation_mode=NULL WHERE id=?", task));
        UUID automaticFollower = UUID.randomUUID();
        jdbc.update("INSERT INTO task_watchers(task_id,user_id,created_at) VALUES (?, ?, now())", task, automaticFollower);
        assertFalse(jdbc.queryForObject("SELECT manual_watch FROM task_watchers WHERE task_id=? AND user_id=?",
                Boolean.class, task, automaticFollower));
    }

    private void insertProject(JdbcTemplate jdbc, UUID id, UUID owner, String slug) {
        jdbc.update("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) "
                + "VALUES (?, 'Project', ?, 'PLANNING', 'MEDIUM', 'PRIVATE', ?, now(), now())", id, slug, owner);
    }
}
