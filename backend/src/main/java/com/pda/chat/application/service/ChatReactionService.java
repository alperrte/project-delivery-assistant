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
    public ChatReactionService(ChatService access,ChatMessageRepository messages,ChatReactionRepository reactions,
                               ChatReactionViewReader views,ChatReactionRateLimiter limits,Clock clock,ChatDelivery delivery) {
        this.access=access;this.messages=messages;this.reactions=reactions;this.views=views;this.limits=limits;this.clock=clock;
        this.delivery=delivery;
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
        int changed=add?reactions.add(message,actor,code,clock.instant()):reactions.remove(message,actor,code);
        if(changed>0){
            target.reactionsChanged();messages.flush();
            var participants=scope.getType()==com.pda.chat.domain.enums.ChatConversationType.DIRECT
                    ?java.util.Set.of(scope.getDirectUserLow(),scope.getDirectUserHigh()):java.util.Set.<UUID>of();
            var event=new ChatDelivery.ChatReactionsChanged(project,conversation,scope.getType(),participants,message,target.getReactionVersion());
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
}
