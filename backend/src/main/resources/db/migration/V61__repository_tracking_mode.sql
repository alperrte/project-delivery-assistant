-- Repository tracking options: BASIC (connect + latest default-branch commits) or ADVANCED (branches, per-branch
-- commits, merged/unmerged split), and a switch for the default-branch commit notification.
-- Connections that already exist keep what they have today (the full branch view), hence ADVANCED for them.
ALTER TABLE project_repository_connections
    ADD COLUMN tracking_mode VARCHAR(20) NOT NULL DEFAULT 'ADVANCED',
    ADD COLUMN notify_commits BOOLEAN NOT NULL DEFAULT TRUE,
    ADD CONSTRAINT ck_project_repository_connections_tracking_mode CHECK (tracking_mode IN ('BASIC', 'ADVANCED'));
