-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE notifications (
    id uuid NOT NULL,
    recipient_user_id uuid NOT NULL,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message VARCHAR(500) NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ,
    actor_user_id uuid,
    project_id uuid,
    resource_type VARCHAR(20) NOT NULL,
    resource_id uuid NOT NULL,
    task_status_previous VARCHAR(20),
    task_status_current VARCHAR(20),
    task_key VARCHAR(125),
    task_title VARCHAR(160),
    actor_nickname VARCHAR(32),
    source_event_id uuid,
    team_deleted_project_name VARCHAR(160),
    team_deleted_team_name VARCHAR(120),
    team_deleted_actor_nickname VARCHAR(32),
    team_deleted_at TIMESTAMPTZ,
    popup_presented_at TIMESTAMPTZ,
    repo_project_name VARCHAR(160),
    repo_full_name VARCHAR(201),
    repo_branch VARCHAR(250),
    repo_commit_count integer,
    repo_commits_truncated boolean,
    repo_head_message VARCHAR(160),
    repo_head_author VARCHAR(100),
    invitation_project_name VARCHAR(160),
    CONSTRAINT ck_notification_invitation_context CHECK (((invitation_project_name IS NULL) OR ((type IN ('PROJECT_INVITATION_CREATED', 'PROJECT_INVITATION_ACCEPTED', 'PROJECT_INVITATION_REJECTED')) AND ((resource_type)::text = 'PROJECT_INVITATION'::text) AND (project_id IS NOT NULL) AND (length(TRIM(BOTH FROM invitation_project_name)) > 0)))),
    CONSTRAINT ck_notification_repository_commits_required CHECK ((((type)::text <> 'REPOSITORY_COMMITS_PUSHED'::text) OR (repo_commit_count IS NOT NULL))),
    CONSTRAINT ck_notification_repository_commits_snapshot CHECK ((((repo_project_name IS NULL) AND (repo_full_name IS NULL) AND (repo_branch IS NULL) AND (repo_commit_count IS NULL) AND (repo_commits_truncated IS NULL) AND (repo_head_message IS NULL) AND (repo_head_author IS NULL)) OR (((type)::text = 'REPOSITORY_COMMITS_PUSHED'::text) AND ((resource_type)::text = 'PROJECT'::text) AND (repo_project_name IS NOT NULL) AND (repo_full_name IS NOT NULL) AND (repo_branch IS NOT NULL) AND (repo_commit_count IS NOT NULL) AND (repo_commit_count >= 1) AND (repo_commits_truncated IS NOT NULL)))),
    CONSTRAINT ck_notification_task_status_snapshot CHECK ((((task_status_previous IS NULL) AND (task_status_current IS NULL) AND (task_key IS NULL) AND (task_title IS NULL) AND (actor_nickname IS NULL)) OR (((type)::text = 'TASK_STATUS_CHANGED'::text) AND ((resource_type)::text = 'TASK'::text) AND (task_status_previous IS NOT NULL) AND (task_status_current IS NOT NULL) AND (task_key IS NOT NULL) AND (task_title IS NOT NULL) AND (task_status_previous IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE')) AND (task_status_current IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE'))))),
    CONSTRAINT ck_notification_team_deletion_snapshot CHECK (((((type)::text = 'SQUAD_DELETED'::text) AND ((resource_type)::text = 'SQUAD'::text) AND (project_id IS NOT NULL) AND (actor_user_id IS NOT NULL) AND (source_event_id IS NOT NULL) AND (team_deleted_project_name IS NOT NULL) AND (team_deleted_team_name IS NOT NULL) AND (team_deleted_at IS NOT NULL)) OR (((type)::text <> 'SQUAD_DELETED'::text) AND (source_event_id IS NULL) AND (team_deleted_project_name IS NULL) AND (team_deleted_team_name IS NULL) AND (team_deleted_actor_nickname IS NULL) AND (team_deleted_at IS NULL) AND (popup_presented_at IS NULL)))),
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES users(id)
);

CREATE INDEX ix_notifications_recipient_created ON notifications USING btree (recipient_user_id, created_at DESC, id DESC);

CREATE INDEX ix_notifications_recipient_unread ON notifications USING btree (recipient_user_id, created_at DESC, id DESC) WHERE (is_read = false);

CREATE INDEX ix_notifications_team_popup_pending ON notifications USING btree (recipient_user_id, created_at, id) WHERE (((type)::text = 'SQUAD_DELETED'::text) AND (is_read = false) AND (popup_presented_at IS NULL));

CREATE UNIQUE INDEX uk_notifications_source_recipient ON notifications USING btree (source_event_id, recipient_user_id) WHERE (source_event_id IS NOT NULL);
