-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE task_worklogs (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    minutes integer NOT NULL,
    work_date date NOT NULL,
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT task_worklogs_minutes_check CHECK (((minutes >= 1) AND (minutes <= 1440))),
    CONSTRAINT task_worklogs_pkey PRIMARY KEY (id),
    CONSTRAINT task_worklogs_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT task_worklogs_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX ix_task_worklogs_task ON task_worklogs USING btree (task_id) WHERE (deleted_at IS NULL);
