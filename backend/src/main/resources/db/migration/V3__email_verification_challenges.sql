CREATE TABLE email_verification_challenges (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    code_hash VARCHAR(64) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    consumed_at TIMESTAMP WITH TIME ZONE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_email_verification_challenges_user UNIQUE (user_id),
    CONSTRAINT ck_email_verification_challenges_hash CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_email_verification_challenges_attempts CHECK (attempt_count BETWEEN 0 AND 5)
);
