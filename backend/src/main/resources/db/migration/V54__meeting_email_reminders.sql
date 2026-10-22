ALTER TABLE meetings ADD COLUMN reminder_revision BIGINT NOT NULL DEFAULT 0 CHECK (reminder_revision >= 0);

-- Stores delivery metadata only. Email addresses, meeting text and tokens remain in their owning modules.
CREATE TABLE meeting_reminder_deliveries (
    id UUID PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL,
    reminder_revision BIGINT NOT NULL CHECK (reminder_revision >= 0),
    reminder_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','SENDING','RETRY','SENT','CANCELLED','FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
    last_attempt_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ NOT NULL,
    claim_token UUID,
    lease_until TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error_code VARCHAR(32) CHECK (error_code IN ('SMTP_TEMPORARY','SMTP_PERMANENT','ATTEMPTS_EXHAUSTED','NO_LONGER_ELIGIBLE')),
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (meeting_id, recipient_user_id, reminder_revision),
    CHECK ((status = 'SENDING') = (claim_token IS NOT NULL AND lease_until IS NOT NULL)),
    CHECK ((status = 'SENT') = (sent_at IS NOT NULL))
);
CREATE INDEX ix_meeting_reminder_due ON meeting_reminder_deliveries(next_attempt_at,id)
    WHERE status IN ('PENDING','RETRY');
CREATE INDEX ix_meeting_reminder_lease ON meeting_reminder_deliveries(lease_until,id) WHERE status='SENDING';
CREATE INDEX ix_meetings_scheduled_reminder ON meetings(starts_at,id) WHERE status='SCHEDULED';
