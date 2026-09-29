CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    recipient_user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message VARCHAR(500) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ,
    actor_user_id UUID,
    project_id UUID,
    resource_type VARCHAR(20) NOT NULL,
    resource_id UUID NOT NULL
);
CREATE INDEX ix_notifications_recipient_created ON notifications (recipient_user_id, created_at DESC, id DESC);
CREATE INDEX ix_notifications_recipient_unread ON notifications (recipient_user_id, created_at DESC, id DESC) WHERE is_read = FALSE;
