-- Attachment metadata and bytes live apart so list queries never read the bytes (same idea as project_logos).
CREATE TABLE task_attachments (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks (id),
    project_id UUID NOT NULL REFERENCES projects (id),
    file_name VARCHAR(200) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    sha256 VARCHAR(64) NOT NULL,
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);
CREATE INDEX ix_task_attachments_task ON task_attachments (task_id) WHERE deleted_at IS NULL;

CREATE TABLE task_attachment_data (
    attachment_id UUID PRIMARY KEY REFERENCES task_attachments (id) ON DELETE CASCADE,
    data BYTEA NOT NULL
);
