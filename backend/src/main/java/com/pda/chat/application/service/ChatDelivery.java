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

    /** The user read the conversation; only that user's own sessions are told (unread sync across tabs). */
    void conversationRead(UUID projectId, UUID conversationId, UUID userId);
}
