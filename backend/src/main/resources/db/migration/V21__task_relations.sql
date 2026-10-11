-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE task_relations (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    source_task_id uuid NOT NULL,
    target_task_id uuid NOT NULL,
    type VARCHAR(16) NOT NULL,
    created_by uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_task_relations_distinct CHECK ((source_task_id <> target_task_id)),
    CONSTRAINT task_relations_pkey PRIMARY KEY (id),
    CONSTRAINT task_relations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT task_relations_source_task_id_fkey FOREIGN KEY (source_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT task_relations_target_task_id_fkey FOREIGN KEY (target_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT task_relations_type_check CHECK ((type IN ('BLOCKS', 'RELATES', 'DUPLICATES'))),
    CONSTRAINT uk_task_relations UNIQUE (source_task_id, target_task_id, type)
);

CREATE INDEX ix_task_relations_target ON task_relations USING btree (target_task_id);
