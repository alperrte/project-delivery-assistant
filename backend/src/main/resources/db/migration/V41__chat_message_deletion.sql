-- A deleted chat message stays as a tombstone ("this message was deleted"): replies, the keyset cursor and the
-- conversation preview keep working, while the text itself is erased (content becomes the empty string).

ALTER TABLE chat_messages ADD COLUMN deleted_at TIMESTAMPTZ;

ALTER TABLE chat_messages DROP CONSTRAINT ck_chat_messages_content;

ALTER TABLE chat_messages ADD CONSTRAINT ck_chat_messages_content CHECK (
    (deleted_at IS NULL AND char_length(content) >= 1 AND char_length(content) <= 2000)
    OR (deleted_at IS NOT NULL AND content = '')
);
