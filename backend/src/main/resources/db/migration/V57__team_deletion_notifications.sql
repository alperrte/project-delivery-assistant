ALTER TABLE notifications
    ADD COLUMN source_event_id UUID,
    ADD COLUMN team_deleted_project_name VARCHAR(160),
    ADD COLUMN team_deleted_team_name VARCHAR(120),
    ADD COLUMN team_deleted_actor_nickname VARCHAR(32),
    ADD COLUMN team_deleted_at TIMESTAMPTZ,
    ADD COLUMN popup_presented_at TIMESTAMPTZ,
    ADD CONSTRAINT ck_notification_team_deletion_snapshot CHECK (
        (type = 'SQUAD_DELETED' AND resource_type = 'SQUAD'
            AND project_id IS NOT NULL AND actor_user_id IS NOT NULL
            AND source_event_id IS NOT NULL AND team_deleted_project_name IS NOT NULL
            AND team_deleted_team_name IS NOT NULL AND team_deleted_at IS NOT NULL)
        OR (type <> 'SQUAD_DELETED' AND source_event_id IS NULL
            AND team_deleted_project_name IS NULL AND team_deleted_team_name IS NULL
            AND team_deleted_actor_nickname IS NULL AND team_deleted_at IS NULL
            AND popup_presented_at IS NULL)
    );

CREATE UNIQUE INDEX uk_notifications_source_recipient
    ON notifications (source_event_id, recipient_user_id) WHERE source_event_id IS NOT NULL;

CREATE INDEX ix_notifications_team_popup_pending
    ON notifications (recipient_user_id, created_at, id)
    WHERE type = 'SQUAD_DELETED' AND is_read = FALSE AND popup_presented_at IS NULL;
