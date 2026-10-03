-- Project chat: one automatic PROJECT group conversation per project plus 1:1 DIRECT conversations between two
-- members of the same project. There is deliberately no participants table: a DIRECT conversation stores its two
-- participants as a canonically ordered pair (so A<->B and B<->A are the same row and a self chat cannot exist), and
-- the PROJECT group derives its audience from ProjectMembership. A message is ONE row however many people read it.
-- Rows are never deleted when a member leaves the project: access is decided per request, the history stays intact.
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id),
    type VARCHAR(10) NOT NULL,
    direct_user_low UUID,
    direct_user_high UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_chat_conversations_type CHECK (type IN ('PROJECT', 'DIRECT')),
    CONSTRAINT ck_chat_conversations_participants CHECK (
        (type = 'PROJECT' AND direct_user_low IS NULL AND direct_user_high IS NULL)
        OR (type = 'DIRECT' AND direct_user_low IS NOT NULL AND direct_user_high IS NOT NULL
            AND direct_user_low < direct_user_high))
);

-- Exactly one group per project and exactly one direct conversation per unordered pair per project; these indexes
-- are what makes the find-or-create race safe (INSERT ... ON CONFLICT DO NOTHING).
CREATE UNIQUE INDEX uk_chat_conversations_project ON chat_conversations (project_id) WHERE type = 'PROJECT';
CREATE UNIQUE INDEX uk_chat_conversations_direct
    ON chat_conversations (project_id, direct_user_low, direct_user_high) WHERE type = 'DIRECT';
-- "Which direct conversations does this user have in this project" from either side of the pair.
CREATE INDEX ix_chat_conversations_direct_high ON chat_conversations (project_id, direct_user_high) WHERE type = 'DIRECT';

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES chat_conversations (id),
    sender_user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_chat_messages_content CHECK (char_length(content) BETWEEN 1 AND 2000)
);

-- History cursor (before/after), last message and unread count all walk one conversation in time order.
CREATE INDEX ix_chat_messages_conversation ON chat_messages (conversation_id, created_at DESC, id DESC);

-- Read state is one row per (conversation, user), not per message.
CREATE TABLE chat_read_states (
    conversation_id UUID NOT NULL REFERENCES chat_conversations (id),
    user_id UUID NOT NULL,
    last_read_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);
