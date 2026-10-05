-- Existing projects/tasks keep their full feature set. New projects choose a policy explicitly.
ALTER TABLE projects ADD COLUMN task_management_mode VARCHAR(16);
UPDATE projects SET task_management_mode = 'BOTH';
ALTER TABLE projects ADD CONSTRAINT ck_projects_task_management_mode
    CHECK (task_management_mode IN ('SIMPLE', 'ADVANCED', 'BOTH'));

ALTER TABLE tasks ADD COLUMN creation_mode VARCHAR(16) NOT NULL DEFAULT 'ADVANCED';
ALTER TABLE tasks ADD CONSTRAINT ck_tasks_creation_mode CHECK (creation_mode IN ('SIMPLE', 'ADVANCED'));
CREATE INDEX ix_tasks_project_creation_mode ON tasks(project_id, creation_mode) WHERE archived_at IS NULL;

-- Automatic notification followers remain usable by both models. Explicit subscriptions prevent a lossy downgrade.
ALTER TABLE task_watchers ADD COLUMN manual_watch BOOLEAN NOT NULL DEFAULT FALSE;
-- Historical origin was not recorded: conservatively retain old subscriptions as explicit.
UPDATE task_watchers SET manual_watch = TRUE;
