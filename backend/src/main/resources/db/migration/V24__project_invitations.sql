CREATE TABLE project_invitations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id),
    invited_user_id UUID,
    email VARCHAR(320),
    invited_by UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uk_project_invitations_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_project_invitations_target CHECK (invited_user_id IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX ix_project_invitations_project_status ON project_invitations (project_id, status);

-- At most one PENDING invitation per project per target (registered user or email address).
CREATE UNIQUE INDEX uk_project_invitations_pending_user
    ON project_invitations (project_id, invited_user_id)
    WHERE status = 'PENDING' AND invited_user_id IS NOT NULL;

CREATE UNIQUE INDEX uk_project_invitations_pending_email
    ON project_invitations (project_id, email)
    WHERE status = 'PENDING' AND email IS NOT NULL;

CREATE TABLE project_invitation_roles (
    invitation_id UUID NOT NULL REFERENCES project_invitations (id) ON DELETE CASCADE,
    role VARCHAR(40) NOT NULL CHECK (role IN (
        'PROJECT_MANAGER', 'MODERATOR', 'BACKEND_DEVELOPER', 'FRONTEND_DEVELOPER',
        'FULL_STACK_DEVELOPER', 'AI_ML_DEVELOPER', 'UI_UX_DEVELOPER', 'TESTER', 'ANALYST'
    )),
    PRIMARY KEY (invitation_id, role)
);
