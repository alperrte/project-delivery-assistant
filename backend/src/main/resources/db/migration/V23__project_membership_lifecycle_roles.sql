ALTER TABLE project_memberships
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN removed_at TIMESTAMP WITH TIME ZONE,
    ADD CONSTRAINT ck_project_memberships_status CHECK (status IN ('ACTIVE', 'REMOVED'));

ALTER TABLE project_membership_roles
    DROP CONSTRAINT project_membership_roles_role_check;

ALTER TABLE project_membership_roles
    ADD CONSTRAINT ck_project_membership_roles_role CHECK (role IN (
        'PROJECT_MANAGER', 'MODERATOR', 'BACKEND_DEVELOPER', 'FRONTEND_DEVELOPER',
        'FULL_STACK_DEVELOPER', 'AI_ML_DEVELOPER', 'UI_UX_DEVELOPER', 'TESTER', 'ANALYST'
    ));

CREATE INDEX ix_project_memberships_project_status ON project_memberships (project_id, status);
