package com.pda.chat.api.dto.request;

/**
 * Only the text. There is deliberately no sender, recipient or conversation field: the sender is the authenticated
 * user, the conversation is in the path, and unknown JSON properties are ignored. The text rules (blank, length,
 * control characters) live in the domain so REST and any future transport share them.
 */
public record SendMessageRequest(String content, java.util.UUID replyToMessageId) {
}
