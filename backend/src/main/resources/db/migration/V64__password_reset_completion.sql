-- Forgot-password is now three steps: e-mail -> code -> new password. The code is consumed in step two and hands out a
-- short-lived ticket; completed_at marks the ticket as used so the new password can be set only once per code.
ALTER TABLE password_reset_challenges ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;

-- Changing the password from the account settings now needs a code mailed to the account first. Same shape and rules as
-- password_reset_challenges (hashed, 15 minutes, 5 guesses per code, hourly failure window, single use ticket).
CREATE TABLE password_change_challenges (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    code_hash VARCHAR(64) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    consumed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    window_failures INT NOT NULL DEFAULT 0,
    failure_window_started_at TIMESTAMP WITH TIME ZONE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_password_change_challenges_user UNIQUE (user_id),
    CONSTRAINT ck_password_change_challenges_hash CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_password_change_challenges_attempts CHECK (attempt_count BETWEEN 0 AND 5),
    CONSTRAINT ck_password_change_challenges_window_failures CHECK (window_failures >= 0)
);
