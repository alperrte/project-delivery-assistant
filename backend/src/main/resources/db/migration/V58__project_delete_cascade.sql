-- Permanent project deletion (DELETE /api/v1/projects/{id}).
-- Every table that hangs off a project, directly or through a task, comment, conversation or label, now follows its
-- parent when the project row is deleted. Only the foreign key behaviour changes: no row, column or index is touched.
-- Sibling references that stay NO ACTION (tasks.sprint_id, tasks.pool_team_id, tasks.parent_task_id,
-- project_invitations.team_id, the chat reply key) are checked at the end of the statement, after the cascade removed
-- both sides, so they keep protecting single sprint/team/task deletes.

-- Directly owned by the project.
ALTER TABLE project_memberships DROP CONSTRAINT project_memberships_project_id_fkey,
    ADD CONSTRAINT project_memberships_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE project_invitations DROP CONSTRAINT project_invitations_project_id_fkey,
    ADD CONSTRAINT project_invitations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE squads DROP CONSTRAINT squads_project_id_fkey,
    ADD CONSTRAINT squads_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE project_criteria DROP CONSTRAINT project_criteria_project_id_fkey,
    ADD CONSTRAINT project_criteria_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE project_repository_connections DROP CONSTRAINT project_repository_connections_project_id_fkey,
    ADD CONSTRAINT project_repository_connections_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE project_task_counters DROP CONSTRAINT project_task_counters_project_id_fkey,
    ADD CONSTRAINT project_task_counters_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE tasks DROP CONSTRAINT tasks_project_id_fkey,
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE project_reminders DROP CONSTRAINT project_reminders_project_id_fkey,
    ADD CONSTRAINT project_reminders_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE task_comments DROP CONSTRAINT task_comments_project_id_fkey,
    ADD CONSTRAINT task_comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE task_activities DROP CONSTRAINT task_activities_project_id_fkey,
    ADD CONSTRAINT task_activities_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE project_labels DROP CONSTRAINT project_labels_project_id_fkey,
    ADD CONSTRAINT project_labels_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE task_relations DROP CONSTRAINT task_relations_project_id_fkey,
    ADD CONSTRAINT task_relations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE task_attachments DROP CONSTRAINT task_attachments_project_id_fkey,
    ADD CONSTRAINT task_attachments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE sprints DROP CONSTRAINT sprints_project_id_fkey,
    ADD CONSTRAINT sprints_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE task_worklogs DROP CONSTRAINT task_worklogs_project_id_fkey,
    ADD CONSTRAINT task_worklogs_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE chat_conversations DROP CONSTRAINT chat_conversations_project_id_fkey,
    ADD CONSTRAINT chat_conversations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- Owned through a task.
ALTER TABLE task_assignments DROP CONSTRAINT task_assignments_task_id_fkey,
    ADD CONSTRAINT task_assignments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE;
ALTER TABLE task_status_history DROP CONSTRAINT task_status_history_task_id_fkey,
    ADD CONSTRAINT task_status_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE;
ALTER TABLE task_checklist_items DROP CONSTRAINT task_checklist_items_task_id_fkey,
    ADD CONSTRAINT task_checklist_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE;
ALTER TABLE task_comments DROP CONSTRAINT task_comments_task_id_fkey,
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE;
ALTER TABLE task_activities DROP CONSTRAINT task_activities_task_id_fkey,
    ADD CONSTRAINT task_activities_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE;
ALTER TABLE task_labels DROP CONSTRAINT task_labels_task_id_fkey,
    ADD CONSTRAINT task_labels_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE;
ALTER TABLE task_relations DROP CONSTRAINT task_relations_source_task_id_fkey,
    ADD CONSTRAINT task_relations_source_task_id_fkey FOREIGN KEY (source_task_id) REFERENCES tasks (id) ON DELETE CASCADE;
ALTER TABLE task_relations DROP CONSTRAINT task_relations_target_task_id_fkey,
    ADD CONSTRAINT task_relations_target_task_id_fkey FOREIGN KEY (target_task_id) REFERENCES tasks (id) ON DELETE CASCADE;
ALTER TABLE task_watchers DROP CONSTRAINT task_watchers_task_id_fkey,
    ADD CONSTRAINT task_watchers_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE;
ALTER TABLE task_attachments DROP CONSTRAINT task_attachments_task_id_fkey,
    ADD CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE;
ALTER TABLE task_worklogs DROP CONSTRAINT task_worklogs_task_id_fkey,
    ADD CONSTRAINT task_worklogs_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE;

-- Owned through a comment, a label or a conversation.
ALTER TABLE task_comment_mentions DROP CONSTRAINT task_comment_mentions_comment_id_fkey,
    ADD CONSTRAINT task_comment_mentions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES task_comments (id) ON DELETE CASCADE;
ALTER TABLE task_labels DROP CONSTRAINT task_labels_label_id_fkey,
    ADD CONSTRAINT task_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES project_labels (id) ON DELETE CASCADE;
ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_conversation_id_fkey,
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations (id) ON DELETE CASCADE;
ALTER TABLE chat_read_states DROP CONSTRAINT chat_read_states_conversation_id_fkey,
    ADD CONSTRAINT chat_read_states_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations (id) ON DELETE CASCADE;

-- A team member row belongs to its membership as much as to its team. The cascade removes memberships before it reaches
-- the squads, and this key is verified as soon as that nested delete finishes, so it has to follow as well.
ALTER TABLE squad_members DROP CONSTRAINT fk_squad_members_project_membership,
    ADD CONSTRAINT fk_squad_members_project_membership FOREIGN KEY (project_membership_id) REFERENCES project_memberships (id) ON DELETE CASCADE;
