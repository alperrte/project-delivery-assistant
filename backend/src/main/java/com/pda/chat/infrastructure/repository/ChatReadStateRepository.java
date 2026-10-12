package com.pda.chat.infrastructure.repository;

import com.pda.chat.domain.entity.ChatReadState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ChatReadStateRepository extends JpaRepository<ChatReadState, ChatReadState.Key> {

    /** The read markers of everybody in the conversation except the given user ("seen by"). */
    @Query("select r from ChatReadState r where r.conversationId = :conversationId and r.userId <> :userId")
    List<ChatReadState> findOthers(@Param("conversationId") UUID conversationId, @Param("userId") UUID userId);

    /** Moves the read marker forward only; a late or duplicate request can never make messages unread again. */
    @Modifying
    @Query(value = """
            insert into chat_read_states (conversation_id, user_id, last_read_at)
            values (:conversationId, :userId, :readAt)
            on conflict (conversation_id, user_id)
            do update set last_read_at = greatest(chat_read_states.last_read_at, excluded.last_read_at)
            """, nativeQuery = true)
    int markRead(@Param("conversationId") UUID conversationId, @Param("userId") UUID userId,
                 @Param("readAt") Instant readAt);
}
