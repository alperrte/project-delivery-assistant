-- A rejoined membership row cannot describe its earlier participation interval. Preserve positive historical
-- read evidence even when that older interval is no longer retained in project_memberships.
INSERT INTO chat_message_receipts(message_id,user_id,read_at,legacy)
SELECT m.id,r.user_id,r.last_read_at,true
FROM chat_messages m
JOIN chat_conversations c ON c.id=m.conversation_id AND c.type='PROJECT'
JOIN chat_read_states r ON r.conversation_id=c.id AND r.last_read_at>=m.created_at
WHERE m.sender_user_id<>r.user_id
ON CONFLICT(message_id,user_id) DO NOTHING;
