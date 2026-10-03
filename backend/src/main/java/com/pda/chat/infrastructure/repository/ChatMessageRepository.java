package com.pda.chat.infrastructure.repository;

import com.pda.chat.domain.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    /** Cursor lookup: the cursor message must belong to the conversation being read. */
    Optional<ChatMessage> findByIdAndConversationId(UUID id, UUID conversationId);

    /** Newest first. */
    @Query(value = """
            select * from chat_messages
            where conversation_id = :conversationId
            order by created_at desc, id desc
            limit :limit
            """, nativeQuery = true)
    List<ChatMessage> findLatest(@Param("conversationId") UUID conversationId, @Param("limit") int limit);

    /** Keyset page of older messages, newest first: strictly before the cursor in (created_at, id) order. */
    @Query(value = """
            select * from chat_messages
            where conversation_id = :conversationId and (created_at, id) < (:createdAt, :id)
            order by created_at desc, id desc
            limit :limit
            """, nativeQuery = true)
    List<ChatMessage> findBefore(@Param("conversationId") UUID conversationId, @Param("createdAt") Instant createdAt,
                                 @Param("id") UUID id, @Param("limit") int limit);

    /** Catch-up page of newer messages, oldest first: strictly after the cursor in (created_at, id) order. */
    @Query(value = """
            select * from chat_messages
            where conversation_id = :conversationId and (created_at, id) > (:createdAt, :id)
            order by created_at asc, id asc
            limit :limit
            """, nativeQuery = true)
    List<ChatMessage> findAfter(@Param("conversationId") UUID conversationId, @Param("createdAt") Instant createdAt,
                                @Param("id") UUID id, @Param("limit") int limit);

    /** The latest message of each given conversation, in one query. */
    @Query(value = """
            select distinct on (conversation_id) *
            from chat_messages
            where conversation_id in (:conversationIds)
            order by conversation_id, created_at desc, id desc
            """, nativeQuery = true)
    List<ChatMessage> findLastMessages(@Param("conversationIds") Collection<UUID> conversationIds);

    /**
     * Unread messages per conversation of one project for one user, in one aggregate. A message is unread when
     * somebody else wrote it after the user's read marker; the project group additionally ignores everything from
     * before the user joined the project, so a new member is not flooded with history. Rows: [conversation id, count].
     */
    @Query(value = """
            select m.conversation_id, count(*)
            from chat_messages m
            join chat_conversations c on c.id = m.conversation_id
            left join chat_read_states r on r.conversation_id = c.id and r.user_id = :userId
            where c.project_id = :projectId
              and (c.type = 'PROJECT' or :userId in (c.direct_user_low, c.direct_user_high))
              and m.sender_user_id <> :userId
              and m.created_at > greatest(
                    coalesce(r.last_read_at, cast('-infinity' as timestamptz)),
                    case when c.type = 'PROJECT' then cast(:groupFloor as timestamptz)
                         else cast('-infinity' as timestamptz) end)
            group by m.conversation_id
            """, nativeQuery = true)
    List<Object[]> unreadCounts(@Param("projectId") UUID projectId, @Param("userId") UUID userId,
                                @Param("groupFloor") Instant groupFloor);
}
