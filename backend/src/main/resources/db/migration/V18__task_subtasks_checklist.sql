-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE task_checklist_items (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    text VARCHAR(200) NOT NULL,
    done boolean DEFAULT false NOT NULL,
    position integer NOT NULL,
    done_by uuid,
    done_at TIMESTAMPTZ,
    created_by uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT task_checklist_items_pkey PRIMARY KEY (id),
    CONSTRAINT task_checklist_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX ix_task_checklist_task_position ON task_checklist_items USING btree (task_id, "position");
