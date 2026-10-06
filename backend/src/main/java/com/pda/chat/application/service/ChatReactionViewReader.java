package com.pda.chat.application.service;

import com.pda.chat.application.service.ChatViews.ReactionSnapshot;
import com.pda.chat.application.service.ChatViews.ReactionView;
import com.pda.chat.infrastructure.repository.ChatReactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ChatReactionViewReader {
    private final ChatReactionRepository reactions;
    public ChatReactionViewReader(ChatReactionRepository reactions) { this.reactions = reactions; }

    public record RawSnapshot(UUID messageId, String version, List<ChatReactionRepository.Row> rows) {
        public ReactionSnapshot forUser(UUID actor) {
            return new ReactionSnapshot(messageId,version,rows.stream().filter(row -> row.code() != null)
                    .sorted(java.util.Comparator.comparingInt(row -> row.code().ordinal()))
                    .map(row -> new ReactionView(row.code(),row.code().emoji(),row.count(),row.viewers().contains(actor))).toList());
        }
    }
    @Transactional(readOnly = true)
    public Map<UUID, ReactionSnapshot> forActor(UUID conversation, Collection<UUID> ids, UUID actor) {
        Map<UUID, ReactionSnapshot> result = new LinkedHashMap<>();
        read(conversation,ids,List.of(actor)).forEach((id,snapshot) -> result.put(id,snapshot.forUser(actor)));
        return result;
    }
    // After-commit callbacks cannot reuse the already committed persistence context.
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Map<UUID, RawSnapshot> forDelivery(UUID conversation, Collection<UUID> ids, Collection<UUID> recipients) {
        return read(conversation,ids,recipients);
    }
    private Map<UUID, RawSnapshot> read(UUID conversation, Collection<UUID> ids, Collection<UUID> viewers) {
        Map<UUID,List<ChatReactionRepository.Row>> grouped = new LinkedHashMap<>();
        for(var row : reactions.snapshots(conversation,ids,viewers)) grouped.computeIfAbsent(row.messageId(), ignored -> new ArrayList<>()).add(row);
        Map<UUID,RawSnapshot> result = new LinkedHashMap<>();
        grouped.forEach((id,rows) -> result.put(id,new RawSnapshot(id,Long.toString(rows.getFirst().version()),List.copyOf(rows))));
        return result;
    }
}
