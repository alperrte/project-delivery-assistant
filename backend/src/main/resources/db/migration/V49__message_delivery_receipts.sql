-- Add per-recipient delivery confirmation to the existing receipts table.
-- delivered_at: when the recipient's client acknowledged receiving the message (not just server send).
-- NULL means not yet confirmed delivered. read_at IS NOT NULL implies delivered (cannot read without receiving).
ALTER TABLE chat_message_receipts ADD COLUMN delivered_at timestamptz;

-- If a message is already read it was certainly delivered. Backfill delivered_at from read_at for existing rows.
UPDATE chat_message_receipts SET delivered_at = read_at WHERE read_at IS NOT NULL;

-- Index for efficient "all delivered?" queries on a single message.
CREATE INDEX ix_chat_receipts_msg_delivered ON chat_message_receipts(message_id) WHERE delivered_at IS NOT NULL;
