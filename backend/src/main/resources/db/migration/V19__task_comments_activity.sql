-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE task_comments (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    deleted_by uuid,
    CONSTRAINT task_comments_body_check CHECK ((char_length(body) <= 10000)),
    CONSTRAINT task_comments_pkey PRIMARY KEY (id),
    CONSTRAINT task_comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX ix_task_comments_task_created ON task_comments USING btree (task_id, created_at);

CREATE TABLE task_comment_mentions (
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT task_comment_mentions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES task_comments(id) ON DELETE CASCADE,
    CONSTRAINT task_comment_mentions_pkey PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE task_activities (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid NOT NULL,
    actor_id uuid,
    type VARCHAR(40) NOT NULL,
    field VARCHAR(40),
    old_value VARCHAR(500),
    new_value VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT task_activities_pkey PRIMARY KEY (id),
    CONSTRAINT task_activities_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT task_activities_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX ix_task_activities_task_created ON task_activities USING btree (task_id, created_at);
