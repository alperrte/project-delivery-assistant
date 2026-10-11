-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE user_profile_photos (
    user_id uuid NOT NULL,
    content_type VARCHAR(32) NOT NULL,
    data bytea NOT NULL,
    size_bytes integer NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT user_profile_photos_content_type_check CHECK ((content_type IN ('image/png', 'image/jpeg', 'image/webp'))),
    CONSTRAINT user_profile_photos_pkey PRIMARY KEY (user_id),
    CONSTRAINT user_profile_photos_size_bytes_check CHECK (((size_bytes > 0) AND (size_bytes <= 5242880))),
    CONSTRAINT user_profile_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
