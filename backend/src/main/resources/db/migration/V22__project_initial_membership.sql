CREATE TABLE project_memberships (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id),
    user_id UUID NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_project_memberships_project_user UNIQUE (project_id, user_id)
);

CREATE INDEX ix_project_memberships_user ON project_memberships (user_id, project_id);

CREATE TABLE project_membership_roles (
    membership_id UUID NOT NULL REFERENCES project_memberships (id) ON DELETE CASCADE,
    role VARCHAR(40) NOT NULL CHECK (role IN ('PROJECT_MANAGER')),
    PRIMARY KEY (membership_id, role)
);
