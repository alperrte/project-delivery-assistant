-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE project_repository_connections (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    provider VARCHAR(20) NOT NULL,
    repository_url VARCHAR(500) NOT NULL,
    repository_owner VARCHAR(100) NOT NULL,
    repository_name VARCHAR(100) NOT NULL,
    default_branch VARCHAR(250) NOT NULL,
    connected_by uuid NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    notified_head_sha VARCHAR(64),
    last_scanned_at TIMESTAMPTZ,
    tracking_mode VARCHAR(20) DEFAULT 'ADVANCED'::character varying NOT NULL,
    notify_commits boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_project_repository_connections_tracking_mode CHECK ((tracking_mode IN ('BASIC', 'ADVANCED'))),
    CONSTRAINT project_repository_connections_pkey PRIMARY KEY (id),
    CONSTRAINT project_repository_connections_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT project_repository_connections_provider_check CHECK (((provider)::text = 'GITHUB'::text)),
    CONSTRAINT uk_project_repository_connections_project UNIQUE (project_id)
);

CREATE INDEX ix_project_repository_connections_scan ON project_repository_connections USING btree (last_scanned_at NULLS FIRST);
