-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE admin_audit_events (
    id uuid NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    actor_user_id uuid,
    action VARCHAR(40) NOT NULL,
    target_type VARCHAR(24) NOT NULL,
    target_id uuid,
    outcome VARCHAR(8) NOT NULL,
    CONSTRAINT admin_audit_events_action_check CHECK ((action IN ('ADMIN_SIGN_IN', 'USER_DISABLE', 'USER_ENABLE', 'SESSION_REVOKE', 'SESSION_REVOKE_ALL', 'SUPPORT_REQUEST_STATUS_CHANGE'))),
    CONSTRAINT admin_audit_events_outcome_check CHECK ((outcome IN ('SUCCESS', 'FAILURE', 'DENIED'))),
    CONSTRAINT admin_audit_events_pkey PRIMARY KEY (id),
    CONSTRAINT admin_audit_events_target_type_check CHECK ((target_type IN ('USER', 'SUPPORT_REQUEST', 'SYSTEM')))
);

CREATE INDEX idx_admin_audit_events_action_occurred_at ON admin_audit_events USING btree (action, occurred_at);

CREATE INDEX idx_admin_audit_events_occurred_at ON admin_audit_events USING btree (occurred_at);
