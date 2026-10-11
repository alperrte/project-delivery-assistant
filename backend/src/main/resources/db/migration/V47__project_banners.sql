-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE project_banners (
    project_id uuid NOT NULL,
    content_type VARCHAR(32) NOT NULL,
    data bytea NOT NULL,
    size_bytes integer NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT project_banners_content_type_check CHECK ((content_type IN ('image/png', 'image/jpeg', 'image/webp'))),
    CONSTRAINT project_banners_pkey PRIMARY KEY (project_id),
    CONSTRAINT project_banners_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT project_banners_size_bytes_check CHECK (((size_bytes > 0) AND (size_bytes <= 2097152)))
);
