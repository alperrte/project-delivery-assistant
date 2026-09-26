CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description VARCHAR(2000),
    owner_user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uk_organizations_slug UNIQUE (slug)
);

CREATE INDEX ix_organizations_archived_at ON organizations (archived_at);

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description VARCHAR(2000),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    start_date DATE,
    target_end_date DATE,
    project_goal VARCHAR(2000),
    tech_stack VARCHAR(1000),
    visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('PRIVATE')),
    organization_id UUID REFERENCES organizations (id),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uk_projects_slug UNIQUE (slug),
    CONSTRAINT ck_projects_date_order CHECK (start_date IS NULL OR target_end_date IS NULL OR target_end_date >= start_date)
);

CREATE INDEX ix_projects_archived_at ON projects (archived_at);
CREATE INDEX ix_projects_organization_active ON projects (organization_id, archived_at);
