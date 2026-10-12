package com.pda.chat.api;

import com.pda.chat.api.dto.request.SendMessageRequest;
import com.pda.chat.api.dto.request.TypingRequest;
import com.pda.chat.api.dto.response.ChatResponses;
import com.pda.chat.application.service.ChatService;
import com.pda.chat.application.service.ChatReactionService;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/api/v1/projects/{projectId}/chat", "/api/v1/chat"})
public class ChatController {

    private final ChatService chat;
    private final ChatReactionService reactions;

    public ChatController(ChatService chat, ChatReactionService reactions) {
        this.chat = chat;
        this.reactions = reactions;
    }

    @GetMapping("/conversations")
    @Operation(summary = "Chat overview of a project",
            description = "Project members only. The project group (created on first use), the caller's direct "
                    + "conversations with last message preview and unread count, and the project's total unread.")
    public ChatResponses.Overview overview(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                           @PathVariable(required=false) UUID projectId) {
        return ChatResponses.Overview.from(chat.overview(actorId(principal), projectId));
    }

    @GetMapping("/members")
    @Operation(summary = "People the caller can chat with",
            description = "The other active members of the project (never an email address), with the id of the "
                    + "direct conversation when one exists.")
    public List<ChatResponses.Member> members(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                              @PathVariable(required=false) UUID projectId) {
        return chat.members(actorId(principal), projectId).stream().map(ChatResponses.Member::from).toList();
    }

    @PostMapping("/direct/{userId}")
    @Operation(summary = "Open a direct conversation",
            description = "Finds or creates the 1:1 conversation with another member of the same project (A to B and "
                    + "B to A are the same conversation). Yourself is 400, a non-member 404. Requires CSRF.")
    public ChatResponses.Conversation openDirect(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                 @PathVariable(required=false) UUID projectId, @PathVariable UUID userId) {
        return ChatResponses.Conversation.from(chat.openDirect(actorId(principal), projectId, userId));
    }

    @GetMapping("/conversations/{conversationId}/messages")
    @Operation(summary = "Read a conversation",
            description = "Newest page by default; before=messageId pages back, after=messageId returns newer "
                    + "messages oldest first (reconnect catch-up). limit 1..100, default 30. Messages are oldest to "
                    + "newest in every case.")
    public ResponseEntity<ChatResponses.MessagePage> messages(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                              @PathVariable(required=false) UUID projectId, @PathVariable UUID conversationId,
                                              @RequestParam(required = false) UUID before,
                                              @RequestParam(required = false) UUID after,
                                              @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok().header("Cache-Control","private, no-store").body(
                ChatResponses.MessagePage.from(chat.messages(actorId(principal), projectId, conversationId, before, after, limit)));
    }

    @PostMapping("/conversations/{conversationId}/messages")
    @Operation(summary = "Send a message",
            description = "Plain text, 1 to 2000 characters. The sender is always the authenticated user. Delivered "
                    + "to the participants over the WebSocket after commit. 30 messages per minute per user. "
                    + "Requires CSRF.")
    public ResponseEntity<ChatResponses.Message> send(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                      @PathVariable(required=false) UUID projectId, @PathVariable UUID conversationId,
                                                      @RequestBody SendMessageRequest request) {
        ChatResponses.Message body = ChatResponses.Message.from(
                chat.send(actorId(principal), projectId, conversationId, request.content(), request.replyToMessageId()));
        return ResponseEntity.status(HttpStatus.CREATED).header("Cache-Control", "private, no-store").body(body);
    }

