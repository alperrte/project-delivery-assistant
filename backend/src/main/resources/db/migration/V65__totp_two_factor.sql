-- Two-factor sign-in with an authenticator app (RFC 6238 TOTP). The shared secret is stored encrypted (AES-256-GCM,
-- key TOTP_ENCRYPTION_KEY, never in the database); a row stays unconfirmed until the user proves the first code.
CREATE TABLE totp_credentials (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    secret_encrypted VARCHAR(255) NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    -- Highest 30-second step that was accepted: a code can be used once, even inside its +/-1 step tolerance.
    last_used_step BIGINT NOT NULL DEFAULT 0,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_totp_credentials_user UNIQUE (user_id),
    CONSTRAINT ck_totp_credentials_attempts CHECK (failed_attempts >= 0)
);

-- Single-use backup codes for a lost phone. Only an HMAC of each code is stored.
CREATE TABLE totp_recovery_codes (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uk_totp_recovery_codes_user_hash UNIQUE (user_id, code_hash),
    CONSTRAINT ck_totp_recovery_codes_hash CHECK (code_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX ix_totp_recovery_codes_user ON totp_recovery_codes (user_id);
