-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE chat_conversations (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    type VARCHAR(10) NOT NULL,
    direct_user_low uuid,
    direct_user_high uuid,
    created_at TIMESTAMPTZ NOT NULL,
    last_message_at TIMESTAMPTZ,
    CONSTRAINT chat_conversations_pkey PRIMARY KEY (id),
    CONSTRAINT chat_conversations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT ck_chat_conversations_participants CHECK (((((type)::text = 'PROJECT'::text) AND (direct_user_low IS NULL) AND (direct_user_high IS NULL)) OR (((type)::text = 'DIRECT'::text) AND (direct_user_low IS NOT NULL) AND (direct_user_high IS NOT NULL) AND (direct_user_low < direct_user_high)))),
    CONSTRAINT ck_chat_conversations_type CHECK ((type IN ('PROJECT', 'DIRECT')))
);

CREATE INDEX ix_chat_conversations_direct_high ON chat_conversations USING btree (project_id, direct_user_high) WHERE ((type)::text = 'DIRECT'::text);

CREATE UNIQUE INDEX uk_chat_conversations_direct ON chat_conversations USING btree (project_id, direct_user_low, direct_user_high) WHERE ((type)::text = 'DIRECT'::text);

CREATE UNIQUE INDEX uk_chat_conversations_project ON chat_conversations USING btree (project_id) WHERE ((type)::text = 'PROJECT'::text);

CREATE TABLE chat_messages (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    content text NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    reply_to_message_id uuid,
    reaction_version bigint DEFAULT 0 NOT NULL,
    CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
    CONSTRAINT ck_chat_messages_content CHECK (((char_length(content) >= 1) AND (char_length(content) <= 2000))),
    CONSTRAINT ck_chat_messages_reaction_version CHECK ((reaction_version >= 0)),
    CONSTRAINT ck_chat_messages_reply_not_self CHECK ((reply_to_message_id <> id)),
    CONSTRAINT fk_chat_messages_reply_conversation FOREIGN KEY (reply_to_message_id, conversation_id) REFERENCES chat_messages(id, conversation_id),
    CONSTRAINT uk_chat_messages_id_conversation UNIQUE (id, conversation_id)
);

CREATE INDEX ix_chat_messages_conversation ON chat_messages USING btree (conversation_id, created_at DESC, id DESC);

CREATE INDEX ix_chat_messages_reply ON chat_messages USING btree (reply_to_message_id) WHERE (reply_to_message_id IS NOT NULL);

CREATE TABLE chat_read_states (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chat_read_states_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    CONSTRAINT chat_read_states_pkey PRIMARY KEY (conversation_id, user_id)
);