    @PostMapping("/conversations/{conversationId}/read")
    @Operation(summary = "Mark a conversation read", description = "Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Conversation marked read")
    public ResponseEntity<Void> markRead(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                         @PathVariable(required=false) UUID projectId, @PathVariable UUID conversationId,
                                         @RequestBody(required=false) VisibleMessages request) {
        if(projectId==null) chat.markVisible(actorId(principal),conversationId,request==null?null:request.messageIds());
        else chat.markRead(actorId(principal), projectId, conversationId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/conversations/{conversationId}/delivered")
    @Operation(summary = "Acknowledge message delivery",
            description = "Acknowledges that the client has received the given messages. Updates delivered_at and notifies senders. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Delivery acknowledged")
    public ResponseEntity<Void> markDelivered(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                              @PathVariable(required = false) UUID projectId,
                                              @PathVariable UUID conversationId,
                                              @RequestBody(required = false) VisibleMessages request) {
        if (request != null && request.messageIds() != null && !request.messageIds().isEmpty()) {
            chat.markDelivered(actorId(principal), conversationId, request.messageIds());
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/conversations/{conversationId}/receipts")
    @Operation(summary = "Who has read the conversation",
            description = "Participants only. The other active members' read markers {userId, readAt}; a message is "
                    + "\"seen\" by someone when readAt is not before its createdAt. Updates arrive as SEEN events.")
    public ResponseEntity<List<ChatResponses.Receipt>> receipts(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                                @PathVariable(required=false) UUID projectId, @PathVariable UUID conversationId) {
        return ResponseEntity.ok().header("Cache-Control", "private, no-store").body(
                chat.receipts(actorId(principal), projectId, conversationId).stream().map(ChatResponses.Receipt::from).toList());
    }

    @DeleteMapping("/conversations/{conversationId}/messages/{messageId}")
    @Operation(summary = "Delete own message",
            description = "Only the sender can delete, for everybody. The text is erased and the message stays as a "
                    + "tombstone (replies keep working). Idempotent. Participants get a DELETED event over the "
                    + "WebSocket. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Message deleted (or already deleted)")
    public ResponseEntity<Void> deleteMessage(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                              @PathVariable(required=false) UUID projectId, @PathVariable UUID conversationId,
                                              @PathVariable UUID messageId) {
        chat.deleteMessage(actorId(principal), projectId, conversationId, messageId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/conversations/{conversationId}/typing")
    @Operation(summary = "Signal that the caller is typing",
            description = "Body {\"typing\": true|false}. Ephemeral and never stored: the other participants receive "
                    + "a TYPING event over the WebSocket. Same access rule as reading the conversation; the typist is "
                    + "always the authenticated user. 120 signals per minute per user. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Signal accepted")
    public ResponseEntity<Void> typing(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable(required=false) UUID projectId, @PathVariable UUID conversationId,
                                       @RequestBody TypingRequest request) {
        chat.typing(actorId(principal), projectId, conversationId, Boolean.TRUE.equals(request.typing()));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/conversations/{conversationId}/messages/{messageId}/reactions/{emojiCode}")
    @Operation(summary="Add own reaction", description="Idempotent; active project member and conversation participant only. Requires CSRF. Six canonical codes; 60 attempts per minute independently of message sends.")
    public ResponseEntity<ChatResponses.Reactions> react(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @PathVariable(required=false) UUID projectId,@PathVariable UUID conversationId,@PathVariable UUID messageId,@PathVariable String emojiCode) {
        return ResponseEntity.ok().header("Cache-Control","private, no-store").body(
                ChatResponses.Reactions.from(reactions.put(actorId(principal),projectId,conversationId,messageId,emojiCode)));
    }
    @DeleteMapping("/conversations/{conversationId}/messages/{messageId}/reactions/{emojiCode}")
    @Operation(summary="Remove own reaction", description="Idempotent; cannot remove another user's reaction. Requires CSRF. Returns current versioned snapshot, including an empty list after last removal.")
    public ResponseEntity<ChatResponses.Reactions> unreact(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @PathVariable(required=false) UUID projectId,@PathVariable UUID conversationId,@PathVariable UUID messageId,@PathVariable String emojiCode) {
        return ResponseEntity.ok().header("Cache-Control","private, no-store").body(
                ChatResponses.Reactions.from(reactions.remove(actorId(principal),projectId,conversationId,messageId,emojiCode)));
    }
    @GetMapping("/conversations/{conversationId}/messages/reactions")
    @Operation(summary="Refresh reactions of loaded messages", description="One scoped batch, 1..50 message UUIDs. Any foreign or missing message is 404; no per-message fetch. Personalized flags and version/count share a SQL snapshot.")
    public ResponseEntity<List<ChatResponses.Reactions>> reactionSnapshots(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @PathVariable(required=false) UUID projectId,@PathVariable UUID conversationId,@RequestParam List<UUID> messageIds) {
        return ResponseEntity.ok().header("Cache-Control","private, no-store").body(
                reactions.snapshots(actorId(principal),projectId,conversationId,messageIds).stream().map(ChatResponses.Reactions::from).toList());
    }

    public record VisibleMessages(List<UUID> messageIds) {}
    @GetMapping("/conversations/{conversationId}/messages/{messageId}/info")
    public ResponseEntity<com.pda.chat.application.service.ChatViews.MessageInfo> info(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,@PathVariable UUID conversationId,@PathVariable UUID messageId) {
        return ResponseEntity.ok().header("Cache-Control","private, no-store").body(chat.messageInfo(actorId(principal),conversationId,messageId));
    }
    private static UUID actorId(UserAccounts.AuthenticatedUser principal) {
        if (principal == null || principal.id() == null) {
            throw new AccessDeniedException("Authentication required");
        }
        return principal.id();
    }
}
