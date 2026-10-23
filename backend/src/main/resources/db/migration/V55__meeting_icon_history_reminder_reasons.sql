-- Meeting icon: a closed allowlist (never a free icon name); existing meetings keep the video icon.
ALTER TABLE meetings ADD COLUMN icon VARCHAR(24) NOT NULL DEFAULT 'video'
    CONSTRAINT meetings_icon_allowlist CHECK (icon IN ('video','users','calendar','presentation','code','laptop',
        'lightbulb','target','briefcase','graduation-cap','clipboard-list','message-square'));

-- Per-user, per-meeting "cleared from my history" preference. Clearing never deletes or changes the meeting, its chat,
-- audit, notifications or reminder records, and never affects another member's list.
CREATE TABLE meeting_user_hidden (
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hidden_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (meeting_id, user_id)
);
CREATE INDEX ix_meeting_user_hidden_user ON meeting_user_hidden(user_id, meeting_id);

-- A skipped reminder now says why (previously every skip was the generic NO_LONGER_ELIGIBLE).
ALTER TABLE meeting_reminder_deliveries DROP CONSTRAINT meeting_reminder_deliveries_error_code_check;
ALTER TABLE meeting_reminder_deliveries ADD CONSTRAINT meeting_reminder_deliveries_error_code_check
    CHECK (error_code IN ('SMTP_TEMPORARY','SMTP_PERMANENT','ATTEMPTS_EXHAUSTED','NO_LONGER_ELIGIBLE',
        'RECIPIENT_UNAVAILABLE','NOT_A_PROJECT_MEMBER','PROJECT_UNAVAILABLE','REMOVED_FROM_MEETING'));
