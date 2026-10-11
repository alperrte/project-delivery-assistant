-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE organizations (
    id uuid NOT NULL,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description VARCHAR(2000),
    owner_user_id uuid NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    website VARCHAR(2048),
    contact_email VARCHAR(254),
    location VARCHAR(200),
    logo_key VARCHAR(36),
    cover_image_key VARCHAR(36),
    notes VARCHAR(1000),
    CONSTRAINT organizations_pkey PRIMARY KEY (id),
    CONSTRAINT organizations_status_check CHECK ((status IN ('ACTIVE', 'ARCHIVED'))),
    CONSTRAINT uk_organizations_slug UNIQUE (slug)
);

CREATE INDEX ix_organizations_archived_at ON organizations USING btree (archived_at);

CREATE TABLE projects (
    id uuid NOT NULL,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description VARCHAR(2000),
    status VARCHAR(20) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    start_date date,
    target_end_date date,
    project_goal VARCHAR(2000),
    tech_stack VARCHAR(1000),
    visibility VARCHAR(20) NOT NULL,
    organization_id uuid,
    created_by uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    project_type VARCHAR(16) DEFAULT 'OTHER'::character varying NOT NULL,
    tagline VARCHAR(120),
    updated_by uuid,
    logo_updated_at TIMESTAMPTZ,
    banner_updated_at TIMESTAMPTZ,
    task_management_mode VARCHAR(16),
    CONSTRAINT ck_projects_date_order CHECK (((start_date IS NULL) OR (target_end_date IS NULL) OR (target_end_date >= start_date))),
    CONSTRAINT ck_projects_project_type CHECK ((project_type IN ('WEB', 'MOBILE', 'AI', 'DESKTOP', 'OTHER'))),
    CONSTRAINT ck_projects_task_management_mode CHECK ((task_management_mode IN ('SIMPLE', 'ADVANCED', 'BOTH'))),
    CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT projects_pkey PRIMARY KEY (id),
    CONSTRAINT projects_priority_check CHECK ((priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))),
    CONSTRAINT projects_status_check CHECK ((status IN ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'))),
    CONSTRAINT projects_visibility_check CHECK (((visibility)::text = 'PRIVATE'::text)),
    CONSTRAINT uk_projects_slug UNIQUE (slug)
);

CREATE INDEX ix_projects_archived_at ON projects USING btree (archived_at);

CREATE INDEX ix_projects_organization_active ON projects USING btree (organization_id, archived_at);
