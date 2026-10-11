-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE user_oauth_identities (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    provider_email VARCHAR(320),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_user_oauth_provider CHECK (((provider)::text ~ '^[A-Z_]{2,32}$'::text)),
    CONSTRAINT uk_user_oauth_provider_subject UNIQUE (provider, provider_subject),
    CONSTRAINT uk_user_oauth_user_provider UNIQUE (user_id, provider),
    CONSTRAINT user_oauth_identities_pkey PRIMARY KEY (id),
    CONSTRAINT user_oauth_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);
