-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE project_criteria (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(2000),
    completed boolean DEFAULT false NOT NULL,
    sort_order integer NOT NULL,
    created_by uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    completed_by uuid,
    completed_at TIMESTAMPTZ,
    CONSTRAINT ck_project_criteria_completion CHECK ((((completed = false) AND (completed_by IS NULL) AND (completed_at IS NULL)) OR ((completed = true) AND (completed_by IS NOT NULL) AND (completed_at IS NOT NULL)))),
    CONSTRAINT project_criteria_pkey PRIMARY KEY (id),
    CONSTRAINT project_criteria_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX ix_project_criteria_project_sort ON project_criteria USING btree (project_id, sort_order);
