-- Meeting chat replies: a message may answer another message of the SAME meeting. The pair (reply_to_message_id, meeting_id) must
-- exist as (id, meeting_id), so the database itself refuses an answer to a message of another meeting. When the answered message is
-- deleted (chat retention, or its meeting) only the link is cleared (ON DELETE SET NULL on the link column alone).
ALTER TABLE meeting_chat_messages ADD COLUMN reply_to_message_id UUID;
ALTER TABLE meeting_chat_messages ADD CONSTRAINT uk_meeting_chat_message_meeting UNIQUE (id, meeting_id);
ALTER TABLE meeting_chat_messages ADD CONSTRAINT fk_meeting_chat_reply FOREIGN KEY (reply_to_message_id, meeting_id)
    REFERENCES meeting_chat_messages (id, meeting_id) ON DELETE SET NULL (reply_to_message_id);
ALTER TABLE meeting_chat_messages ADD CONSTRAINT ck_meeting_chat_not_self_reply CHECK (reply_to_message_id IS NULL OR reply_to_message_id <> id);
CREATE INDEX ix_meeting_chat_reply ON meeting_chat_messages (reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;

-- Emoji reactions. The key (message, participant, emoji) is what makes adding idempotent and a person count once per emoji; the
-- identity is the verified meeting participant (a member or a guest session), never a display name. Rows go with their message or
-- participant.
CREATE TABLE meeting_chat_reactions (
    message_id UUID NOT NULL REFERENCES meeting_chat_messages(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES meeting_participants(id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 32),
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (message_id, participant_id, emoji)
);
CREATE INDEX ix_meeting_chat_reactions_participant ON meeting_chat_reactions (participant_id);
