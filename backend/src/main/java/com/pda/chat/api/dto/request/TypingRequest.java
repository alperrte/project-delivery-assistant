package com.pda.chat.api.dto.request;

/**
 * Only whether the caller is typing. The typist is the authenticated user and the conversation is in the path; nothing
 * about identity is read from the body. A missing value counts as "stopped typing".
 */
public record TypingRequest(Boolean typing) {
}
