package com.pda.chat.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/**
 * "This user has read this conversation up to {@code lastReadAt}": one row per (conversation, user) instead of one
 * per message. Messages from others newer than it are unread. Written only through the repository's upsert.
 */
@Entity
@Table(name = "chat_read_states")
@IdClass(ChatReadState.Key.class)
public class ChatReadState {

    @Id
    @Column(name = "conversation_id", nullable = false, updatable = false)
    private UUID conversationId;

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "last_read_at", nullable = false)
    private Instant lastReadAt;

    protected ChatReadState() {
        // JPA
    }

    public UUID getConversationId() { return conversationId; }
    public UUID getUserId() { return userId; }
    public Instant getLastReadAt() { return lastReadAt; }

    public record Key(UUID conversationId, UUID userId) implements Serializable {
    }
}
