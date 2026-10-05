package com.pda.chat.infrastructure.repository;

import com.pda.chat.domain.enums.ChatReactionCode;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.Array;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Counts, version and viewer flags come from one PostgreSQL statement snapshot. */
@Repository
public class ChatReactionRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public ChatReactionRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Row(UUID messageId, long version, ChatReactionCode code, long count, Set<UUID> viewers) { }

    public List<Row> snapshots(UUID conversationId, Collection<UUID> messageIds, Collection<UUID> viewers) {
        if (messageIds.isEmpty() || viewers.isEmpty()) return List.of();
        return jdbc.query("""
                select m.id, m.reaction_version, r.emoji_code, count(r.user_id) as reaction_count,
                    array_agg(r.user_id) filter (where r.user_id in (:viewers)) as mine_users
                from chat_messages m
                left join chat_message_reactions r on r.message_id = m.id
                where m.conversation_id = :conversation and m.id in (:messages)
                group by m.id, m.reaction_version, r.emoji_code
                order by m.id, r.emoji_code
                """, Map.of("conversation", conversationId, "messages", messageIds, "viewers", viewers),
                (rs, row) -> new Row(rs.getObject("id", UUID.class), rs.getLong("reaction_version"),
                        rs.getString("emoji_code") == null ? null : ChatReactionCode.valueOf(rs.getString("emoji_code")),
                        rs.getLong("reaction_count"), viewerIds(rs.getArray("mine_users"))));
    }
    private static Set<UUID> viewerIds(Array array) throws SQLException {
        if (array == null) return Set.of();
        try { return Arrays.stream((Object[]) array.getArray()).map(value -> UUID.fromString(value.toString())).collect(Collectors.toUnmodifiableSet()); }
        finally { array.free(); }
    }
    public int add(UUID message, UUID actor, ChatReactionCode code, Instant now) {
        return jdbc.update("""
                insert into chat_message_reactions(message_id,user_id,emoji_code,created_at)
                values (:message,:actor,:code,:now) on conflict do nothing
                """,Map.of("message",message,"actor",actor,"code",code.name(),"now",java.sql.Timestamp.from(now)));
    }
    public int remove(UUID message, UUID actor, ChatReactionCode code) {
        return jdbc.update("delete from chat_message_reactions where message_id=:message and user_id=:actor and emoji_code=:code",
                Map.of("message",message,"actor",actor,"code",code.name()));
    }
}
