CREATE TABLE task_assignments (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id),
    user_id UUID NOT NULL,
    assigned_by UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_task_assignments_task_user UNIQUE (task_id, user_id)
);
CREATE INDEX ix_task_assignments_task ON task_assignments (task_id);
CREATE INDEX ix_task_assignments_user ON task_assignments (user_id);
