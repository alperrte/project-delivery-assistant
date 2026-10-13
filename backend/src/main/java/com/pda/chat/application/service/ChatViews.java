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

    /**
     * Per-message delivery status from the sender's perspective.
     * SENT = saved on server, not yet delivered to all recipients.
     * DELIVERED = all recipients have confirmed receiving it.
     * READ = all recipients have read it.
     */
    public enum MessageDeliveryStatus { SENT, DELIVERED, READ }

    /** Minimum user summary; the photo itself is fetched by the client from the profile photo endpoint. */
    public record ChatUser(UUID userId, String nickname, Long profilePhotoVersion) {
    }

    public record ReplyView(UUID id, ChatUser sender, String preview, boolean deleted) { }
    public record ReactionView(ChatReactionCode code, String emoji, long count, boolean reactedByCurrentUser) { }
    public record ReactionSnapshot(UUID messageId, String reactionVersion, List<ReactionView> reactions) { }
    public record AttachmentView(UUID id,String filename,String contentType,int size) {}
    public record MessageView(UUID id, UUID conversationId, String content, Instant createdAt, ChatUser sender,
                              ReplyView replyTo, String reactionVersion, List<ReactionView> reactions, boolean deleted,
                              AttachmentView attachment, MessageDeliveryStatus deliveryStatus) {
        /** Compat: no attachment, SENT status (caller is not the sender, status irrelevant). */
        public MessageView(UUID id,UUID conversationId,String content,Instant createdAt,ChatUser sender,
                           ReplyView replyTo,String reactionVersion,List<ReactionView> reactions,boolean deleted) {
            this(id,conversationId,content,createdAt,sender,replyTo,reactionVersion,reactions,deleted,null,MessageDeliveryStatus.SENT);
        }
        /** Compat: no attachment and no delivery status. */
        public MessageView(UUID id,UUID conversationId,String content,Instant createdAt,ChatUser sender,
                           ReplyView replyTo,String reactionVersion,List<ReactionView> reactions,boolean deleted,AttachmentView attachment) {
            this(id,conversationId,content,createdAt,sender,replyTo,reactionVersion,reactions,deleted,attachment,MessageDeliveryStatus.SENT);
        }
        public MessageView(UUID id, UUID conversationId, String content, Instant createdAt, ChatUser sender) {
            this(id,conversationId,content,createdAt,sender,null,"0",List.of(),false);
        }
    }

    /** "{@code userId} has read this conversation up to {@code readAt}": the basis of the "seen" indicator. */
    public record ReceiptView(UUID userId, Instant readAt, UUID messageId) {
        public ReceiptView(UUID userId,Instant readAt) {this(userId,readAt,null);}
    }
    public record MessageReader(ChatUser user,Instant readAt,boolean legacy) {}
    public record MessageInfo(UUID messageId,List<MessageReader> readers) {}

    /** What the conversation list shows of the newest message: a short single-line preview. */
    public record LastMessageView(String preview, Instant createdAt, UUID senderUserId, boolean deleted) {
    }

    /** {@code peer} is the other participant of a DIRECT conversation and null for the project group. */
    public record ConversationView(UUID id, ChatConversationType type, ChatUser peer, LastMessageView lastMessage,
                                   long unread, UUID projectId, String projectName, Long logoVersion, com.pda.project.LogoShape logoShape) {
        public ConversationView(UUID id, ChatConversationType type, ChatUser peer, LastMessageView lastMessage, long unread) { this(id,type,peer,lastMessage,unread,null,null,null,com.pda.project.LogoShape.SQUARE); }
    }

    public record OverviewView(ConversationView group, List<ConversationView> directs, long totalUnread, List<ConversationView> groups) {
        public OverviewView(ConversationView group,List<ConversationView> directs,long totalUnread) { this(group,directs,totalUnread,List.of(group)); }
    }

    /** Another active member of the project; {@code conversationId} is set once a direct conversation exists. */
    public record MemberView(ChatUser user, UUID conversationId) {
    }

    /** Messages oldest to newest; {@code hasMore} tells whether more exist in the direction that was paged. */
    public record SearchPage(List<MessageView> messages, long total, int page, int size) { }
    public record MessageContext(List<MessageView> messages, boolean hasOlder, boolean hasNewer) { }

    public record MessagePage(List<MessageView> messages, boolean hasMore) {
    }
}
