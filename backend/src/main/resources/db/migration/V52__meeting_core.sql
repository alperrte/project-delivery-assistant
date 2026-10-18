CREATE TABLE meetings (
    id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, organizer_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(160) NOT NULL, description VARCHAR(4000) NOT NULL DEFAULT '',
    starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, zone_id VARCHAR(80) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK(status IN ('SCHEDULED','OPEN','ENDED','CANCELLED')),
    room_name VARCHAR(100) NOT NULL UNIQUE, room_epoch INTEGER NOT NULL DEFAULT 0,
    rotation_pending BOOLEAN NOT NULL DEFAULT FALSE,pending_room_name VARCHAR(100),opened_at TIMESTAMPTZ, ended_at TIMESTAMPTZ,
    overtime_at TIMESTAMPTZ, empty_since TIMESTAMPTZ, ever_joined BOOLEAN NOT NULL DEFAULT FALSE,
    cleanup_pending BOOLEAN NOT NULL DEFAULT FALSE, cleanup_attempts INTEGER NOT NULL DEFAULT 0,
    cleanup_retry_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT meeting_time_order CHECK(starts_at < ends_at AND ends_at <= starts_at + INTERVAL '24 hours')
);
CREATE INDEX meeting_project_schedule_idx ON meetings(project_id,starts_at,id);
CREATE INDEX meeting_due_idx ON meetings(status,starts_at);
CREATE INDEX meeting_cleanup_idx ON meetings(cleanup_retry_at) WHERE cleanup_pending;
CREATE TABLE meeting_agenda (meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE, position INTEGER NOT NULL, content VARCHAR(1000) NOT NULL, PRIMARY KEY(meeting_id,position));
CREATE TABLE meeting_attendees (meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,user_id UUID NOT NULL REFERENCES users(id),PRIMARY KEY(meeting_id,user_id));
CREATE TABLE meeting_invites (
    id UUID PRIMARY KEY,meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE, token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,max_uses INTEGER NOT NULL CHECK(max_uses BETWEEN 1 AND 100),
    uses INTEGER NOT NULL DEFAULT 0 CHECK(uses>=0 AND uses<=max_uses),revoked BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX meeting_invites_meeting_idx ON meeting_invites(meeting_id);
CREATE TABLE meeting_participants (
    id UUID PRIMARY KEY,meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,user_id UUID REFERENCES users(id),
    invite_id UUID REFERENCES meeting_invites(id) ON DELETE CASCADE,identity VARCHAR(80) NOT NULL,display_name VARCHAR(80) NOT NULL,
    session_hash VARCHAR(64) UNIQUE,session_expires_at TIMESTAMPTZ,revoked BOOLEAN NOT NULL DEFAULT FALSE,
    connected BOOLEAN NOT NULL DEFAULT FALSE,joined_at TIMESTAMPTZ,left_at TIMESTAMPTZ,last_message_at TIMESTAMPTZ,last_token_at TIMESTAMPTZ,
    UNIQUE(meeting_id,identity),CONSTRAINT meeting_participant_kind CHECK((user_id IS NOT NULL AND invite_id IS NULL) OR (user_id IS NULL AND invite_id IS NOT NULL))
);
CREATE INDEX meeting_participants_invite_idx ON meeting_participants(invite_id);
CREATE TABLE meeting_chat_messages (
    id UUID PRIMARY KEY,meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,participant_id UUID NOT NULL REFERENCES meeting_participants(id) ON DELETE CASCADE,
    display_name VARCHAR(80) NOT NULL,content VARCHAR(2000) NOT NULL,sent_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX meeting_chat_history_idx ON meeting_chat_messages(meeting_id,sent_at DESC,id);
CREATE TABLE meeting_chat_mentions (message_id UUID NOT NULL REFERENCES meeting_chat_messages(id) ON DELETE CASCADE,participant_id UUID NOT NULL REFERENCES meeting_participants(id) ON DELETE CASCADE,PRIMARY KEY(message_id,participant_id));
CREATE TABLE meeting_audit (id UUID PRIMARY KEY,meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,actor_id UUID,target_id UUID,action VARCHAR(40) NOT NULL,occurred_at TIMESTAMPTZ NOT NULL);
CREATE INDEX meeting_audit_meeting_idx ON meeting_audit(meeting_id,occurred_at);
CREATE TABLE meeting_webhook_events (id VARCHAR(128) PRIMARY KEY,received_at TIMESTAMPTZ NOT NULL);
CREATE TABLE meeting_room_cleanup (room_name VARCHAR(100) PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 0,retry_at TIMESTAMPTZ NOT NULL);
CREATE INDEX meeting_room_cleanup_retry_idx ON meeting_room_cleanup(retry_at);
