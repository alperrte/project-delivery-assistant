-- Repository commit tracking: the last default-branch tip members were notified about, and the commit snapshot
-- a REPOSITORY_COMMITS_PUSHED notification renders from (the repository may later change or disappear).
ALTER TABLE project_repository_connections
    ADD COLUMN notified_head_sha VARCHAR(64),
    ADD COLUMN last_scanned_at TIMESTAMPTZ;

CREATE INDEX ix_project_repository_connections_scan
    ON project_repository_connections (last_scanned_at NULLS FIRST);

ALTER TABLE notifications
    ADD COLUMN repo_project_name VARCHAR(160),
    ADD COLUMN repo_full_name VARCHAR(201),
    ADD COLUMN repo_branch VARCHAR(250),
    ADD COLUMN repo_commit_count INT,
    ADD COLUMN repo_commits_truncated BOOLEAN,
    ADD COLUMN repo_head_message VARCHAR(160),
    ADD COLUMN repo_head_author VARCHAR(100),
    ADD CONSTRAINT ck_notification_repository_commits_snapshot CHECK (
        (repo_project_name IS NULL AND repo_full_name IS NULL AND repo_branch IS NULL
            AND repo_commit_count IS NULL AND repo_commits_truncated IS NULL
            AND repo_head_message IS NULL AND repo_head_author IS NULL)
        OR (type = 'REPOSITORY_COMMITS_PUSHED' AND resource_type = 'PROJECT'
            AND repo_project_name IS NOT NULL AND repo_full_name IS NOT NULL AND repo_branch IS NOT NULL
            AND repo_commit_count IS NOT NULL AND repo_commit_count >= 1
            AND repo_commits_truncated IS NOT NULL)
    ),
    ADD CONSTRAINT ck_notification_repository_commits_required CHECK (
        type <> 'REPOSITORY_COMMITS_PUSHED' OR repo_commit_count IS NOT NULL
    );
