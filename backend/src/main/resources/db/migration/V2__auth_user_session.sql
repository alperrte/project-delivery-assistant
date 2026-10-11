-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE users (
    id uuid NOT NULL,
    email VARCHAR(320) NOT NULL,
    nickname VARCHAR(32) NOT NULL,
    password_hash VARCHAR(100),
    account_status VARCHAR(32) NOT NULL,
    email_verification_status VARCHAR(32) NOT NULL,
    global_role VARCHAR(16) NOT NULL,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_photo_updated_at TIMESTAMPTZ,
    CONSTRAINT ck_users_account_status CHECK ((account_status IN ('PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'DELETED'))),
    CONSTRAINT ck_users_email_verification_status CHECK ((email_verification_status IN ('PENDING', 'VERIFIED'))),
    CONSTRAINT ck_users_global_role CHECK ((global_role IN ('USER', 'ADMIN'))),
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT uk_users_nickname UNIQUE (nickname),
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX uk_users_email_ci ON users USING btree (lower((email)::text));

CREATE TABLE user_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    previous_refresh_token_hash VARCHAR(64),
    user_agent VARCHAR(255),
    admin_verified_at TIMESTAMPTZ,
    CONSTRAINT ck_user_sessions_previous_refresh_token_hash CHECK (((previous_refresh_token_hash IS NULL) OR ((previous_refresh_token_hash)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT ck_user_sessions_refresh_token_hash CHECK (((refresh_token_hash)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT uk_user_sessions_refresh_token_hash UNIQUE (refresh_token_hash),
    CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX ix_user_sessions_active_by_user ON user_sessions USING btree (user_id, expires_at) WHERE (revoked_at IS NULL);

CREATE INDEX ix_user_sessions_previous_refresh_token_hash ON user_sessions USING btree (previous_refresh_token_hash) WHERE (previous_refresh_token_hash IS NOT NULL);
