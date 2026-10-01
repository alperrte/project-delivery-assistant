-- Project identity for the project card: type, tagline, last editor and an optional logo.
ALTER TABLE projects
    ADD COLUMN project_type VARCHAR(16) NOT NULL DEFAULT 'OTHER'
        CONSTRAINT ck_projects_project_type CHECK (project_type IN ('WEB', 'MOBILE', 'AI', 'DESKTOP', 'OTHER')),
    ADD COLUMN tagline VARCHAR(120),
    ADD COLUMN updated_by UUID,
    ADD COLUMN logo_updated_at TIMESTAMP WITH TIME ZONE;

-- Existing projects were last "edited" by their creator until someone changes them.
UPDATE projects SET updated_by = created_by;

-- Logo bytes live in their own table so list queries never touch them.
CREATE TABLE project_logos (
    project_id UUID PRIMARY KEY REFERENCES projects (id) ON DELETE CASCADE,
    content_type VARCHAR(32) NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
    data BYTEA NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 524288),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
