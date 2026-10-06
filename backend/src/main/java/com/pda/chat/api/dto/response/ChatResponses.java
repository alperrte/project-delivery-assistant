package com.pda.chat.api.dto.response;

import com.pda.chat.application.service.ChatViews;
import com.pda.chat.domain.enums.ChatConversationType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Wire shapes of the chat API. {@code profilePhotoVersion} is the cache-busting version of
 * {@code /users/{id}/profile-photo}, null when the user has no photo. No shape contains an email address.
 */
public final class ChatResponses {

    private ChatResponses() {
    }

    public record UserSummary(UUID userId, String nickname, Long profilePhotoVersion) {
        static UserSummary from(ChatViews.ChatUser user) {
            return user == null ? null : new UserSummary(user.userId(), user.nickname(), user.profilePhotoVersion());
        }
    }

    public record Reply(UUID id, UserSummary sender, String preview) { }
    public record Reaction(String code, String emoji, long count, boolean reactedByCurrentUser) {
        static Reaction from(ChatViews.ReactionView view) { return new Reaction(view.code().name(),view.emoji(),view.count(),view.reactedByCurrentUser()); }
    }
    public record Reactions(UUID messageId, String reactionVersion, List<Reaction> reactions) {
        public static Reactions from(ChatViews.ReactionSnapshot view) { return new Reactions(view.messageId(),view.reactionVersion(),view.reactions().stream().map(Reaction::from).toList()); }
    }
    public record Message(UUID id, UUID conversationId, String content, Instant createdAt, UserSummary sender,
                          Reply replyTo, String reactionVersion, List<Reaction> reactions) {
        public static Message from(ChatViews.MessageView view) {
            return new Message(view.id(), view.conversationId(), view.content(), view.createdAt(),
                    UserSummary.from(view.sender()), view.replyTo()==null?null:new Reply(view.replyTo().id(),UserSummary.from(view.replyTo().sender()),view.replyTo().preview()),
                    view.reactionVersion(),view.reactions().stream().map(Reaction::from).toList());
        }
    }

    public record LastMessage(String preview, Instant createdAt, UUID senderUserId) {
        static LastMessage from(ChatViews.LastMessageView view) {
            return view == null ? null : new LastMessage(view.preview(), view.createdAt(), view.senderUserId());
        }
    }

    /** {@code peer} is null for the project group. */
    public record Conversation(UUID id, ChatConversationType type, UserSummary peer, LastMessage lastMessage,
                               long unread) {
        public static Conversation from(ChatViews.ConversationView view) {
            return new Conversation(view.id(), view.type(), UserSummary.from(view.peer()),
                    LastMessage.from(view.lastMessage()), view.unread());
        }
    }

    public record Overview(Conversation group, List<Conversation> directs, long totalUnread) {
        public static Overview from(ChatViews.OverviewView view) {
            return new Overview(Conversation.from(view.group()),
                    view.directs().stream().map(Conversation::from).toList(), view.totalUnread());
        }
    }

    /** Another member of the project; {@code conversationId} is null until a direct conversation exists. */
    public record Member(UUID userId, String nickname, Long profilePhotoVersion, UUID conversationId) {
        public static Member from(ChatViews.MemberView view) {
            return new Member(view.user().userId(), view.user().nickname(), view.user().profilePhotoVersion(),
                    view.conversationId());
        }
    }

    public record MessagePage(List<Message> messages, boolean hasMore) {
        public static MessagePage from(ChatViews.MessagePage page) {
            return new MessagePage(page.messages().stream().map(Message::from).toList(), page.hasMore());
        }
    }
}
