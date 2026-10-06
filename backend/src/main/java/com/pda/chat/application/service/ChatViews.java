package com.pda.chat.application.service;

import com.pda.chat.domain.enums.ChatConversationType;
import com.pda.chat.domain.enums.ChatReactionCode;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Immutable results of the chat use cases. Nothing here carries an entity or an email address. */
public final class ChatViews {

    private ChatViews() {
    }

    /** Minimum user summary; the photo itself is fetched by the client from the profile photo endpoint. */
    public record ChatUser(UUID userId, String nickname, Long profilePhotoVersion) {
    }

    public record ReplyView(UUID id, ChatUser sender, String preview) { }
    public record ReactionView(ChatReactionCode code, String emoji, long count, boolean reactedByCurrentUser) { }
    public record ReactionSnapshot(UUID messageId, String reactionVersion, List<ReactionView> reactions) { }
    public record MessageView(UUID id, UUID conversationId, String content, Instant createdAt, ChatUser sender,
                              ReplyView replyTo, String reactionVersion, List<ReactionView> reactions) {
        public MessageView(UUID id, UUID conversationId, String content, Instant createdAt, ChatUser sender) {
            this(id,conversationId,content,createdAt,sender,null,"0",List.of());
        }
    }

    /** What the conversation list shows of the newest message: a short single-line preview. */
    public record LastMessageView(String preview, Instant createdAt, UUID senderUserId) {
    }

    /** {@code peer} is the other participant of a DIRECT conversation and null for the project group. */
    public record ConversationView(UUID id, ChatConversationType type, ChatUser peer, LastMessageView lastMessage,
                                   long unread) {
    }

    public record OverviewView(ConversationView group, List<ConversationView> directs, long totalUnread) {
    }

    /** Another active member of the project; {@code conversationId} is set once a direct conversation exists. */
    public record MemberView(ChatUser user, UUID conversationId) {
    }

    /** Messages oldest to newest; {@code hasMore} tells whether more exist in the direction that was paged. */
    public record MessagePage(List<MessageView> messages, boolean hasMore) {
    }
}
