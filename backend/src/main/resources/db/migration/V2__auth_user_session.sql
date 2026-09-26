CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    nickname VARCHAR(32) NOT NULL,
    password_hash VARCHAR(100),
    account_status VARCHAR(32) NOT NULL,
    email_verification_status VARCHAR(32) NOT NULL,
    global_role VARCHAR(16) NOT NULL,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT uk_users_nickname UNIQUE (nickname),
    CONSTRAINT ck_users_account_status CHECK (account_status IN ('PENDING_VERIFICATION', 'ACTIVE', 'DISABLED')),
    CONSTRAINT ck_users_email_verification_status CHECK (email_verification_status IN ('PENDING', 'VERIFIED')),
    CONSTRAINT ck_users_global_role CHECK (global_role IN ('USER', 'ADMIN'))
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    refresh_token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uk_user_sessions_refresh_token_hash UNIQUE (refresh_token_hash),
    CONSTRAINT ck_user_sessions_refresh_token_hash CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX ix_user_sessions_active_by_user
    ON user_sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;
