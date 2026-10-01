-- Comments with @mentions and a single activity feed per task.
CREATE TABLE task_comments (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks (id),
    project_id UUID NOT NULL REFERENCES projects (id),
    author_id UUID NOT NULL,
    body TEXT NOT NULL CHECK (char_length(body) <= 10000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);
CREATE INDEX ix_task_comments_task_created ON task_comments (task_id, created_at);

CREATE TABLE task_comment_mentions (
    comment_id UUID NOT NULL REFERENCES task_comments (id),
    user_id UUID NOT NULL,
    PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE task_activities (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks (id),
    project_id UUID NOT NULL REFERENCES projects (id),
    actor_id UUID,
    type VARCHAR(40) NOT NULL,
    field VARCHAR(40),
    old_value VARCHAR(500),
    new_value VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_task_activities_task_created ON task_activities (task_id, created_at);

-- Existing status history becomes the first activity entries; task_status_history stays for compatibility.
INSERT INTO task_activities (id, task_id, project_id, actor_id, type, field, old_value, new_value, created_at)
SELECT h.id, h.task_id, t.project_id, h.changed_by, 'STATUS_CHANGED', 'status',
       h.previous_status, h.new_status, h.changed_at
  FROM task_status_history h
  JOIN tasks t ON t.id = h.task_id;
