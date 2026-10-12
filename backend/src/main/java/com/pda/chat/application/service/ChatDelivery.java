package com.pda.chat.application.service;

import com.pda.chat.application.service.ChatViews.MessageView;
import com.pda.chat.domain.enums.ChatConversationType;

import java.util.Set;
import java.util.UUID;

/**
 * Port the real-time transport implements. It is called only after the database transaction has committed, so a
 * client never receives something that was rolled back. Implementations resolve the audience at delivery time from
 * current project membership, so a member removed a moment ago receives nothing.
 */
public interface ChatDelivery {

    /**
     * Immutable and entity-free by design. {@code directParticipants} lists the two users of a DIRECT conversation
     * and is empty for the project group, whose audience is the project's active members.
     */
    record ChatMessageSent(UUID projectId, UUID conversationId, ChatConversationType type,
                           Set<UUID> directParticipants, MessageView message) {
    }

    void messageSent(ChatMessageSent event);

    record ChatReactionsChanged(UUID projectId, UUID conversationId, ChatConversationType type,
                                Set<UUID> directParticipants, UUID messageId, long committedVersion) { }
    void reactionsChanged(ChatReactionsChanged event);

    /** The user read the conversation up to {@code readAt}; the other participants learn it ("seen"). */
    record ChatSeen(UUID projectId, UUID conversationId, ChatConversationType type, Set<UUID> directParticipants,
                    UUID userId, java.time.Instant readAt) {
    }

    void seen(ChatSeen event);

    /** The sender deleted a message; everybody in the audience (the deleter's other tabs included) is told its id. */
    record ChatMessageDeleted(UUID projectId, UUID conversationId, ChatConversationType type,
                              Set<UUID> directParticipants, UUID messageId) {
    }

    void messageDeleted(ChatMessageDeleted event);

    /**
     * A recipient has confirmed delivery of one or more messages (they were received on the client device).
     * The sender's sessions are told so their tick icons can advance from single to double tick.
     * {@code recipientId} is the user who acknowledged, {@code messageIds} are the messages now delivered.
     */
    record ChatDelivered(UUID projectId, UUID conversationId, ChatConversationType type,
                         Set<UUID> directParticipants, UUID recipientId, java.util.List<UUID> messageIds) {
    }

    void delivered(ChatDelivered event);

    /**
     * Ephemeral "is typing" signal; never persisted. The audience is the other participants only (the typist's own
     * sessions are excluded), resolved from current membership like every other delivery.
     */
    record ChatTyping(UUID projectId, UUID conversationId, ChatConversationType type, Set<UUID> directParticipants,
                      UUID userId, String nickname, boolean typing) {
    }

    void typing(ChatTyping event);

    /** The user read the conversation; only that user's own sessions are told (unread sync across tabs). */
    void conversationRead(UUID projectId, UUID conversationId, UUID userId);
}
