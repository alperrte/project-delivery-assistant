ALTER TABLE user_sessions
    ADD COLUMN previous_refresh_token_hash VARCHAR(64),
    ADD COLUMN user_agent VARCHAR(255);

ALTER TABLE user_sessions
    ADD CONSTRAINT ck_user_sessions_previous_refresh_token_hash
        CHECK (previous_refresh_token_hash IS NULL OR previous_refresh_token_hash ~ '^[0-9a-f]{64}$');

CREATE INDEX ix_user_sessions_previous_refresh_token_hash
    ON user_sessions (previous_refresh_token_hash)
    WHERE previous_refresh_token_hash IS NOT NULL;
