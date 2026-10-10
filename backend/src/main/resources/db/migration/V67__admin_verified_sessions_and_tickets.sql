-- Separate administrator sign-in. A session only reaches the administrator API when it was opened by the administrator
-- sign-in (password plus authenticator code, or first-time authenticator enrolment); that moment is stored here.
-- Sessions that exist before this migration have no value and therefore cannot use the administrator API.
ALTER TABLE user_sessions ADD COLUMN admin_verified_at TIMESTAMP WITH TIME ZONE;

-- Single-use proof between the administrator password step and the authenticator step (purpose ADMIN_MFA) or the
-- first-time authenticator enrolment (ADMIN_ENROLL). The signed cookie only carries this row's id; the row decides.
-- One live ticket per account and purpose is kept by the application (a new password step replaces the old ticket).
CREATE TABLE admin_auth_tickets (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_admin_auth_tickets_purpose CHECK (purpose IN ('ADMIN_MFA', 'ADMIN_ENROLL'))
);

CREATE INDEX ix_admin_auth_tickets_user ON admin_auth_tickets (user_id);
CREATE INDEX ix_admin_auth_tickets_expires ON admin_auth_tickets (expires_at);
