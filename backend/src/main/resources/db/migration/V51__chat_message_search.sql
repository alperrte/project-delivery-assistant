-- No external service: literal substring search uses PostgreSQL's trusted trigram extension.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION pda_chat_search_text(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT lower(translate(normalize(value, NFC), 'Iİı', 'iii'))
$$;

CREATE INDEX ix_chat_message_search ON chat_messages
USING gin (pda_chat_search_text(content) gin_trgm_ops) WHERE deleted_at IS NULL;
-- The existing (conversation_id, created_at, id) btree remains the history/context cursor index.
