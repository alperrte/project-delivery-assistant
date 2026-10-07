package com.pda.project.integration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * V58 turns the project-owned foreign keys into {@code ON DELETE CASCADE}. Two fully populated projects are created on
 * the V57 schema, the database is upgraded, and deleting one project row must remove every row it owns, including the
 * children that reference sibling tables with plain {@code NO ACTION} keys, while the other project loses nothing.
 */
@Testcontainers(disabledWithoutDocker = true)
class ProjectDeleteCascadeMigrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    private static final List<String> OWNED_TABLES = List.of(
            "project_memberships", "project_membership_roles", "squads", "squad_members", "project_invitations",
            "project_criteria", "project_repository_connections", "project_task_counters", "project_reminders",
            "project_labels", "project_logos", "project_banners", "sprints", "tasks", "task_assignments",
            "task_status_history", "task_checklist_items", "task_watchers", "task_labels", "task_relations",
            "task_comments", "task_comment_mentions", "task_activities", "task_attachments", "task_attachment_data",
            "task_worklogs", "chat_conversations", "chat_messages", "chat_message_reactions", "chat_read_states");

    @Test
    void deletingAProjectRemovesEverythingItOwnsAndLeavesOtherProjectsUntouched() {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .target("57").load().migrate();
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
        UUID doomed = seedProject(jdbc, "doomed");
        UUID kept = seedProject(jdbc, "kept");
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).load().migrate();

        Map<String, Integer> before = counts(jdbc);
        before.forEach((table, count) -> {
            assertTrue(count > 0 && count % 2 == 0, table + " must hold rows for both projects but had " + count);
        });

        assertEquals(1, jdbc.update("DELETE FROM projects WHERE id=?", doomed));

        Map<String, Integer> after = counts(jdbc);
        before.forEach((table, count) ->
                assertEquals(count / 2, after.get(table), table + " must keep only the other project's rows"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM projects WHERE id=?", Integer.class, kept));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM projects WHERE id=?", Integer.class, doomed));
    }

    private Map<String, Integer> counts(JdbcTemplate jdbc) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String table : OWNED_TABLES) {
            counts.put(table, jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class));
        }
        return counts;
    }

    private UUID seedProject(JdbcTemplate jdbc, String slug) {
        UUID owner = UUID.randomUUID(), member = UUID.randomUUID();
        UUID project = UUID.randomUUID(), ownerMembership = UUID.randomUUID(), memberMembership = UUID.randomUUID();
        UUID team = UUID.randomUUID(), subTeam = UUID.randomUUID(), sprint = UUID.randomUUID();
        UUID task = UUID.randomUUID(), subtask = UUID.randomUUID(), other = UUID.randomUUID();
        UUID label = UUID.randomUUID(), comment = UUID.randomUUID(), attachment = UUID.randomUUID();
        UUID conversation = UUID.randomUUID(), firstMessage = UUID.randomUUID(), reply = UUID.randomUUID();

        jdbc.update("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) "
                + "VALUES (?, 'Project', ?, 'PLANNING', 'MEDIUM', 'PRIVATE', ?, now(), now())", project, slug, owner);
        jdbc.update("INSERT INTO project_logos(project_id,content_type,data,size_bytes,updated_at) VALUES (?, 'image/png', '\\x01', 1, now())", project);
        jdbc.update("INSERT INTO project_banners(project_id,content_type,data,size_bytes,updated_at) VALUES (?, 'image/png', '\\x01', 1, now())", project);
        jdbc.update("INSERT INTO project_task_counters(project_id,key_prefix,last_value) VALUES (?, 'PRJ', 3)", project);
        for (UUID[] row : List.of(new UUID[]{ownerMembership, owner}, new UUID[]{memberMembership, member})) {
            jdbc.update("INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES (?, ?, ?, now())", row[0], project, row[1]);
            jdbc.update("INSERT INTO project_membership_roles(membership_id,role) VALUES (?, 'PROJECT_MANAGER')", row[0]);
        }
        jdbc.update("INSERT INTO squads(id,project_id,name,created_by,created_at,updated_at,updated_by) VALUES (?, ?, 'Team', ?, now(), now(), ?)", team, project, owner, owner);
        jdbc.update("INSERT INTO squads(id,project_id,name,created_by,created_at,updated_at,updated_by,parent_squad_id) VALUES (?, ?, 'Sub team', ?, now(), now(), ?, ?)", subTeam, project, owner, owner, team);
        jdbc.update("INSERT INTO squad_members(id,squad_id,added_by,added_at,project_membership_id) VALUES (?, ?, ?, now(), ?)", UUID.randomUUID(), team, owner, memberMembership);
        jdbc.update("INSERT INTO project_invitations(id,project_id,invited_by,token_hash,status,created_at,expires_at,invited_user_id,team_id) "
                + "VALUES (?, ?, ?, ?, 'PENDING', now(), now() + interval '1 day', ?, ?)", UUID.randomUUID(), project, owner, UUID.randomUUID().toString(), UUID.randomUUID(), team);
        jdbc.update("INSERT INTO project_criteria(id,project_id,title,sort_order,created_by,created_at) VALUES (?, ?, 'Criterion', 1, ?, now())", UUID.randomUUID(), project, owner);
        jdbc.update("INSERT INTO project_repository_connections(id,project_id,provider,repository_url,repository_owner,repository_name,default_branch,connected_by,connected_at,updated_at) "
                + "VALUES (?, ?, 'GITHUB', 'https://github.com/o/r', 'o', 'r', 'main', ?, now(), now())", UUID.randomUUID(), project, owner);
        jdbc.update("INSERT INTO project_reminders(id,project_id,creator_user_id,title,type,scope,reminder_date,created_at,updated_at) "
                + "VALUES (?, ?, ?, 'Reminder', 'MEETING', 'PROJECT', current_date, now(), now())", UUID.randomUUID(), project, owner);
        jdbc.update("INSERT INTO project_labels(id,project_id,name,color,created_by,created_at) VALUES (?, ?, 'Label', 'blue', ?, now())", label, project, owner);
        jdbc.update("INSERT INTO sprints(id,project_id,name,start_date,end_date,status,sequence,created_by,created_at,updated_at) "
                + "VALUES (?, ?, 'Sprint', current_date, current_date + 7, 'PLANNED', 1, ?, now(), now())", sprint, project, owner);

        // The parent task, a subtask and the sibling-key references (sprint, pool team) are what could block a cascade.
        jdbc.update("INSERT INTO tasks(id,project_id,task_number,task_key,title,status,priority,created_by,created_at,updated_at,sprint_id,pool_team_id) "
                + "VALUES (?, ?, 1, 'PRJ-1', 'Task', 'TODO', 'MEDIUM', ?, now(), now(), ?, ?)", task, project, owner, sprint, team);
        jdbc.update("INSERT INTO tasks(id,project_id,task_number,task_key,title,status,priority,created_by,created_at,updated_at,parent_task_id,sprint_id) "
                + "VALUES (?, ?, 2, 'PRJ-2', 'Subtask', 'TODO', 'MEDIUM', ?, now(), now(), ?, ?)", subtask, project, owner, task, sprint);
        jdbc.update("INSERT INTO tasks(id,project_id,task_number,task_key,title,status,priority,created_by,created_at,updated_at) "
                + "VALUES (?, ?, 3, 'PRJ-3', 'Other', 'BACKLOG', 'LOW', ?, now(), now())", other, project, owner);
        jdbc.update("INSERT INTO task_assignments(id,task_id,user_id,assigned_by,assigned_at) VALUES (?, ?, ?, ?, now())", UUID.randomUUID(), task, member, owner);
        jdbc.update("INSERT INTO task_status_history(id,task_id,previous_status,new_status,changed_by,changed_at) VALUES (?, ?, 'BACKLOG', 'TODO', ?, now())", UUID.randomUUID(), task, owner);
        jdbc.update("INSERT INTO task_checklist_items(id,task_id,text,position,created_by,created_at) VALUES (?, ?, 'Item', 1, ?, now())", UUID.randomUUID(), task, owner);
        jdbc.update("INSERT INTO task_watchers(task_id,user_id,created_at) VALUES (?, ?, now())", task, owner);
        jdbc.update("INSERT INTO task_labels(task_id,label_id) VALUES (?, ?)", task, label);
        jdbc.update("INSERT INTO task_relations(id,project_id,source_task_id,target_task_id,type,created_by,created_at) VALUES (?, ?, ?, ?, 'BLOCKS', ?, now())", UUID.randomUUID(), project, task, other, owner);
        jdbc.update("INSERT INTO task_comments(id,task_id,project_id,author_id,body,created_at) VALUES (?, ?, ?, ?, 'Comment', now())", comment, task, project, owner);
        jdbc.update("INSERT INTO task_comment_mentions(comment_id,user_id) VALUES (?, ?)", comment, member);
        jdbc.update("INSERT INTO task_activities(id,task_id,project_id,type,created_at) VALUES (?, ?, ?, 'CREATED', now())", UUID.randomUUID(), task, project);
        jdbc.update("INSERT INTO task_attachments(id,task_id,project_id,file_name,content_type,size_bytes,sha256,uploaded_by,uploaded_at) "
                + "VALUES (?, ?, ?, 'a.txt', 'text/plain', 1, 'abc', ?, now())", attachment, task, project, owner);
        jdbc.update("INSERT INTO task_attachment_data(attachment_id,data) VALUES (?, '\\x01')", attachment);
        jdbc.update("INSERT INTO task_worklogs(id,task_id,project_id,user_id,minutes,work_date,created_at,updated_at) VALUES (?, ?, ?, ?, 30, current_date, now(), now())", UUID.randomUUID(), task, project, owner);

        jdbc.update("INSERT INTO chat_conversations(id,project_id,type,created_at) VALUES (?, ?, 'PROJECT', now())", conversation, project);
        jdbc.update("INSERT INTO chat_messages(id,conversation_id,sender_user_id,content,created_at) VALUES (?, ?, ?, 'Hello', now())", firstMessage, conversation, owner);
        jdbc.update("INSERT INTO chat_messages(id,conversation_id,sender_user_id,content,created_at,reply_to_message_id) VALUES (?, ?, ?, 'Reply', now(), ?)", reply, conversation, member, firstMessage);
        jdbc.update("INSERT INTO chat_message_reactions(message_id,user_id,emoji_code,created_at) VALUES (?, ?, 'THUMBS_UP', now())", firstMessage, member);
        jdbc.update("INSERT INTO chat_read_states(conversation_id,user_id,last_read_at) VALUES (?, ?, now())", conversation, owner);
        return project;
    }
}
