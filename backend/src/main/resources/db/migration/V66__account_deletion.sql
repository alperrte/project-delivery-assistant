-- Account deletion. A deleted account is anonymised, not removed (tasks, comments and messages keep pointing at its id and
-- show "deleted user"), so it gets its own status that can never sign in again.
ALTER TABLE users DROP CONSTRAINT ck_users_account_status;
ALTER TABLE users ADD CONSTRAINT ck_users_account_status
    CHECK (account_status IN ('PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'DELETED'));

-- The mailed confirmation link. Only the SHA-256 of the random token is stored; the link is valid 15 minutes, single use,
-- and 5 wrong confirmations (email/password/code) cancel it. One open request per account (a new request replaces it).
CREATE TABLE account_deletion_requests (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    token_hash VARCHAR(64) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    consumed_at TIMESTAMP WITH TIME ZONE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_account_deletion_requests_user UNIQUE (user_id),
    CONSTRAINT uk_account_deletion_requests_token UNIQUE (token_hash),
    CONSTRAINT ck_account_deletion_requests_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_account_deletion_requests_attempts CHECK (attempt_count BETWEEN 0 AND 5)
);
