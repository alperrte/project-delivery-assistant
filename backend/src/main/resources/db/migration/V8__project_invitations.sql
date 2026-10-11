-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE project_invitations (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    invited_user_id uuid,
    email VARCHAR(320),
    invited_by uuid NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    rejection_message VARCHAR(500),
    invitee_first_name VARCHAR(100),
    invitee_last_name VARCHAR(100),
    message VARCHAR(100),
    team_id uuid,
    CONSTRAINT ck_project_invitations_target CHECK (((invited_user_id IS NOT NULL) OR (email IS NOT NULL))),
    CONSTRAINT project_invitations_pkey PRIMARY KEY (id),
    CONSTRAINT project_invitations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT project_invitations_status_check CHECK ((status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'))),
    CONSTRAINT uk_project_invitations_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_project_invitations_invitee_status ON project_invitations USING btree (invited_user_id, status, created_at DESC);

CREATE INDEX ix_project_invitations_project_status ON project_invitations USING btree (project_id, status);

CREATE INDEX ix_project_invitations_team_status ON project_invitations USING btree (team_id, status);

CREATE UNIQUE INDEX uk_project_invitations_pending_email ON project_invitations USING btree (project_id, email) WHERE (((status)::text = 'PENDING'::text) AND (email IS NOT NULL));

CREATE UNIQUE INDEX uk_project_invitations_pending_email_ci ON project_invitations USING btree (project_id, lower((email)::text)) WHERE (((status)::text = 'PENDING'::text) AND (email IS NOT NULL));

CREATE UNIQUE INDEX uk_project_invitations_pending_user ON project_invitations USING btree (project_id, invited_user_id) WHERE (((status)::text = 'PENDING'::text) AND (invited_user_id IS NOT NULL));

CREATE TABLE project_invitation_roles (
    invitation_id uuid NOT NULL,
    role VARCHAR(40) NOT NULL,
    CONSTRAINT project_invitation_roles_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES project_invitations(id) ON DELETE CASCADE,
    CONSTRAINT project_invitation_roles_pkey PRIMARY KEY (invitation_id, role),
    CONSTRAINT project_invitation_roles_role_check CHECK ((role IN ('PROJECT_MANAGER', 'MODERATOR', 'BACKEND_DEVELOPER', 'FRONTEND_DEVELOPER', 'FULL_STACK_DEVELOPER', 'AI_ML_DEVELOPER', 'UI_UX_DEVELOPER', 'TESTER', 'ANALYST')))
);
