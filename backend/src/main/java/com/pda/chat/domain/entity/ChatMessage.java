package com.pda.chat.domain.entity;

import com.pda.chat.domain.ChatException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.UUID;

/**
 * One text message. A message is a single row however many people read it (no per-recipient rows). The content is
 * plain text: it is never interpreted as markup and must never be rendered as HTML. The sender always comes from the
 * authenticated principal, never from a request body.
 */
@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    public static final int CONTENT_LIMIT = 2000;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "conversation_id", nullable = false, updatable = false)
    private UUID conversationId;

    @Column(name = "sender_user_id", nullable = false, updatable = false)
    private UUID senderUserId;

    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "reply_to_message_id", updatable = false)
    private UUID replyToMessageId;

    @Column(name = "reaction_version", nullable = false)
    private long reactionVersion;

    protected ChatMessage() {
        // JPA
    }

    public static ChatMessage create(UUID conversationId, UUID senderUserId, String content, Instant now) {
        return create(conversationId, senderUserId, content, null, now);
    }

    public static ChatMessage create(UUID conversationId, UUID senderUserId, String content, UUID replyToMessageId, Instant now) {
        ChatMessage message = new ChatMessage();
        message.conversationId = Objects.requireNonNull(conversationId, "conversationId is required");
        message.senderUserId = Objects.requireNonNull(senderUserId, "senderUserId is required");
        message.content = normalize(content);
        message.replyToMessageId = replyToMessageId;
        // PostgreSQL keeps microseconds: truncating here keeps the (created_at, id) cursor identical before and after
        // a round trip through the database.
        message.createdAt = Objects.requireNonNull(now, "now is required").truncatedTo(ChronoUnit.MICROS);
        return message;
    }

    /**
     * The one validation of message text (the frontend only mirrors it): line endings become a single newline, the
     * outer whitespace is stripped, and the result must be non-empty, at most {@value #CONTENT_LIMIT} characters
     * (code points) and free of control characters other than newline and tab.
     */
    public static String normalize(String raw) {
        if (raw == null) {
            throw ChatException.invalid("CHAT_MESSAGE_EMPTY");
        }
        String text = raw.replace("\r\n", "\n").replace('\r', '\n').strip();
        if (text.isEmpty() || text.codePoints().allMatch(ChatMessage::invisible)) {
            throw ChatException.invalid("CHAT_MESSAGE_EMPTY");
        }
        if (text.codePointCount(0, text.length()) > CONTENT_LIMIT) {
            throw ChatException.invalid("CHAT_MESSAGE_TOO_LONG");
        }
        boolean forbiddenControl = text.codePoints()
                .anyMatch(cp -> Character.isISOControl(cp) && cp != '\n' && cp != '\t');
        if (forbiddenControl) {
            throw ChatException.invalid("CHAT_MESSAGE_INVALID");
        }
        return text;
    }

    /**
     * Whitespace {@link String#strip()} does not know about (no-break space, zero-width characters): a message made
     * only of these shows nothing, so it counts as blank.
     */
    private static boolean invisible(int codePoint) {
        return Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint)
                || Character.getType(codePoint) == Character.FORMAT;
    }

    public UUID getId() { return id; }
    public UUID getConversationId() { return conversationId; }
    public UUID getSenderUserId() { return senderUserId; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getReplyToMessageId() { return replyToMessageId; }
    public long getReactionVersion() { return reactionVersion; }
    public void reactionsChanged() { reactionVersion = Math.addExact(reactionVersion, 1); }
}
