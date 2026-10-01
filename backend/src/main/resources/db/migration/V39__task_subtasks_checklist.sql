-- One level of sub-tasks plus a per-task checklist.
ALTER TABLE tasks
    ADD COLUMN parent_task_id UUID REFERENCES tasks (id),
    ADD CONSTRAINT ck_tasks_not_own_parent CHECK (parent_task_id IS NULL OR parent_task_id <> id);
CREATE INDEX ix_tasks_parent ON tasks (parent_task_id) WHERE parent_task_id IS NOT NULL;

CREATE TABLE task_checklist_items (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks (id),
    text VARCHAR(200) NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL,
    done_by UUID,
    done_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_task_checklist_task_position ON task_checklist_items (task_id, position);
