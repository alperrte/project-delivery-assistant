-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE task_assignments (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT task_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT task_assignments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT uk_task_assignments_task_user UNIQUE (task_id, user_id)
);

CREATE INDEX ix_task_assignments_task ON task_assignments USING btree (task_id);

CREATE INDEX ix_task_assignments_user ON task_assignments USING btree (user_id);
