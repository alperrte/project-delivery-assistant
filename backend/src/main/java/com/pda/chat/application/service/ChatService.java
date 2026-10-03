package com.pda.chat.application.service;

import com.pda.chat.application.service.ChatDelivery.ChatMessageSent;
import com.pda.chat.application.service.ChatViews.ChatUser;
import com.pda.chat.application.service.ChatViews.ConversationView;
import com.pda.chat.application.service.ChatViews.LastMessageView;
import com.pda.chat.application.service.ChatViews.MemberView;
import com.pda.chat.application.service.ChatViews.MessagePage;
import com.pda.chat.application.service.ChatViews.MessageView;
import com.pda.chat.application.service.ChatViews.OverviewView;
import com.pda.chat.domain.ChatException;
import com.pda.chat.domain.entity.ChatConversation;
import com.pda.chat.domain.entity.ChatMessage;
import com.pda.chat.domain.enums.ChatConversationType;
import com.pda.chat.infrastructure.repository.ChatConversationRepository;
import com.pda.chat.infrastructure.repository.ChatMessageRepository;
import com.pda.chat.infrastructure.repository.ChatReadStateRepository;
import com.pda.project.ProjectAccess;
import com.pda.project.ProjectMemberView;
import com.pda.user.UserAccounts;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Project-scoped messaging. ProjectMembership stays the only authority: every operation, REST or real-time delivery,
 * starts with an active-membership check of the caller in that very project, a conversation is always looked up by
 * (id, project), and someone else's direct conversation answers 404 like a conversation that does not exist, so ids
 * cannot be probed. The sender is always the authenticated user passed in by the controller; no request carries one.
 *
 * <p>Membership lifecycle: nothing is deleted when a member leaves. Because access is evaluated on every request and
 * delivery, a removed member loses history, sending and pushes immediately while the rows stay for everyone else.
 * Message content is never logged.
 */
@Service
public class ChatService {

    static final int DEFAULT_PAGE = 30;
    static final int MAX_PAGE = 100;
    static final int PREVIEW_LIMIT = 140;
    private static final int MEMBER_PAGE = 100;
    private static final int MAX_MEMBER_PAGES = 10;

    private final ProjectAccess projects;
    private final UserAccounts users;
    private final ChatConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final ChatReadStateRepository readStates;
    private final ChatSendRateLimiter rateLimiter;
    private final ChatDelivery delivery;
    private final Clock clock;

    public ChatService(ProjectAccess projects, UserAccounts users, ChatConversationRepository conversations,
                       ChatMessageRepository messages, ChatReadStateRepository readStates,
                       ChatSendRateLimiter rateLimiter, ChatDelivery delivery, Clock clock) {
        this.projects = projects;
        this.users = users;
        this.conversations = conversations;
        this.messages = messages;
        this.readStates = readStates;
        this.rateLimiter = rateLimiter;
        this.delivery = delivery;
        this.clock = clock;
    }

    // ---- listing ------------------------------------------------------------------------------------------------

