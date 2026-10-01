-- Project labels (token colours only), label assignment, story points and a time estimate.
CREATE TABLE project_labels (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id),
    name VARCHAR(40) NOT NULL,
    color VARCHAR(16) NOT NULL
        CHECK (color IN ('slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink')),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX uk_project_labels_name ON project_labels (project_id, lower(name)) WHERE archived_at IS NULL;

CREATE TABLE task_labels (
    task_id UUID NOT NULL REFERENCES tasks (id),
    label_id UUID NOT NULL REFERENCES project_labels (id),
    PRIMARY KEY (task_id, label_id)
);
CREATE INDEX ix_task_labels_label ON task_labels (label_id);

ALTER TABLE tasks
    ADD COLUMN estimate_points SMALLINT CHECK (estimate_points IN (0, 1, 2, 3, 5, 8, 13, 21)),
    ADD COLUMN time_estimate_minutes INTEGER CHECK (time_estimate_minutes BETWEEN 1 AND 100000);
