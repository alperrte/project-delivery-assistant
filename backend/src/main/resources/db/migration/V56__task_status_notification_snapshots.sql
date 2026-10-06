ALTER TABLE notifications
    ADD COLUMN task_status_previous VARCHAR(20),
    ADD COLUMN task_status_current VARCHAR(20),
    ADD COLUMN task_key VARCHAR(125),
    ADD COLUMN task_title VARCHAR(160),
    ADD COLUMN actor_nickname VARCHAR(32),
    ADD CONSTRAINT ck_notification_task_status_snapshot CHECK (
        (task_status_previous IS NULL AND task_status_current IS NULL AND task_key IS NULL
            AND task_title IS NULL AND actor_nickname IS NULL)
        OR (type = 'TASK_STATUS_CHANGED' AND resource_type = 'TASK'
            AND task_status_previous IS NOT NULL AND task_status_current IS NOT NULL
            AND task_key IS NOT NULL AND task_title IS NOT NULL
            AND task_status_previous IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE')
            AND task_status_current IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE'))
    );
