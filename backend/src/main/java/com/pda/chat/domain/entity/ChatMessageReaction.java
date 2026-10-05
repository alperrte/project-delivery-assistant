package com.pda.chat.domain.entity;

import com.pda.chat.domain.enums.ChatReactionCode;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "chat_message_reactions")
public class ChatMessageReaction {
    @EmbeddedId private Id id;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    protected ChatMessageReaction() { }

    public static ChatMessageReaction create(UUID messageId, UUID userId, ChatReactionCode code, Instant now) {
        ChatMessageReaction result = new ChatMessageReaction();
        result.id = new Id(messageId, userId, code);
        result.createdAt = Objects.requireNonNull(now).truncatedTo(ChronoUnit.MICROS);
        return result;
    }
    public Id getId() { return id; }
    public Instant getCreatedAt() { return createdAt; }

    @Embeddable
    public static class Id implements Serializable {
        private static final long serialVersionUID = 1L;
        @Column(name = "message_id", nullable = false, updatable = false) private UUID messageId;
        @Column(name = "user_id", nullable = false, updatable = false) private UUID userId;
        @Enumerated(EnumType.STRING)
        @Column(name = "emoji_code", nullable = false, updatable = false, length = 16) private ChatReactionCode code;
        protected Id() { }
        public Id(UUID messageId, UUID userId, ChatReactionCode code) {
            this.messageId = Objects.requireNonNull(messageId);
            this.userId = Objects.requireNonNull(userId);
            this.code = Objects.requireNonNull(code);
        }
        public UUID getMessageId() { return messageId; }
        public UUID getUserId() { return userId; }
        public ChatReactionCode getCode() { return code; }
        @Override public boolean equals(Object other) {
            return other instanceof Id value && messageId.equals(value.messageId) && userId.equals(value.userId) && code == value.code;
        }
        @Override public int hashCode() { return Objects.hash(messageId, userId, code); }
    }
}
