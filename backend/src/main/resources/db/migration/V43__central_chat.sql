-- Keep every message id, timestamp, reply, reaction and original read evidence.
CREATE TABLE chat_legacy_reads AS
SELECT m.id AS message_id, r.user_id, r.last_read_at AS read_at
FROM chat_messages m JOIN chat_read_states r ON r.conversation_id=m.conversation_id
WHERE m.created_at <= r.last_read_at AND m.sender_user_id <> r.user_id;
ALTER TABLE chat_conversations ALTER COLUMN project_id DROP NOT NULL;
CREATE TEMP TABLE dm_merge ON COMMIT DROP AS
SELECT id, first_value(id) OVER (PARTITION BY direct_user_low,direct_user_high ORDER BY created_at,id) AS keep_id
FROM chat_conversations WHERE type='DIRECT';
-- The composite reply FK must be deferred while parent and child conversation ids move together.
ALTER TABLE chat_messages ALTER CONSTRAINT fk_chat_messages_reply_conversation DEFERRABLE INITIALLY DEFERRED;
UPDATE chat_messages m SET conversation_id=d.keep_id FROM dm_merge d WHERE m.conversation_id=d.id AND d.id<>d.keep_id;
INSERT INTO chat_read_states(conversation_id,user_id,last_read_at)
SELECT d.keep_id,r.user_id,min(r.last_read_at) FROM chat_read_states r JOIN dm_merge d ON d.id=r.conversation_id
GROUP BY d.keep_id,r.user_id ON CONFLICT(conversation_id,user_id) DO UPDATE SET last_read_at=least(chat_read_states.last_read_at,excluded.last_read_at);
DELETE FROM chat_conversations c USING dm_merge d WHERE c.id=d.id AND d.id<>d.keep_id;
UPDATE chat_conversations SET project_id=NULL WHERE type='DIRECT';
DROP INDEX uk_chat_conversations_direct;
CREATE UNIQUE INDEX uk_chat_conversations_direct ON chat_conversations(direct_user_low,direct_user_high) WHERE type='DIRECT';
CREATE INDEX ix_chat_direct_user_low ON chat_conversations(direct_user_low) WHERE type='DIRECT';
CREATE INDEX ix_chat_direct_user_high ON chat_conversations(direct_user_high) WHERE type='DIRECT';
ALTER TABLE chat_conversations ADD CONSTRAINT ck_chat_scope CHECK ((type='DIRECT' AND project_id IS NULL) OR (type='PROJECT' AND project_id IS NOT NULL));
UPDATE chat_conversations c SET last_message_at=(SELECT max(created_at) FROM chat_messages m WHERE m.conversation_id=c.id);
