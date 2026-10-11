-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE task_status_history (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    changed_by uuid NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT task_status_history_pkey PRIMARY KEY (id),
    CONSTRAINT task_status_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX ix_task_status_history_task_changed ON task_status_history USING btree (task_id, changed_at);
