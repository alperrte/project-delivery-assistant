-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE email_verification_challenges (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_sent_at TIMESTAMPTZ NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    consumed_at TIMESTAMPTZ,
    version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT ck_email_verification_challenges_attempts CHECK (((attempt_count >= 0) AND (attempt_count <= 5))),
    CONSTRAINT ck_email_verification_challenges_hash CHECK (((code_hash)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT email_verification_challenges_pkey PRIMARY KEY (id),
    CONSTRAINT email_verification_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uk_email_verification_challenges_user UNIQUE (user_id)
);
