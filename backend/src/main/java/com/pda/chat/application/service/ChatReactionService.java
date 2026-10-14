package com.pda.chat.application.service;

import com.pda.chat.application.service.ChatViews.ReactionSnapshot;
import com.pda.chat.domain.ChatException;
import com.pda.chat.domain.enums.ChatReactionCode;
import com.pda.chat.infrastructure.repository.ChatMessageRepository;
import com.pda.chat.infrastructure.repository.ChatReactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

@Service
public class ChatReactionService {
    private final ChatService access;
    private final ChatMessageRepository messages;
    private final ChatReactionRepository reactions;
    private final ChatReactionViewReader views;
    private final ChatReactionRateLimiter limits;
    private final Clock clock;
    private final ChatDelivery delivery;
    private final com.pda.user.UserAccounts users;
    public ChatReactionService(ChatService access,ChatMessageRepository messages,ChatReactionRepository reactions,
                               ChatReactionViewReader views,ChatReactionRateLimiter limits,Clock clock,ChatDelivery delivery,com.pda.user.UserAccounts users) {
        this.access=access;this.messages=messages;this.reactions=reactions;this.views=views;this.limits=limits;this.clock=clock;
        this.delivery=delivery;
        this.users=users;
    }
    @Transactional public ReactionSnapshot put(UUID actor,UUID project,UUID conversation,UUID message,String code) {
        return change(actor,project,conversation,message,code,true);
    }
    @Transactional public ReactionSnapshot remove(UUID actor,UUID project,UUID conversation,UUID message,String code) {
        return change(actor,project,conversation,message,code,false);
    }
    private ReactionSnapshot change(UUID actor,UUID project,UUID conversation,UUID message,String rawCode,boolean add) {
        var scope=access.accessible(actor,project,conversation);
        ChatReactionCode code=ChatReactionCode.parse(rawCode);
        if(!limits.tryAcquire(actor))throw new ChatException(ChatException.Kind.RATE_LIMITED,"CHAT_REACTION_RATE_LIMITED");
        var target=messages.lockByIdAndConversationId(message,conversation).orElseThrow(()->ChatException.notFound("CHAT_NOT_FOUND"));
        if(target.isDeleted())throw ChatException.notFound("CHAT_NOT_FOUND");
        int changed=add?reactions.add(message,actor,code,clock.instant()):reactions.remove(message,actor,code);
        if(changed>0){
            target.reactionsChanged();messages.flush();
            var participants=scope.getType()==com.pda.chat.domain.enums.ChatConversationType.DIRECT
                    ?java.util.Set.of(scope.getDirectUserLow(),scope.getDirectUserHigh()):java.util.Set.<UUID>of();
            var event=new ChatDelivery.ChatReactionsChanged(scope.getProjectId(),conversation,scope.getType(),participants,message,target.getReactionVersion());
            ChatService.afterCommit(()->delivery.reactionsChanged(event));
        }
        return views.forActor(conversation,List.of(message),actor).get(message);
    }
    @Transactional(readOnly=true) public List<ReactionSnapshot> snapshots(UUID actor,UUID project,UUID conversation,List<UUID> ids) {
        access.accessible(actor,project,conversation);
        if(ids==null||ids.isEmpty()||ids.size()>50||ids.stream().anyMatch(java.util.Objects::isNull))throw ChatException.invalid("CHAT_INVALID_REQUEST");
        var unique=new LinkedHashSet<>(ids);
        var found=views.forActor(conversation,unique,actor);
        if(found.size()!=unique.size())throw ChatException.notFound("CHAT_NOT_FOUND");
        return unique.stream().map(found::get).toList();
    }

    public record ReactorView(String code, ChatViews.ChatUser user) { }
    public record Details(UUID messageId, String reactionVersion, List<ChatViews.ReactionView> reactions,
                          List<ReactorView> users, long total, int page, int size) { }

    @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Details details(UUID actor, UUID project, UUID conversation, List<UUID> ids, String rawCode, int page, int size) {
        access.accessible(actor, project, conversation);
        if (ids == null || ids.size() != 1 || ids.getFirst() == null || page < 0 || size < 1 || size > 50)
            throw ChatException.invalid("CHAT_INVALID_REQUEST");
        UUID message = ids.getFirst();
        var target = messages.findByIdAndConversationId(message, conversation).orElseThrow(() -> ChatException.notFound("CHAT_NOT_FOUND"));
        if (target.isDeleted()) throw ChatException.notFound("CHAT_NOT_FOUND");
        var code = rawCode == null ? null : ChatReactionCode.parse(rawCode);
        var snapshot = views.forActor(conversation, ids, actor).get(message);
        long total = snapshot.reactions().stream().filter(r -> code == null || r.code() == code).mapToLong(ChatViews.ReactionView::count).sum();
        var rows = reactions.reactors(conversation, message, code, page, size);
        var accounts = rows.isEmpty() ? java.util.Map.<UUID, com.pda.user.UserAccounts.AuthenticatedUser>of()
                : users.findActiveByIds(rows.stream().map(ChatReactionRepository.Reactor::userId).collect(java.util.stream.Collectors.toSet()));
        var people = rows.stream().map(row -> {
            var user = accounts.get(row.userId());
            return new ReactorView(row.code().name(), new ChatViews.ChatUser(row.userId(), user == null ? null : user.nickname(), user == null ? null : user.profilePhotoVersion()));
        }).toList();
        return new Details(message, snapshot.reactionVersion(), snapshot.reactions(), people, total, page, size);
    }
}
