-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE task_attachments (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid NOT NULL,
    file_name VARCHAR(200) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes bigint NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    uploaded_by uuid NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    deleted_by uuid,
    CONSTRAINT task_attachments_pkey PRIMARY KEY (id),
    CONSTRAINT task_attachments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT task_attachments_size_bytes_check CHECK (((size_bytes > 0) AND (size_bytes <= 10485760))),
    CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX ix_task_attachments_task ON task_attachments USING btree (task_id) WHERE (deleted_at IS NULL);

CREATE TABLE task_attachment_data (
    attachment_id uuid NOT NULL,
    data bytea NOT NULL,
    CONSTRAINT task_attachment_data_attachment_id_fkey FOREIGN KEY (attachment_id) REFERENCES task_attachments(id) ON DELETE CASCADE,
    CONSTRAINT task_attachment_data_pkey PRIMARY KEY (attachment_id)
);
