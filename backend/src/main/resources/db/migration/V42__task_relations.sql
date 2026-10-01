CREATE TABLE task_relations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id),
    source_task_id UUID NOT NULL REFERENCES tasks (id),
    target_task_id UUID NOT NULL REFERENCES tasks (id),
    type VARCHAR(16) NOT NULL CHECK (type IN ('BLOCKS', 'RELATES', 'DUPLICATES')),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_task_relations_distinct CHECK (source_task_id <> target_task_id),
    CONSTRAINT uk_task_relations UNIQUE (source_task_id, target_task_id, type)
);
CREATE INDEX ix_task_relations_target ON task_relations (target_task_id);
