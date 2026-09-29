CREATE TABLE project_task_counters (
    project_id UUID PRIMARY KEY REFERENCES projects(id),
    key_prefix VARCHAR(100) NOT NULL,
    last_value BIGINT NOT NULL CHECK (last_value > 0)
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    task_number BIGINT NOT NULL,
    task_key VARCHAR(125) NOT NULL,
    title VARCHAR(160) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('BACKLOG','TODO','IN_PROGRESS','IN_REVIEW','TESTING','DONE')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    start_date DATE,
    due_date DATE,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_reason VARCHAR(500),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_by UUID,
    archived_at TIMESTAMP WITH TIME ZONE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_tasks_project_number UNIQUE (project_id, task_number),
    CONSTRAINT uk_tasks_project_key UNIQUE (project_id, task_key),
    CONSTRAINT ck_tasks_dates CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date),
    CONSTRAINT ck_tasks_done_blocked CHECK (status <> 'DONE' OR blocked = FALSE)
);
CREATE INDEX ix_tasks_project_active_updated ON tasks (project_id, archived_at, updated_at);
