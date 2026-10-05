ALTER TABLE organizations
    ADD COLUMN website VARCHAR(2048),
    ADD COLUMN contact_email VARCHAR(254),
    ADD COLUMN location VARCHAR(200),
    ADD COLUMN logo_key VARCHAR(36),
    ADD COLUMN cover_image_key VARCHAR(36);

-- No binary data. Records survive failed disk cleanup and process restarts.
CREATE TABLE organization_media_objects (
    object_key VARCHAR(36) PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('LOGO','COVER')),
    content_type VARCHAR(30) NOT NULL CHECK (content_type IN ('image/png','image/jpeg','image/webp')),
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND
        ((kind = 'LOGO' AND size_bytes <= 524288) OR (kind = 'COVER' AND size_bytes <= 2097152))),
    state VARCHAR(20) NOT NULL CHECK (state IN ('PENDING','ACTIVE','DELETE_PENDING')),
    created_at TIMESTAMPTZ NOT NULL,
    lease_until TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_organization_media_cleanup ON organization_media_objects(state, lease_until);
