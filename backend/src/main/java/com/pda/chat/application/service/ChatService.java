package com.pda.chat.application.service;

import com.pda.chat.application.service.ChatDelivery.ChatMessageSent;
import com.pda.chat.application.service.ChatViews.ChatUser;
import com.pda.chat.application.service.ChatViews.ConversationView;
import com.pda.chat.application.service.ChatViews.LastMessageView;
import com.pda.chat.application.service.ChatViews.MemberView;
import com.pda.chat.application.service.ChatViews.MessageDeliveryStatus;
import com.pda.chat.application.service.ChatViews.MessagePage;
import com.pda.chat.application.service.ChatViews.MessageView;
import com.pda.chat.application.service.ChatViews.OverviewView;
import com.pda.chat.domain.ChatException;
import com.pda.chat.domain.entity.ChatConversation;
import com.pda.chat.domain.entity.ChatMessage;
import com.pda.chat.domain.enums.ChatConversationType;
import com.pda.chat.infrastructure.repository.ChatConversationRepository;
import com.pda.chat.infrastructure.repository.ChatMessageRepository;
import com.pda.chat.infrastructure.repository.ChatReactionRepository;
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

    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final ProjectAccess projects;
    private final UserAccounts users;
    private final ChatConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final ChatReadStateRepository readStates;
    private final ChatSendRateLimiter rateLimiter;
    private final ChatDelivery delivery;
    private final Clock clock;
    private final ChatReactionViewReader reactionViews;
    private final ChatTypingRateLimiter typingLimiter;
    private final ChatReactionRepository reactionRepository;

    public ChatService(ProjectAccess projects, UserAccounts users, ChatConversationRepository conversations,
                       ChatMessageRepository messages, ChatReadStateRepository readStates,
                       ChatSendRateLimiter rateLimiter, ChatDelivery delivery, Clock clock, ChatReactionViewReader reactionViews,
                       ChatTypingRateLimiter typingLimiter, ChatReactionRepository reactionRepository, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.jdbc=jdbc;
        this.typingLimiter = typingLimiter;
        this.reactionRepository = reactionRepository;
        this.projects = projects;
        this.users = users;
        this.conversations = conversations;
        this.messages = messages;
        this.readStates = readStates;
        this.rateLimiter = rateLimiter;
        this.delivery = delivery;
        this.clock = clock;
        this.reactionViews = reactionViews;
    }

    // ---- listing ------------------------------------------------------------------------------------------------

    /** Not read-only: the project group is created the first time anybody uses the project's chat. */
    @Transactional
    public OverviewView overview(UUID actor, UUID projectId) {
        if (projectId == null) return centralOverview(actor);
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
        if (projectId == null) {
            Map<UUID,MemberView> all = new HashMap<>();
            for(var project:projects.activeProjectsForUser(actor)) for(var member:members(actor,project.id())) all.putIfAbsent(member.user().userId(),member);
            return all.values().stream().sorted(Comparator.comparing(m -> Objects.toString(m.user().nickname(), ""),String.CASE_INSENSITIVE_ORDER)).toList();
        }
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

    private OverviewView centralOverview(UUID actor) {
        List<ConversationView> groups = new ArrayList<>();
        for(var project:projects.activeProjectsForUser(actor)) {
            var group=overview(actor,project.id()).group();
            groups.add(new ConversationView(group.id(),group.type(),null,group.lastMessage(),group.unread(),project.id(),project.name(),project.logoVersion(),project.logoShape()));
        }
        var directs=conversations.findDirectsOf(null,actor);
        var counts=unreadByConversation(actor,null);
        Map<UUID,ChatMessage> last=new HashMap<>();
        if(!directs.isEmpty()) messages.findLastMessages(directs.stream().map(ChatConversation::getId).toList()).forEach(m -> last.put(m.getConversationId(),m));
        Set<UUID> peers=new HashSet<>();directs.forEach(c -> peers.add(c.peerOf(actor)));
        var accounts=peers.isEmpty()?Map.<UUID,UserAccounts.AuthenticatedUser>of():users.findActiveByIds(peers);
        var views=directs.stream().map(c -> conversationView(c,chatUser(c.peerOf(actor),accounts.get(c.peerOf(actor))),last.get(c.getId()),counts.getOrDefault(c.getId(),0L))).toList();
        return new OverviewView(groups.isEmpty()?null:groups.getFirst(),views,groups.stream().mapToLong(ConversationView::unread).sum()+views.stream().mapToLong(ConversationView::unread).sum(),groups);
    }

    // ---- direct conversations -----------------------------------------------------------------------------------

    /** Finds or creates the 1:1 conversation between the caller and another member of the same project. */
    @Transactional
    public ConversationView openDirect(UUID actor, UUID projectId, UUID targetUserId) {
        if (projectId != null) requireMember(actor, projectId);
        if (targetUserId == null || targetUserId.equals(actor)) {
            throw ChatException.invalid("CHAT_SELF");
        }
        if (users.findActiveByIds(Set.of(targetUserId)).isEmpty() || (projectId != null ? !projects.isMember(projectId,targetUserId) : conversations.findDirectsOf(null,actor).stream().noneMatch(c -> targetUserId.equals(c.peerOf(actor))) && projects.activeProjectsForUser(actor).stream().noneMatch(p -> projects.isMember(p.id(),targetUserId)))) {
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
        return new MessagePage(messageViews(page, actor, conversationId), hasMore);
    }

    @Transactional
    public MessageView send(UUID actor, UUID projectId, UUID conversationId, String content) {
        return send(actor,projectId,conversationId,content,null);
    }

    @Transactional
    public MessageView send(UUID actor, UUID projectId, UUID conversationId, String content, UUID replyToMessageId) {
        return sendAttached(actor,projectId,conversationId,content,replyToMessageId,null);
    }
    @Transactional
    public MessageView sendAttached(UUID actor,UUID projectId,UUID conversationId,String content,UUID replyToMessageId,UUID attachmentId) {
        ChatConversation conversation = accessible(actor, projectId, conversationId);
        if (conversation.getType() == ChatConversationType.PROJECT) {
            projects.lockMembershipContext(conversation.getProjectId());
            requireMember(actor, conversation.getProjectId());
        }
        if (conversation.getType() == ChatConversationType.DIRECT
                && users.findActiveByIds(Set.of(conversation.peerOf(actor))).isEmpty()) {
            // The other person left the project: nobody is on the receiving end any more.
            throw ChatException.notFound("CHAT_RECIPIENT");
        }
        // Every attempt counts, also a blank or too long one: otherwise the limit could be probed (or a server kept
        // busy) with messages that are refused anyway. The normal validation answers still come first while within it.
        // Attachments already consumed the same quota before their bounded content parsing.
        if (attachmentId == null && !rateLimiter.tryAcquire(actor)) {
            throw ChatException.rateLimited();
        }
        if (replyToMessageId != null) {
            // Nobody can quote a message that was deleted: its text is gone.
            ChatMessage target = messages.findByIdAndConversationId(replyToMessageId, conversationId)
                    .orElseThrow(() -> ChatException.notFound("CHAT_REPLY_NOT_FOUND"));
            if (target.isDeleted()) {
                throw ChatException.notFound("CHAT_REPLY_NOT_FOUND");
            }
        }
        ChatMessage message = attachmentId==null ? ChatMessage.create(conversation.getId(), actor, content, replyToMessageId, clock.instant()) : ChatMessage.withAttachment(conversation.getId(),actor,content,replyToMessageId,clock.instant());
        messages.saveAndFlush(message);
        if(attachmentId!=null && jdbc.update("update chat_attachments set message_id=?,state='ACTIVE' where id=? and owner_id=? and state='PENDING'",message.getId(),attachmentId,actor)!=1) throw ChatException.invalid("CHAT_ATTACHMENT_INVALID");
        Set<UUID> audience=new HashSet<>();
        if(conversation.getType()==ChatConversationType.DIRECT) audience.add(conversation.peerOf(actor));
        else for(int page=0;;page++) {
            var batch=projects.members(conversation.getProjectId(),PageRequest.of(page,MEMBER_PAGE,Sort.by("id")));
            batch.forEach(m -> audience.add(m.userId()));if(!batch.hasNext())break;
        }
        audience.remove(actor);
        for(UUID recipient:audience) jdbc.update("insert into chat_message_receipts(message_id,user_id) values (?,?)",message.getId(),recipient);
        conversations.touch(conversation.getId(), message.getCreatedAt());

        MessageView view = messageViews(List.of(message),actor,conversationId).getFirst();
        Set<UUID> participants = conversation.getType() == ChatConversationType.DIRECT
                ? Set.of(conversation.getDirectUserLow(), conversation.getDirectUserHigh()) : Set.of();
        ChatMessageSent event = new ChatMessageSent(conversation.getProjectId(), conversation.getId(), conversation.getType(),
                participants, view);
        afterCommit(() -> delivery.messageSent(event));
        return view;
    }

    /**
     * Deletes the caller's own message for everybody: the text is erased and the row stays as a tombstone so replies,
     * ordering and cursors keep working. Same access rule as reading the conversation; only the sender may delete
     * (nobody else, no administrator bypass). Idempotent: deleting a deleted message changes and announces nothing.
     */
    @Transactional
    public void deleteMessage(UUID actor, UUID projectId, UUID conversationId, UUID messageId) {
        ChatConversation conversation = accessible(actor, projectId, conversationId);
        ChatMessage message = messages.lockByIdAndConversationId(Objects.requireNonNull(messageId, "messageId is required"),
                        conversationId)
                .orElseThrow(() -> ChatException.notFound("CHAT_NOT_FOUND"));
        if (!actor.equals(message.getSenderUserId())) {
            throw ChatException.forbidden();
        }
        if (message.isDeleted()) {
            return;
        }
        message.delete(clock.instant());
        jdbc.update("update chat_attachments set state='DELETE_PENDING' where message_id=?",messageId);
        reactionRepository.removeAll(messageId);
        messages.flush();
        Set<UUID> participants = conversation.getType() == ChatConversationType.DIRECT
                ? Set.of(conversation.getDirectUserLow(), conversation.getDirectUserHigh()) : Set.of();
        ChatDelivery.ChatMessageDeleted event = new ChatDelivery.ChatMessageDeleted(conversation.getProjectId(), conversation.getId(),
                conversation.getType(), participants, messageId);
        afterCommit(() -> delivery.messageDeleted(event));
    }

    /** Marks everything in the conversation read for the caller (the marker only ever moves forward). */
    @Transactional
    public void markRead(UUID actor, UUID projectId, UUID conversationId) {
        ChatConversation conversation = accessible(actor, projectId, conversationId);
        Instant readAt = clock.instant().truncatedTo(ChronoUnit.MICROS);
        jdbc.update("update chat_message_receipts r set read_at=? from chat_messages m where r.message_id=m.id and m.conversation_id=? and r.user_id=? and r.read_at is null",java.sql.Timestamp.from(readAt),conversationId,actor);
        readStates.markRead(conversation.getId(), actor, readAt);
        Set<UUID> participants = conversation.getType() == ChatConversationType.DIRECT
                ? Set.of(conversation.getDirectUserLow(), conversation.getDirectUserHigh()) : Set.of();
        ChatDelivery.ChatSeen seen = new ChatDelivery.ChatSeen(conversation.getProjectId(), conversation.getId(), conversation.getType(),
                participants, actor, readAt);
        afterCommit(() -> {
            delivery.conversationRead(conversation.getProjectId(), conversation.getId(), actor);
            delivery.seen(seen);
        });
    }

    @Transactional
    public void markVisible(UUID actor,UUID conversationId,List<UUID> ids) {
        var conversation=accessible(actor,null,conversationId);
        if(ids==null||ids.isEmpty()||ids.size()>100||ids.stream().anyMatch(Objects::isNull))throw ChatException.invalid("CHAT_INVALID_REQUEST");
        var unique=new HashSet<>(ids);
        if(messages.findByIdInAndConversationId(unique,conversationId).size()!=unique.size())throw ChatException.notFound("CHAT_NOT_FOUND");
        Instant readAt=now();int changed=0;
        for(UUID id:unique) changed+=jdbc.update("update chat_message_receipts set read_at=?,legacy=false where message_id=? and user_id=? and read_at is null",java.sql.Timestamp.from(readAt),id,actor);
        if(changed==0)return;
        var participants=conversation.getType()==ChatConversationType.DIRECT?Set.of(conversation.getDirectUserLow(),conversation.getDirectUserHigh()):Set.<UUID>of();
        afterCommit(()->{delivery.conversationRead(conversation.getProjectId(),conversationId,actor);delivery.seen(new ChatDelivery.ChatSeen(conversation.getProjectId(),conversationId,conversation.getType(),participants,actor,readAt));});
    }

    /**
     * Acknowledges that the caller's client has received the given messages. This sets delivered_at on the
     * receipt rows where it was still null. If the caller is not a recipient of a message id it is silently
     * ignored (the DB WHERE clause handles this). A read message is already treated as delivered, so
     * backfilling delivered_at from read_at during the V49 migration is correct.
     *
     * <p>After-commit: the senders of the newly delivered messages receive a DELIVERED socket push so their
     * tick icons can advance from single to double.
     */
    @Transactional
    public void markDelivered(UUID actor, UUID conversationId, List<UUID> messageIds) {
        if (messageIds == null || messageIds.isEmpty() || messageIds.size() > 100 || messageIds.stream().anyMatch(Objects::isNull)) {
            throw ChatException.invalid("CHAT_INVALID_REQUEST");
        }
        accessible(actor, null, conversationId);
        Instant deliveredAt = now();
        // Only update rows where this user IS the recipient and delivered_at is still null.
        List<UUID> unique = messageIds.stream().distinct().toList();
        int changed = 0;
        for (UUID id : unique) {
            changed += jdbc.update(
                "UPDATE chat_message_receipts SET delivered_at = ? WHERE message_id = ? AND user_id = ? AND delivered_at IS NULL",
                java.sql.Timestamp.from(deliveredAt), id, actor);
        }
        if (changed == 0) return;
        // Notify the senders of newly-delivered messages so their ticks can update in real time.
        // We look up which messages were just marked to find their senders.
        record SenderMsg(UUID senderId, UUID messageId) {}
        List<SenderMsg> affected = new ArrayList<>();
        for (UUID id : unique) {
            jdbc.query(
                "SELECT m.sender_user_id FROM chat_messages m JOIN chat_message_receipts r ON r.message_id = m.id WHERE m.id = ? AND r.user_id = ? AND r.delivered_at = ?",
                (rs, n) -> new SenderMsg(rs.getObject(1, UUID.class), id),
                id, actor, java.sql.Timestamp.from(deliveredAt)).forEach(affected::add);
        }
        // Group by sender so we fire one event per sender.
        Map<UUID, List<UUID>> bySender = new HashMap<>();
        affected.forEach(sm -> bySender.computeIfAbsent(sm.senderId(), k -> new ArrayList<>()).add(sm.messageId()));
        ChatConversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> ChatException.notFound("CHAT_NOT_FOUND"));
        Set<UUID> participants = conversation.getType() == ChatConversationType.DIRECT
                ? Set.of(conversation.getDirectUserLow(), conversation.getDirectUserHigh()) : Set.of();
        bySender.forEach((senderId, msgs) -> {
            ChatDelivery.ChatDelivered event = new ChatDelivery.ChatDelivered(
                    conversation.getProjectId(), conversationId, conversation.getType(), participants, actor, msgs);
            afterCommit(() -> delivery.delivered(event));
        });
    }

    @Transactional(readOnly=true)
    public ChatViews.MessageInfo messageInfo(UUID actor,UUID conversationId,UUID messageId) {
        accessible(actor,null,conversationId);
        var message=messages.findByIdAndConversationId(messageId,conversationId).orElseThrow(()->ChatException.notFound("CHAT_NOT_FOUND"));
        if(!actor.equals(message.getSenderUserId()))throw ChatException.forbidden();
        record Row(UUID userId,Instant readAt,boolean legacy) {}
        var rows=jdbc.query("select user_id,read_at,legacy from chat_message_receipts where message_id=? order by read_at nulls last,user_id",(r,n)->new Row(r.getObject(1,UUID.class),r.getTimestamp(2)==null?null:r.getTimestamp(2).toInstant(),r.getBoolean(3)),messageId);
        Set<UUID> ids=new HashSet<>();rows.forEach(r -> ids.add(r.userId()));
        var accounts=ids.isEmpty()?Map.<UUID,UserAccounts.AuthenticatedUser>of():users.findActiveByIds(ids);
        return new ChatViews.MessageInfo(messageId,rows.stream().map(r -> new ChatViews.MessageReader(chatUser(r.userId(),accounts.get(r.userId())),r.readAt(),r.legacy())).toList());
    }

    /**
     * Who has read the conversation and up to when ("seen"): the read markers of the other people, restricted to
     * people who are still active project members. Same access rule as reading the conversation.
     */
    // Not read-only: the membership lookup takes a shared row lock, like in overview().
    @Transactional
    public List<ChatViews.ReceiptView> receipts(UUID actor, UUID projectId, UUID conversationId) {
        ChatConversation conversation = accessible(actor, projectId, conversationId);
        if(projectId==null) return jdbc.query("select r.user_id,r.read_at,r.message_id from chat_message_receipts r join chat_messages m on m.id=r.message_id where m.conversation_id=? and r.user_id<>? and r.read_at is not null",(r,n)->new ChatViews.ReceiptView(r.getObject(1,UUID.class),r.getTimestamp(2).toInstant(),r.getObject(3,UUID.class)),conversationId,actor);
        var rows = readStates.findOthers(conversation.getId(), actor);
        if (rows.isEmpty()) {
            return List.of();
        }
        Set<UUID> ids = new HashSet<>();
        rows.forEach(row -> ids.add(row.getUserId()));
        Set<UUID> active = conversation.getType()==ChatConversationType.DIRECT ? Set.of(conversation.getDirectUserLow(),conversation.getDirectUserHigh()) : projects.activeMemberIds(conversation.getProjectId(), ids);
        return rows.stream().filter(row -> active.contains(row.getUserId()))
                .map(row -> new ChatViews.ReceiptView(row.getUserId(), row.getLastReadAt())).toList();
    }

    /**
     * "Is typing" signal for the other participants. Nothing is written: the state lives only in the clients and
     * expires there. Same access rule as reading the conversation (a foreign or unknown conversation is a 404), the
     * typist is the authenticated user and the nickname comes from the server-side account, never from the request.
     */
    @Transactional(readOnly = true)
    public void typing(UUID actor, UUID projectId, UUID conversationId, boolean typing) {
        ChatConversation conversation = accessible(actor, projectId, conversationId);
        if (!typingLimiter.tryAcquire(actor)) {
            throw ChatException.rateLimited();
        }
        UserAccounts.AuthenticatedUser account = users.findActiveByIds(Set.of(actor)).get(actor);
        if (account == null) {
            throw new AccessDeniedException("Account not active");
        }
        Set<UUID> participants = conversation.getType() == ChatConversationType.DIRECT
                ? Set.of(conversation.getDirectUserLow(), conversation.getDirectUserHigh()) : Set.of();
        delivery.typing(new ChatDelivery.ChatTyping(conversation.getProjectId(), conversation.getId(), conversation.getType(),
                participants, actor, account.nickname(), typing));
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
    ChatConversation accessible(UUID actor, UUID projectId, UUID conversationId) {
        if (projectId != null) requireMember(actor,projectId);
        ChatConversation conversation = conversations.findById(Objects.requireNonNull(conversationId))
                .orElseThrow(() -> ChatException.notFound("CHAT_NOT_FOUND"));
        if (conversation.getType()==ChatConversationType.PROJECT) {
            if (projectId!=null && !projectId.equals(conversation.getProjectId())) throw ChatException.notFound("CHAT_NOT_FOUND");
            requireMember(actor,conversation.getProjectId());
        }
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
        ProjectMemberView membership = projectId==null ? null : projects.member(projectId, actor);
        Instant floor = membership == null || membership.joinedAt() == null ? Instant.EPOCH : membership.joinedAt();
        Map<UUID, Long> counts = new HashMap<>();
        for (Object[] row : messages.unreadCounts(projectId, actor, floor)) {
            counts.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }

    private List<MessageView> messageViews(List<ChatMessage> page, UUID actor, UUID conversationId) {
        if (page.isEmpty()) return List.of();
        Set<UUID> replyIds = page.stream().map(ChatMessage::getReplyToMessageId).filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Map<UUID,ChatMessage> replies = new HashMap<>();
        if (!replyIds.isEmpty()) messages.findByIdInAndConversationId(replyIds,conversationId).forEach(message -> replies.put(message.getId(),message));
        Set<UUID> senderIds = new HashSet<>();
        page.forEach(message -> senderIds.add(message.getSenderUserId()));
        replies.values().forEach(message -> senderIds.add(message.getSenderUserId()));
        Map<UUID, UserAccounts.AuthenticatedUser> accounts = senderIds.isEmpty() ? Map.of()
                : users.findActiveByIds(senderIds);
        var snapshots = reactionViews.forActor(conversationId,page.stream().map(ChatMessage::getId).toList(),actor);
        // Compute delivery status for messages sent by the caller.
        List<UUID> ownMessageIds = page.stream()
                .filter(m -> actor.equals(m.getSenderUserId()) && !m.isDeleted())
                .map(ChatMessage::getId).toList();
        // receipt rows for own messages: map messageId -> (totalRecipients, deliveredCount, readCount)
        record ReceiptSummary(long total, long delivered, long read) {}
        Map<UUID, ReceiptSummary> statusMap = new HashMap<>();
        if (!ownMessageIds.isEmpty()) {
            String inSql = String.join(",", java.util.Collections.nCopies(ownMessageIds.size(), "?"));
            jdbc.query(
                "SELECT message_id, COUNT(*) AS total_cnt, "
                + "COALESCE(SUM(CASE WHEN delivered_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS del_cnt, "
                + "COALESCE(SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS read_cnt "
                + "FROM chat_message_receipts WHERE message_id IN (" + inSql + ") GROUP BY message_id",
                (rs, rowNum) -> {
                    UUID mid = rs.getObject("message_id", UUID.class);
                    statusMap.put(mid, new ReceiptSummary(rs.getLong("total_cnt"), rs.getLong("del_cnt"), rs.getLong("read_cnt")));
                    return null;
                },
                ownMessageIds.toArray());
        }
        return page.stream().map(message -> {
            var parent = replies.get(message.getReplyToMessageId());
            var quote = parent == null ? null : new ChatViews.ReplyView(parent.getId(),
                    chatUser(parent.getSenderUserId(),accounts.get(parent.getSenderUserId())),messagePreview(parent),
                    parent.isDeleted());
            var reactions = snapshots.get(message.getId());
            MessageDeliveryStatus status = MessageDeliveryStatus.SENT;
            if (actor.equals(message.getSenderUserId()) && !message.isDeleted()) {
                ReceiptSummary s = statusMap.get(message.getId());
                if (s != null && s.total() > 0) {
                    if (s.read() >= s.total()) {
                        status = MessageDeliveryStatus.READ;
                    } else if (s.delivered() >= s.total()) {
                        status = MessageDeliveryStatus.DELIVERED;
                    }
                    // else: at least one recipient has not confirmed delivery → SENT
                }
            }
            return new MessageView(message.getId(),message.getConversationId(),message.getContent(),message.getCreatedAt(),
                    chatUser(message.getSenderUserId(),accounts.get(message.getSenderUserId())),quote,
                    reactions.reactionVersion(),reactions.reactions(),message.isDeleted(),attachmentView(message.getId()),status);
        }).toList();
    }

    private ChatViews.AttachmentView attachmentView(UUID messageId) {
        return jdbc.query("select id,filename,content_type,size from chat_attachments where message_id=? and state='ACTIVE'",(r,n)->new ChatViews.AttachmentView(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getInt(4)),messageId).stream().findFirst().orElse(null);
    }

    private String messagePreview(ChatMessage message) {
        var attachment = message.isDeleted() ? null : attachmentView(message.getId());
        return preview(message.getContent().isEmpty() && attachment != null ? attachment.filename() : message.getContent());
    }

    private ConversationView conversationView(ChatConversation conversation, ChatUser peer, ChatMessage last,
                                                     long unread) {
        var attachment=last==null||last.isDeleted()?null:attachmentView(last.getId());
        LastMessageView lastView = last == null ? null
                : new LastMessageView(last.getContent().isEmpty()&&attachment!=null?attachment.filename():preview(last.getContent()), last.getCreatedAt(), last.getSenderUserId(), last.isDeleted());
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
    static void afterCommit(Runnable action) {
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
