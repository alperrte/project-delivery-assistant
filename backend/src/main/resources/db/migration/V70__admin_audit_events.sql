-- Persistent audit trail of administrator-relevant actions (24-month retention, see the retention job). Ids, an action
-- code, a target type/id, an outcome and the server time only: no free text, no e-mail address, no IP, no user agent.
-- actor_user_id is empty when the actor is not known (for example a refused administrator sign-in). There is no foreign
-- key on purpose: an audit row must outlive, and never block, the removal of the account it names.
CREATE TABLE admin_audit_events (
    id UUID PRIMARY KEY,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    actor_user_id UUID,
    action VARCHAR(40) NOT NULL CHECK (action IN ('ADMIN_SIGN_IN', 'USER_DISABLE', 'USER_ENABLE', 'SESSION_REVOKE',
        'SESSION_REVOKE_ALL', 'SUPPORT_REQUEST_STATUS_CHANGE')),
    target_type VARCHAR(24) NOT NULL CHECK (target_type IN ('USER', 'SUPPORT_REQUEST', 'SYSTEM')),
    target_id UUID,
    outcome VARCHAR(8) NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED'))
);

CREATE INDEX idx_admin_audit_events_occurred_at ON admin_audit_events (occurred_at);
CREATE INDEX idx_admin_audit_events_action_occurred_at ON admin_audit_events (action, occurred_at);
