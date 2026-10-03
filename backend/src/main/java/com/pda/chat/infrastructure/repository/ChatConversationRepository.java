package com.pda.chat.infrastructure.repository;

import com.pda.chat.domain.entity.ChatConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatConversationRepository extends JpaRepository<ChatConversation, UUID> {

    /** The pair lookup is what keeps /projects/B/chat/conversations/{id of a project A conversation} a 404. */
    Optional<ChatConversation> findByIdAndProjectId(UUID id, UUID projectId);

    @Query("""
            select c from ChatConversation c
            where c.projectId = :projectId and c.type = com.pda.chat.domain.enums.ChatConversationType.PROJECT
            """)
    Optional<ChatConversation> findGroup(@Param("projectId") UUID projectId);

    @Query("""
            select c from ChatConversation c
            where c.projectId = :projectId and c.type = com.pda.chat.domain.enums.ChatConversationType.DIRECT
              and c.directUserLow = :low and c.directUserHigh = :high
            """)
    Optional<ChatConversation> findDirect(@Param("projectId") UUID projectId, @Param("low") UUID low,
                                          @Param("high") UUID high);

    /** The direct conversations the user takes part in, in one project, from either side of the stored pair. */
    @Query("""
            select c from ChatConversation c
            where c.projectId = :projectId and c.type = com.pda.chat.domain.enums.ChatConversationType.DIRECT
              and (c.directUserLow = :userId or c.directUserHigh = :userId)
            """)
    List<ChatConversation> findDirectsOf(@Param("projectId") UUID projectId, @Param("userId") UUID userId);

    /**
     * Race-safe create: two concurrent first uses both insert, the unique index lets exactly one row in, and the
     * loser (0 rows) reads the winner's row. No duplicate group can exist.
     */
    @Modifying
    @Query(value = """
            insert into chat_conversations (id, project_id, type, created_at)
            values (:id, :projectId, 'PROJECT', :createdAt)
            on conflict do nothing
            """, nativeQuery = true)
    int insertGroupIfAbsent(@Param("id") UUID id, @Param("projectId") UUID projectId,
                            @Param("createdAt") Instant createdAt);

    @Modifying
    @Query(value = """
            insert into chat_conversations (id, project_id, type, direct_user_low, direct_user_high, created_at)
            values (:id, :projectId, 'DIRECT', :low, :high, :createdAt)
            on conflict do nothing
            """, nativeQuery = true)
    int insertDirectIfAbsent(@Param("id") UUID id, @Param("projectId") UUID projectId, @Param("low") UUID low,
                             @Param("high") UUID high, @Param("createdAt") Instant createdAt);

    /** Monotonic, so two concurrent sends cannot move the timestamp backwards. */
    @Modifying
    @Query(value = """
            update chat_conversations
            set last_message_at = greatest(coalesce(last_message_at, :at), :at)
            where id = :id
            """, nativeQuery = true)
    int touch(@Param("id") UUID id, @Param("at") Instant at);
}
