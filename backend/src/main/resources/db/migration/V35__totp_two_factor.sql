-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE totp_credentials (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    secret_encrypted VARCHAR(255) NOT NULL,
    confirmed_at TIMESTAMPTZ,
    last_used_step bigint DEFAULT 0 NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT ck_totp_credentials_attempts CHECK ((failed_attempts >= 0)),
    CONSTRAINT totp_credentials_pkey PRIMARY KEY (id),
    CONSTRAINT totp_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_totp_credentials_user UNIQUE (user_id)
);

CREATE TABLE totp_recovery_codes (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    CONSTRAINT ck_totp_recovery_codes_hash CHECK (((code_hash)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT totp_recovery_codes_pkey PRIMARY KEY (id),
    CONSTRAINT totp_recovery_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_totp_recovery_codes_user_hash UNIQUE (user_id, code_hash)
);

CREATE INDEX ix_totp_recovery_codes_user ON totp_recovery_codes USING btree (user_id);