    /** Not read-only: the project group is created the first time anybody uses the project's chat. */
    @Transactional
    public OverviewView overview(UUID actor, UUID projectId) {
        requireMember(actor, projectId);
        ChatConversation group = groupOf(projectId);
        List<ChatConversation> directs = conversations.findDirectsOf(projectId, actor);

        Set<UUID> peerIds = new LinkedHashSet<>();
        for (ChatConversation direct : directs) {
            peerIds.add(direct.peerOf(actor));
        }
        // A direct conversation with someone who left the project is not offered any more.
        Set<UUID> activePeers = peerIds.isEmpty() ? Set.of() : projects.activeMemberIds(projectId, peerIds);
        List<ChatConversation> visibleDirects = directs.stream()
                .filter(direct -> activePeers.contains(direct.peerOf(actor))).toList();

        List<UUID> ids = new ArrayList<>();
        ids.add(group.getId());
        visibleDirects.forEach(direct -> ids.add(direct.getId()));
        Map<UUID, ChatMessage> lastMessages = new HashMap<>();
        messages.findLastMessages(ids).forEach(message -> lastMessages.put(message.getConversationId(), message));
        Map<UUID, Long> unread = unreadByConversation(actor, projectId);
        Map<UUID, UserAccounts.AuthenticatedUser> accounts = activePeers.isEmpty() ? Map.of()
                : users.findActiveByIds(activePeers);

        ConversationView groupView = conversationView(group, null, lastMessages.get(group.getId()),
                unread.getOrDefault(group.getId(), 0L));
        List<ConversationView> directViews = visibleDirects.stream().map(direct -> {
            UUID peerId = direct.peerOf(actor);
            return conversationView(direct, chatUser(peerId, accounts.get(peerId)), lastMessages.get(direct.getId()),
                    unread.getOrDefault(direct.getId(), 0L));
        }).sorted(Comparator.comparing((ConversationView view) -> activityAt(view),
                        Comparator.nullsLast(Comparator.<Instant>reverseOrder()))
                .thenComparing(view -> view.peer().nickname() == null ? "" : view.peer().nickname(),
                        String.CASE_INSENSITIVE_ORDER)).toList();
        long total = groupView.unread() + directViews.stream().mapToLong(ConversationView::unread).sum();
        return new OverviewView(groupView, directViews, total);
    }

