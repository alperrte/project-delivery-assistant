-- Retain team-deletion invariants while allowing replay-safe meeting event IDs.
ALTER TABLE notifications DROP CONSTRAINT ck_notification_team_deletion_snapshot;
ALTER TABLE notifications ADD CONSTRAINT ck_notification_team_deletion_snapshot CHECK (
    (type = 'SQUAD_DELETED' AND resource_type = 'SQUAD' AND project_id IS NOT NULL
        AND actor_user_id IS NOT NULL AND source_event_id IS NOT NULL
        AND team_deleted_project_name IS NOT NULL AND team_deleted_team_name IS NOT NULL
        AND team_deleted_at IS NOT NULL)
    OR
    (type <> 'SQUAD_DELETED'
        AND (source_event_id IS NULL OR type IN ('MEETING_CREATED','MEETING_UPDATED','MEETING_CANCELLED',
            'MEETING_OPENED','MEETING_OVERTIME','MEETING_ENDED'))
        AND team_deleted_project_name IS NULL AND team_deleted_team_name IS NULL
        AND team_deleted_actor_nickname IS NULL AND team_deleted_at IS NULL AND popup_presented_at IS NULL)
);
ALTER TABLE notifications ADD CONSTRAINT ck_notification_meeting_event CHECK (
    (type NOT IN ('MEETING_CREATED','MEETING_UPDATED','MEETING_CANCELLED','MEETING_OPENED','MEETING_OVERTIME','MEETING_ENDED')
        AND resource_type <> 'MEETING')
    OR
    (type IN ('MEETING_CREATED','MEETING_UPDATED','MEETING_CANCELLED','MEETING_OPENED','MEETING_OVERTIME','MEETING_ENDED')
        AND resource_type = 'MEETING' AND source_event_id IS NOT NULL AND project_id IS NOT NULL
        AND task_status_previous IS NULL AND task_status_current IS NULL AND task_key IS NULL
        AND task_title IS NULL AND actor_nickname IS NULL AND repo_project_name IS NULL
        AND repo_full_name IS NULL AND repo_branch IS NULL AND repo_commit_count IS NULL
        AND repo_commits_truncated IS NULL AND repo_head_message IS NULL AND repo_head_author IS NULL
        AND invitation_project_name IS NULL)
);
