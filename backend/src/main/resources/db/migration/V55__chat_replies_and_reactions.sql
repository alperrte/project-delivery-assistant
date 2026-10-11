-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE chat_message_reactions (
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji_code VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chat_message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
    CONSTRAINT chat_message_reactions_pkey PRIMARY KEY (message_id, user_id, emoji_code),
    CONSTRAINT ck_chat_message_reactions_code CHECK ((emoji_code IN ('THUMBS_UP', 'HEART', 'LAUGH', 'SURPRISED', 'SAD', 'THANKS')))
);