    /** The other active members of the project, with the id of the direct conversation when one exists. */
    @Transactional(readOnly = true)
    public List<MemberView> members(UUID actor, UUID projectId) {
        requireMember(actor, projectId);
        Map<UUID, UUID> directByPeer = new HashMap<>();
        for (ChatConversation direct : conversations.findDirectsOf(projectId, actor)) {
            directByPeer.put(direct.peerOf(actor), direct.getId());
        }
        List<MemberView> result = new ArrayList<>();
        for (int page = 0; page < MAX_MEMBER_PAGES; page++) {
            Page<ProjectMemberView> members = projects.members(projectId,
                    PageRequest.of(page, MEMBER_PAGE, Sort.by("joinedAt").ascending().and(Sort.by("id"))));
            for (ProjectMemberView member : members.getContent()) {
                if (!actor.equals(member.userId())) {
                    // The membership view also carries an email; the chat summary deliberately has no such field.
                    result.add(new MemberView(
                            new ChatUser(member.userId(), member.nickname(), member.profilePhotoVersion()),
                            directByPeer.get(member.userId())));
                }
            }
            if (!members.hasNext()) {
                break;
            }
        }
        result.sort(Comparator.comparing(member -> member.user().nickname() == null ? "" : member.user().nickname(),
                String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    // ---- direct conversations -----------------------------------------------------------------------------------

    /** Finds or creates the 1:1 conversation between the caller and another member of the same project. */
    @Transactional
    public ConversationView openDirect(UUID actor, UUID projectId, UUID targetUserId) {
        requireMember(actor, projectId);
        if (targetUserId == null || targetUserId.equals(actor)) {
            throw ChatException.invalid("CHAT_SELF");
        }
        if (!projects.isMember(projectId, targetUserId)) {
            throw ChatException.notFound("CHAT_RECIPIENT");
        }
        ChatConversation conversation = directOf(projectId, actor, targetUserId);
        ChatMessage last = messages.findLastMessages(List.of(conversation.getId())).stream().findFirst().orElse(null);
        long unread = unreadByConversation(actor, projectId).getOrDefault(conversation.getId(), 0L);
        UserAccounts.AuthenticatedUser peer = users.findActiveByIds(Set.of(targetUserId)).get(targetUserId);
        return conversationView(conversation, chatUser(targetUserId, peer), last, unread);
    }

    // ---- messages -----------------------------------------------------------------------------------------------

    /**
     * Newest page when neither cursor is given; {@code before} pages back in time, {@code after} is the catch-up
     * after a reconnect (oldest first, so the client can append). Both cursors are message ids of this conversation.
     */
    @Transactional(readOnly = true)
    public MessagePage messages(UUID actor, UUID projectId, UUID conversationId, UUID before, UUID after,
                                Integer requestedLimit) {
        ChatConversation conversation = accessible(actor, projectId, conversationId);
        if (before != null && after != null) {
            throw ChatException.invalid("CHAT_INVALID_REQUEST");
        }
        int limit = requestedLimit == null ? DEFAULT_PAGE : Math.max(1, Math.min(MAX_PAGE, requestedLimit));
        List<ChatMessage> found;
        boolean newestFirst = after == null;
        if (after != null) {
            ChatMessage cursor = cursor(after, conversation);
            found = messages.findAfter(conversation.getId(), cursor.getCreatedAt(), cursor.getId(), limit + 1);
        } else if (before != null) {
            ChatMessage cursor = cursor(before, conversation);
            found = messages.findBefore(conversation.getId(), cursor.getCreatedAt(), cursor.getId(), limit + 1);
        } else {
            found = messages.findLatest(conversation.getId(), limit + 1);
        }
        boolean hasMore = found.size() > limit;
        List<ChatMessage> page = new ArrayList<>(hasMore ? found.subList(0, limit) : found);
        if (newestFirst) {
            java.util.Collections.reverse(page);
        }
        return new MessagePage(messageViews(page), hasMore);
    }

    @Transactional
    public MessageView send(UUID actor, UUID projectId, UUID conversationId, String content) {
        ChatConversation conversation = accessible(actor, projectId, conversationId);
        if (conversation.getType() == ChatConversationType.DIRECT
                && !projects.isMember(projectId, conversation.peerOf(actor))) {
            // The other person left the project: nobody is on the receiving end any more.
            throw ChatException.notFound("CHAT_RECIPIENT");
        }
        // Every attempt counts, also a blank or too long one: otherwise the limit could be probed (or a server kept
        // busy) with messages that are refused anyway. The normal validation answers still come first while within it.
        if (!rateLimiter.tryAcquire(actor)) {
            throw ChatException.rateLimited();
        }
        ChatMessage message = ChatMessage.create(conversation.getId(), actor, content, clock.instant());
        messages.save(message);
        conversations.touch(conversation.getId(), message.getCreatedAt());

        UserAccounts.AuthenticatedUser sender = users.findActiveById(actor).orElse(null);
        MessageView view = new MessageView(message.getId(), conversation.getId(), message.getContent(),
                message.getCreatedAt(), chatUser(actor, sender));
        Set<UUID> participants = conversation.getType() == ChatConversationType.DIRECT
                ? Set.of(conversation.getDirectUserLow(), conversation.getDirectUserHigh()) : Set.of();
        ChatMessageSent event = new ChatMessageSent(projectId, conversation.getId(), conversation.getType(),
                participants, view);
        afterCommit(() -> delivery.messageSent(event));
        return view;
    }

    /** Marks everything in the conversation read for the caller (the marker only ever moves forward). */
    @Transactional
    public void markRead(UUID actor, UUID projectId, UUID conversationId) {
        ChatConversation conversation = accessible(actor, projectId, conversationId);
        readStates.markRead(conversation.getId(), actor, clock.instant().truncatedTo(ChronoUnit.MICROS));
        afterCommit(() -> delivery.conversationRead(projectId, conversation.getId(), actor));
    }

    // ---- authorization and lookup -------------------------------------------------------------------------------

    private void requireMember(UUID actor, UUID projectId) {
        if (actor == null || projectId == null || !projects.isMember(projectId, actor)) {
            throw new AccessDeniedException("Project access denied");
        }
    }

    /**
     * Member of the project AND the conversation belongs to that project AND (for a direct one) the caller is one of
     * its two participants. Everything else is a 404, so a foreign conversation id reveals nothing.
     */
    private ChatConversation accessible(UUID actor, UUID projectId, UUID conversationId) {
        requireMember(actor, projectId);
        ChatConversation conversation = conversations.findByIdAndProjectId(
                        Objects.requireNonNull(conversationId, "conversationId is required"), projectId)
                .orElseThrow(() -> ChatException.notFound("CHAT_NOT_FOUND"));
        if (!conversation.isParticipant(actor)) {
            throw ChatException.notFound("CHAT_NOT_FOUND");
        }
        return conversation;
    }

    private ChatMessage cursor(UUID messageId, ChatConversation conversation) {
        return messages.findByIdAndConversationId(messageId, conversation.getId())
                .orElseThrow(() -> ChatException.invalid("CHAT_INVALID_REQUEST"));
    }

    private ChatConversation groupOf(UUID projectId) {
        return conversations.findGroup(projectId).orElseGet(() -> {
            ChatConversation fresh = ChatConversation.projectGroup(projectId, now());
            conversations.insertGroupIfAbsent(fresh.getId(), projectId, fresh.getCreatedAt());
            // Whoever won a concurrent insert, the row is there now.
            return conversations.findGroup(projectId)
                    .orElseThrow(() -> new IllegalStateException("Project chat group missing after insert"));
        });
    }

    private ChatConversation directOf(UUID projectId, UUID userA, UUID userB) {
        ChatConversation fresh = ChatConversation.direct(projectId, userA, userB, now());
        UUID low = fresh.getDirectUserLow();
        UUID high = fresh.getDirectUserHigh();
        return conversations.findDirect(projectId, low, high).orElseGet(() -> {
            conversations.insertDirectIfAbsent(fresh.getId(), projectId, low, high, fresh.getCreatedAt());
            return conversations.findDirect(projectId, low, high)
                    .orElseThrow(() -> new IllegalStateException("Direct chat missing after insert"));
        });
    }

    // ---- mapping ------------------------------------------------------------------------------------------------

    private Map<UUID, Long> unreadByConversation(UUID actor, UUID projectId) {
        ProjectMemberView membership = projects.member(projectId, actor);
        Instant floor = membership == null || membership.joinedAt() == null ? Instant.EPOCH : membership.joinedAt();
        Map<UUID, Long> counts = new HashMap<>();
        for (Object[] row : messages.unreadCounts(projectId, actor, floor)) {
            counts.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }

    private List<MessageView> messageViews(List<ChatMessage> page) {
        Set<UUID> senderIds = new HashSet<>();
        page.forEach(message -> senderIds.add(message.getSenderUserId()));
        Map<UUID, UserAccounts.AuthenticatedUser> accounts = senderIds.isEmpty() ? Map.of()
                : users.findActiveByIds(senderIds);
        return page.stream().map(message -> new MessageView(message.getId(), message.getConversationId(),
                message.getContent(), message.getCreatedAt(),
                chatUser(message.getSenderUserId(), accounts.get(message.getSenderUserId())))).toList();
    }

    private static ConversationView conversationView(ChatConversation conversation, ChatUser peer, ChatMessage last,
                                                     long unread) {
        LastMessageView lastView = last == null ? null
                : new LastMessageView(preview(last.getContent()), last.getCreatedAt(), last.getSenderUserId());
        return new ConversationView(conversation.getId(), conversation.getType(), peer, lastView, unread);
    }

    private static Instant activityAt(ConversationView view) {
        return view.lastMessage() == null ? null : view.lastMessage().createdAt();
    }

    private static ChatUser chatUser(UUID userId, UserAccounts.AuthenticatedUser account) {
        return account == null ? new ChatUser(userId, null, null)
                : new ChatUser(userId, account.nickname(), account.profilePhotoVersion());
    }

    static String preview(String content) {
        String singleLine = content.replaceAll("\\s+", " ").strip();
        if (singleLine.codePointCount(0, singleLine.length()) <= PREVIEW_LIMIT) {
            return singleLine;
        }
        int end = singleLine.offsetByCodePoints(0, PREVIEW_LIMIT - 1);
        return singleLine.substring(0, end) + "…";
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    /** Real-time delivery must follow the commit, never precede it (a rolled back message must not be pushed). */
    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
