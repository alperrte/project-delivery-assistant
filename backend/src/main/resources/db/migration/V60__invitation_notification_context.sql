-- Nullable for legacy rows and queued pre-V60 events; do not infer/backfill display names.
ALTER TABLE notifications
    ADD COLUMN invitation_project_name VARCHAR(160),
    ADD CONSTRAINT ck_notification_invitation_context CHECK (
        invitation_project_name IS NULL OR (
            type IN ('PROJECT_INVITATION_CREATED', 'PROJECT_INVITATION_ACCEPTED', 'PROJECT_INVITATION_REJECTED')
            AND resource_type = 'PROJECT_INVITATION'
            AND project_id IS NOT NULL
            AND length(trim(invitation_project_name)) > 0
        )
    );
