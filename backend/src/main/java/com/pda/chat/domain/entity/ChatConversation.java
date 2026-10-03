package com.pda.chat.domain.entity;

import com.pda.chat.domain.enums.ChatConversationType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A conversation of one project: its automatic PROJECT group, or a DIRECT conversation between two members. The two
 * direct participants are stored as a canonically ordered pair ({@code directUserLow < directUserHigh}, the same order
 * PostgreSQL uses for {@code uuid}), so A-B and B-A are one row and a chat with oneself is impossible. The database
 * enforces both facts; this class only builds rows that satisfy them.
 *
 * <p>Rows are created through {@code INSERT ... ON CONFLICT DO NOTHING} (see the repository) and read back, never
 * through {@code save}, so concurrent first uses cannot create duplicates.
 */
@Entity
@Table(name = "chat_conversations")
public class ChatConversation {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 10)
    private ChatConversationType type;

    @Column(name = "direct_user_low", updatable = false)
    private UUID directUserLow;

    @Column(name = "direct_user_high", updatable = false)
    private UUID directUserHigh;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;

    protected ChatConversation() {
        // JPA
    }

    public static ChatConversation projectGroup(UUID projectId, Instant now) {
        ChatConversation conversation = new ChatConversation();
        conversation.id = UUID.randomUUID();
        conversation.projectId = Objects.requireNonNull(projectId, "projectId is required");
        conversation.type = ChatConversationType.PROJECT;
        conversation.createdAt = Objects.requireNonNull(now, "now is required");
        return conversation;
    }

    public static ChatConversation direct(UUID projectId, UUID userA, UUID userB, Instant now) {
        Objects.requireNonNull(userA, "userA is required");
        Objects.requireNonNull(userB, "userB is required");
        if (userA.equals(userB)) {
            throw new IllegalArgumentException("A direct conversation needs two different users");
        }
        ChatConversation conversation = new ChatConversation();
        conversation.id = UUID.randomUUID();
        conversation.projectId = Objects.requireNonNull(projectId, "projectId is required");
        conversation.type = ChatConversationType.DIRECT;
        boolean aFirst = compareLikePostgres(userA, userB) < 0;
        conversation.directUserLow = aFirst ? userA : userB;
        conversation.directUserHigh = aFirst ? userB : userA;
        conversation.createdAt = Objects.requireNonNull(now, "now is required");
        return conversation;
    }

    /**
     * PostgreSQL orders {@code uuid} as 16 unsigned bytes, most significant first. {@link UUID#compareTo} compares
     * signed longs and would disagree for ids whose first bit is set, breaking the {@code low < high} constraint.
     */
    public static int compareLikePostgres(UUID a, UUID b) {
        int high = Long.compareUnsigned(a.getMostSignificantBits(), b.getMostSignificantBits());
        return high != 0 ? high : Long.compareUnsigned(a.getLeastSignificantBits(), b.getLeastSignificantBits());
    }

    /** True for everyone on the project group (membership is checked separately) and for the two direct users. */
    public boolean isParticipant(UUID userId) {
        return type == ChatConversationType.PROJECT
                || userId != null && (userId.equals(directUserLow) || userId.equals(directUserHigh));
    }

    /** The other participant of a DIRECT conversation as seen by {@code userId}; null for the project group. */
    public UUID peerOf(UUID userId) {
        if (type != ChatConversationType.DIRECT || userId == null) {
            return null;
        }
        if (userId.equals(directUserLow)) {
            return directUserHigh;
        }
        return userId.equals(directUserHigh) ? directUserLow : null;
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public ChatConversationType getType() { return type; }
    public UUID getDirectUserLow() { return directUserLow; }
    public UUID getDirectUserHigh() { return directUserHigh; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastMessageAt() { return lastMessageAt; }
}
