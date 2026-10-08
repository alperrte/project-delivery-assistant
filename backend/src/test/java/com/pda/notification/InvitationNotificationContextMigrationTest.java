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
class InvitationNotificationContextMigrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @Test void v59UpgradeKeepsLegacyReadTaskTeamRepositorySnapshotsAndChecksContextScope() {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .target("59").load().migrate();
        JdbcTemplate db = new JdbcTemplate(new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
        UUID user = UUID.randomUUID(), legacy = UUID.randomUUID(), task = UUID.randomUUID(), team = UUID.randomUUID(), repo = UUID.randomUUID();
        db.update("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) "
                + "VALUES (?,'context-migration@example.test','context_migration','ACTIVE','VERIFIED','USER',now(),now())", user);
        db.update("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,read_at,project_id,resource_type,resource_id) "
                + "VALUES (?,?,'PROJECT_INVITATION_CREATED','Invite','Legacy',true,now(),now(),?,'PROJECT_INVITATION',?)", legacy,user,UUID.randomUUID(),UUID.randomUUID());
        db.update("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,resource_type,resource_id,task_status_previous,task_status_current,task_key,task_title) "
                + "VALUES (?,?,'TASK_STATUS_CHANGED','Task','Task',false,now(),'TASK',?,'TODO','IN_PROGRESS','QA-1','Task snapshot')",task,user,UUID.randomUUID());
        db.update("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,project_id,actor_user_id,resource_type,resource_id,source_event_id,team_deleted_project_name,team_deleted_team_name,team_deleted_at,popup_presented_at) "
                + "VALUES (?,?,'SQUAD_DELETED','Team','Team',false,now(),?,?,'SQUAD',?,?,'Project snapshot','Team snapshot',now(),now())",team,user,UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID());
        db.update("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,project_id,resource_type,resource_id,repo_project_name,repo_full_name,repo_branch,repo_commit_count,repo_commits_truncated) "
                + "VALUES (?,?,'REPOSITORY_COMMITS_PUSHED','Repo','Repo',false,now(),?,'PROJECT',?,'Repo project','example/qa','main',1,false)",repo,user,UUID.randomUUID(),UUID.randomUUID());
        var before = db.queryForList("SELECT id,is_read,read_at,task_status_current,team_deleted_at,popup_presented_at,repo_full_name FROM notifications ORDER BY id");
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).load().migrate();
        assertEquals(before,db.queryForList("SELECT id,is_read,read_at,task_status_current,team_deleted_at,popup_presented_at,repo_full_name FROM notifications ORDER BY id"));
        assertEquals(4,db.queryForObject("SELECT count(*) FROM notifications WHERE invitation_project_name IS NULL",Integer.class));
        db.update("UPDATE notifications SET invitation_project_name=? WHERE id=?","N".repeat(160),legacy);
        assertEquals("N".repeat(160),db.queryForObject("SELECT invitation_project_name FROM notifications WHERE id=?",String.class,legacy));
        assertThrows(DataIntegrityViolationException.class,()->db.update("UPDATE notifications SET invitation_project_name='Wrong context' WHERE id=?",task));
        assertThrows(DataIntegrityViolationException.class,()->db.update("UPDATE notifications SET invitation_project_name=' ' WHERE id=?",legacy));
        assertThrows(DataIntegrityViolationException.class,()->db.update("UPDATE notifications SET invitation_project_name=? WHERE id=?","N".repeat(161),legacy));
        assertThrows(DataIntegrityViolationException.class,()->db.update("UPDATE notifications SET resource_type='TASK' WHERE id=?",legacy));
    }
}
