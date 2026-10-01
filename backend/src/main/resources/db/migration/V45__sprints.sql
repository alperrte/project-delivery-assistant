CREATE TABLE sprints (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id),
    name VARCHAR(80) NOT NULL,
    goal VARCHAR(500),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED')),
    sequence INTEGER NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID,
    archived_at TIMESTAMP WITH TIME ZONE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_sprints_dates CHECK (end_date >= start_date)
);
CREATE UNIQUE INDEX uk_sprints_one_active ON sprints (project_id) WHERE status = 'ACTIVE' AND archived_at IS NULL;
CREATE INDEX ix_sprints_project ON sprints (project_id, status);

ALTER TABLE tasks ADD COLUMN sprint_id UUID REFERENCES sprints (id);
CREATE INDEX ix_tasks_sprint ON tasks (sprint_id) WHERE sprint_id IS NOT NULL;
