CREATE TABLE task_watchers (
    task_id UUID NOT NULL REFERENCES tasks (id),
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (task_id, user_id)
);
CREATE INDEX ix_task_watchers_user ON task_watchers (user_id);
