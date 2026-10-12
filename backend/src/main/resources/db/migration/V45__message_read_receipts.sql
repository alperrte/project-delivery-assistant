CREATE TABLE chat_message_receipts (
 message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
 user_id uuid NOT NULL, read_at timestamptz, legacy boolean NOT NULL DEFAULT false,
 PRIMARY KEY(message_id,user_id)
);
CREATE INDEX ix_chat_receipts_user_unread ON chat_message_receipts(user_id,message_id) WHERE read_at IS NULL;
-- Historical group audience is reconstructed only from retained membership intervals.
INSERT INTO chat_message_receipts(message_id,user_id,legacy)
SELECT m.id,p.user_id,true FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id
JOIN project_memberships p ON p.project_id=c.project_id AND p.joined_at<=m.created_at AND (p.removed_at IS NULL OR p.removed_at>m.created_at)
WHERE c.type='PROJECT' AND p.user_id<>m.sender_user_id ON CONFLICT DO NOTHING;
INSERT INTO chat_message_receipts(message_id,user_id,legacy)
SELECT m.id,u.id,true FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id
CROSS JOIN LATERAL (VALUES(c.direct_user_low),(c.direct_user_high)) u(id)
WHERE c.type='DIRECT' AND u.id<>m.sender_user_id ON CONFLICT DO NOTHING;
-- The previous system knew the latest conversation marker, never the first message read time.
UPDATE chat_message_receipts r SET read_at=l.read_at FROM chat_legacy_reads l WHERE l.message_id=r.message_id AND l.user_id=r.user_id;
DROP TABLE chat_legacy_reads;
