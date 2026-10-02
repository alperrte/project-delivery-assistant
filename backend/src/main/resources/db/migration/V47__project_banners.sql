-- Optional project banner (cover image), stored like the logo: bytes in their own table, a version on the project.
ALTER TABLE projects
    ADD COLUMN banner_updated_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE project_banners (
    project_id UUID PRIMARY KEY REFERENCES projects (id) ON DELETE CASCADE,
    content_type VARCHAR(32) NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
    data BYTEA NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
