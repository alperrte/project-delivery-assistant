CREATE TABLE chat_attachments (
 id uuid PRIMARY KEY, message_id uuid UNIQUE REFERENCES chat_messages(id) ON DELETE SET NULL,
 owner_id uuid NOT NULL, filename varchar(180) NOT NULL, content_type varchar(100) NOT NULL,
 size integer NOT NULL CHECK(size BETWEEN 1 AND 2097152), state varchar(20) NOT NULL CHECK(state IN ('PENDING','ACTIVE','DELETE_PENDING')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_chat_attachments_cleanup ON chat_attachments(state,created_at);
ALTER TABLE chat_messages DROP CONSTRAINT ck_chat_messages_content;
ALTER TABLE chat_messages ADD CONSTRAINT ck_chat_messages_content CHECK(char_length(content)<=2000 AND (deleted_at IS NULL OR content=''));
