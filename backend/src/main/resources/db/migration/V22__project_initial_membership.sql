-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE project_memberships (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    removed_at TIMESTAMPTZ,
    CONSTRAINT ck_project_memberships_status CHECK ((status IN ('ACTIVE', 'REMOVED'))),
    CONSTRAINT project_memberships_pkey PRIMARY KEY (id),
    CONSTRAINT project_memberships_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uk_project_memberships_project_user UNIQUE (project_id, user_id)
);

CREATE INDEX ix_project_memberships_project_status ON project_memberships USING btree (project_id, status);

CREATE INDEX ix_project_memberships_user ON project_memberships USING btree (user_id, project_id);

CREATE TABLE project_membership_roles (
    membership_id uuid NOT NULL,
    role VARCHAR(40) NOT NULL,
    CONSTRAINT ck_project_membership_roles_role CHECK ((role IN ('PROJECT_MANAGER', 'MODERATOR', 'BACKEND_DEVELOPER', 'FRONTEND_DEVELOPER', 'FULL_STACK_DEVELOPER', 'AI_ML_DEVELOPER', 'UI_UX_DEVELOPER', 'TESTER', 'ANALYST'))),
    CONSTRAINT project_membership_roles_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES project_memberships(id) ON DELETE CASCADE,
    CONSTRAINT project_membership_roles_pkey PRIMARY KEY (membership_id, role)
);
