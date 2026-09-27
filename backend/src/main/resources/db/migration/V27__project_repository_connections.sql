CREATE TABLE project_repository_connections (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id),
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('GITHUB')),
    repository_url VARCHAR(500) NOT NULL,
    repository_owner VARCHAR(100) NOT NULL,
    repository_name VARCHAR(100) NOT NULL,
    default_branch VARCHAR(250) NOT NULL,
    connected_by UUID NOT NULL,
    connected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_project_repository_connections_project UNIQUE (project_id)
);
