ALTER TABLE chat_messages ADD COLUMN reply_to_message_id UUID;
ALTER TABLE chat_messages ADD COLUMN reaction_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE chat_messages ADD CONSTRAINT ck_chat_messages_reaction_version CHECK (reaction_version >= 0);
ALTER TABLE chat_messages ADD CONSTRAINT uk_chat_messages_id_conversation UNIQUE (id, conversation_id);
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_reply_conversation
    FOREIGN KEY (reply_to_message_id, conversation_id) REFERENCES chat_messages (id, conversation_id);
ALTER TABLE chat_messages ADD CONSTRAINT ck_chat_messages_reply_not_self CHECK (reply_to_message_id <> id);
CREATE INDEX ix_chat_messages_reply ON chat_messages (reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;

CREATE TABLE chat_message_reactions (
    message_id UUID NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    emoji_code VARCHAR(16) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (message_id, user_id, emoji_code),
    CONSTRAINT ck_chat_message_reactions_code CHECK
        (emoji_code IN ('THUMBS_UP', 'HEART', 'LAUGH', 'SURPRISED', 'SAD', 'THANKS'))
);
