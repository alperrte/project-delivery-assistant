CREATE TABLE user_oauth_identities (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    provider VARCHAR(32) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    provider_email VARCHAR(320),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_user_oauth_provider_subject UNIQUE (provider, provider_subject),
    CONSTRAINT uk_user_oauth_user_provider UNIQUE (user_id, provider),
    CONSTRAINT ck_user_oauth_provider CHECK (provider ~ '^[A-Z_]{2,32}$')
);
