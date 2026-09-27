CREATE TABLE project_criteria (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id),
    title VARCHAR(200) NOT NULL,
    description VARCHAR(2000),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_by UUID,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_project_criteria_completion CHECK (
        (completed = FALSE AND completed_by IS NULL AND completed_at IS NULL)
        OR (completed = TRUE AND completed_by IS NOT NULL AND completed_at IS NOT NULL)
    )
);

CREATE INDEX ix_project_criteria_project_sort ON project_criteria (project_id, sort_order);
