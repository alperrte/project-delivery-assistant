-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE sprints (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    name VARCHAR(80) NOT NULL,
    goal VARCHAR(500),
    start_date date NOT NULL,
    end_date date NOT NULL,
    status VARCHAR(16) NOT NULL,
    sequence integer NOT NULL,
    created_by uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_by uuid,
    updated_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    completed_by uuid,
    archived_at TIMESTAMPTZ,
    version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT ck_sprints_dates CHECK ((end_date >= start_date)),
    CONSTRAINT sprints_pkey PRIMARY KEY (id),
    CONSTRAINT sprints_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT sprints_status_check CHECK ((status IN ('PLANNED', 'ACTIVE', 'COMPLETED')))
);

CREATE INDEX ix_sprints_project ON sprints USING btree (project_id, status);

CREATE UNIQUE INDEX uk_sprints_one_active ON sprints USING btree (project_id) WHERE (((status)::text = 'ACTIVE'::text) AND (archived_at IS NULL));

-- Referenced tables now exist; these forward references cannot be declared in the earlier CREATE.
ALTER TABLE tasks ADD CONSTRAINT tasks_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES sprints(id);
