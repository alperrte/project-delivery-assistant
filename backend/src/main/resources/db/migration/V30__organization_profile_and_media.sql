-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE organization_media_objects (
    object_key VARCHAR(36) NOT NULL,
    organization_id uuid NOT NULL,
    kind VARCHAR(10) NOT NULL,
    content_type VARCHAR(30) NOT NULL,
    size_bytes integer NOT NULL,
    state VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    lease_until TIMESTAMPTZ NOT NULL,
    CONSTRAINT organization_media_objects_check CHECK (((size_bytes > 0) AND ((((kind)::text = 'LOGO'::text) AND (size_bytes <= 524288)) OR (((kind)::text = 'COVER'::text) AND (size_bytes <= 2097152))))),
    CONSTRAINT organization_media_objects_content_type_check CHECK ((content_type IN ('image/png', 'image/jpeg', 'image/webp'))),
    CONSTRAINT organization_media_objects_kind_check CHECK ((kind IN ('LOGO', 'COVER'))),
    CONSTRAINT organization_media_objects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT organization_media_objects_pkey PRIMARY KEY (object_key),
    CONSTRAINT organization_media_objects_state_check CHECK ((state IN ('PENDING', 'ACTIVE', 'DELETE_PENDING')))
);

CREATE INDEX ix_organization_media_cleanup ON organization_media_objects USING btree (state, lease_until);
