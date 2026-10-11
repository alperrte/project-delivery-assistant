-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE task_watchers (
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    manual_watch boolean DEFAULT false NOT NULL,
    CONSTRAINT task_watchers_pkey PRIMARY KEY (task_id, user_id),
    CONSTRAINT task_watchers_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX ix_task_watchers_user ON task_watchers USING btree (user_id);
