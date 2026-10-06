package com.pda.chat.infrastructure.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.pda.chat.api.dto.response.ChatResponses;
import com.pda.chat.application.service.ChatDelivery;
import com.pda.chat.application.service.ChatReactionViewReader;
import com.pda.chat.domain.enums.ChatConversationType;
import com.pda.project.ProjectAccess;
import com.pda.project.ProjectMemberView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Pushes chat events to the {@code /user/queue/chat} queue of each recipient. The audience is resolved here, at
 * delivery time, from current project membership (never from the connection), so somebody removed from the project a
 * moment ago receives nothing even though their socket may still be open. Failures are logged by ids only and never
 * fail the already committed request; clients recover through the REST catch-up on reconnect.
 */
@Component
class StompChatDelivery implements ChatDelivery {

    private static final Logger log = LoggerFactory.getLogger(StompChatDelivery.class);
    private static final int MEMBER_PAGE = 100;
    private static final int MAX_MEMBER_PAGES = 10;

    private final SimpMessagingTemplate messaging;
    private final ProjectAccess projects;
    private final ChatReactionViewReader reactionViews;

    StompChatDelivery(SimpMessagingTemplate messaging, ProjectAccess projects, ChatReactionViewReader reactionViews) {
        this.messaging = messaging;
        this.projects = projects;
        this.reactionViews = reactionViews;
    }

    /** What travels over the socket. {@code message} is absent for READ. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SocketEvent(String type, UUID projectId, UUID conversationId,
                              ChatConversationType conversationType, ChatResponses.Message message) {
    }

    @Override
    public void messageSent(ChatMessageSent event) {
        try {
            SocketEvent payload = new SocketEvent("MESSAGE", event.projectId(), event.conversationId(),
                    event.type(), ChatResponses.Message.from(event.message()));
            for (UUID recipient : recipients(event.projectId(),event.type(),event.directParticipants())) {
                messaging.convertAndSendToUser(recipient.toString(), ChatWebSocketConfiguration.USER_QUEUE, payload);
            }
        } catch (RuntimeException failure) {
            log.warn("Chat delivery failed: project={} conversation={} message={} ({})", event.projectId(),
                    event.conversationId(), event.message().id(), failure.getClass().getSimpleName());
        }
    }

    @Override
    public void conversationRead(UUID projectId, UUID conversationId, UUID userId) {
        try {
            messaging.convertAndSendToUser(userId.toString(), ChatWebSocketConfiguration.USER_QUEUE,
                    new SocketEvent("READ", projectId, conversationId, null, null));
        } catch (RuntimeException failure) {
            log.warn("Chat read sync failed: project={} conversation={} ({})", projectId, conversationId,
                    failure.getClass().getSimpleName());
        }
    }

    public record ReactionSocketEvent(String type, UUID projectId, UUID conversationId, UUID messageId,
                                      String reactionVersion, java.util.List<ChatResponses.Reaction> reactions) { }

    @Override
    public void reactionsChanged(ChatReactionsChanged event) {
        try {
            var recipients=recipients(event.projectId(),event.type(),event.directParticipants());
            if(recipients.isEmpty())return;
            var raw=reactionViews.forDelivery(event.conversationId(),java.util.List.of(event.messageId()),recipients).get(event.messageId());
            if(raw==null)return;
            if(Long.parseLong(raw.version())<event.committedVersion())throw new IllegalStateException("Reaction snapshot predates commit");
            for(UUID recipient:recipients){
                var snapshot=ChatResponses.Reactions.from(raw.forUser(recipient));
                messaging.convertAndSendToUser(recipient.toString(),ChatWebSocketConfiguration.USER_QUEUE,
                        new ReactionSocketEvent("REACTIONS",event.projectId(),event.conversationId(),event.messageId(),snapshot.reactionVersion(),snapshot.reactions()));
            }
        } catch(RuntimeException failure){
            log.warn("Chat reaction delivery failed: project={} conversation={} message={} ({})",event.projectId(),event.conversationId(),event.messageId(),failure.getClass().getSimpleName());
        }
    }

    private Set<UUID> recipients(UUID projectId,ChatConversationType type,Set<UUID> directParticipants) {
        Set<UUID> recipients = new LinkedHashSet<>();
        if (type == ChatConversationType.DIRECT) {
            for (UUID participant : directParticipants) {
                if (projects.isMember(projectId, participant)) {
                    recipients.add(participant);
                }
            }
            return recipients;
        }
        for (int page = 0; page < MAX_MEMBER_PAGES; page++) {
            Page<ProjectMemberView> members = projects.members(projectId,
                    PageRequest.of(page, MEMBER_PAGE, Sort.by("joinedAt").ascending().and(Sort.by("id"))));
            members.forEach(member -> recipients.add(member.userId()));
            if (!members.hasNext()) {
                break;
            }
        }
        return recipients;
    }
}
