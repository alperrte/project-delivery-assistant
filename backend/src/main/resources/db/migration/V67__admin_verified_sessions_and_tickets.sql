-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE admin_auth_tickets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    CONSTRAINT admin_auth_tickets_pkey PRIMARY KEY (id),
    CONSTRAINT admin_auth_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ck_admin_auth_tickets_purpose CHECK ((purpose IN ('ADMIN_MFA', 'ADMIN_ENROLL')))
);

CREATE INDEX ix_admin_auth_tickets_expires ON admin_auth_tickets USING btree (expires_at);

CREATE INDEX ix_admin_auth_tickets_user ON admin_auth_tickets USING btree (user_id);
