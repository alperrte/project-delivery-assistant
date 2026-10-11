-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE project_logos (
    project_id uuid NOT NULL,
    content_type VARCHAR(32) NOT NULL,
    data bytea NOT NULL,
    size_bytes integer NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT project_logos_content_type_check CHECK ((content_type IN ('image/png', 'image/jpeg', 'image/webp'))),
    CONSTRAINT project_logos_pkey PRIMARY KEY (project_id),
    CONSTRAINT project_logos_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT project_logos_size_bytes_check CHECK (((size_bytes > 0) AND (size_bytes <= 524288)))
);
