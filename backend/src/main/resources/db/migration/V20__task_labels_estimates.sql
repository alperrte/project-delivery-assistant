-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE project_labels (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    name VARCHAR(40) NOT NULL,
    color VARCHAR(16) NOT NULL,
    created_by uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    CONSTRAINT project_labels_color_check CHECK ((color IN ('slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'))),
    CONSTRAINT project_labels_pkey PRIMARY KEY (id),
    CONSTRAINT project_labels_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uk_project_labels_name ON project_labels USING btree (project_id, lower((name)::text)) WHERE (archived_at IS NULL);

CREATE TABLE task_labels (
    task_id uuid NOT NULL,
    label_id uuid NOT NULL,
    CONSTRAINT task_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES project_labels(id) ON DELETE CASCADE,
    CONSTRAINT task_labels_pkey PRIMARY KEY (task_id, label_id),
    CONSTRAINT task_labels_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX ix_task_labels_label ON task_labels USING btree (label_id);
