package com.pda.meeting.internal;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

public interface MeetingChatReactionRepository extends JpaRepository<MeetingChatReaction,MeetingChatReaction.Key> {
    /** All reactions of a page of messages in one query (no query per message). */
    List<MeetingChatReaction> findByMessageIdInOrderByCreatedAtAscEmojiAsc(Collection<UUID> messageIds);
    @Query("select count(distinct r.emoji) from MeetingChatReaction r where r.messageId=:message") long distinctEmojis(@Param("message") UUID message);
    @Query("select count(r) from MeetingChatReaction r where r.messageId=:message and r.participantId=:participant") long byParticipant(@Param("message") UUID message,@Param("participant") UUID participant);
    @Query("select count(r) from MeetingChatReaction r where r.messageId=:message and r.emoji=:emoji") long withEmoji(@Param("message") UUID message,@Param("emoji") String emoji);
    @Query("select count(r) from MeetingChatReaction r where r.messageId=:message and r.participantId=:participant and r.emoji=:emoji") long exists(@Param("message") UUID message,@Param("participant") UUID participant,@Param("emoji") String emoji);
    /** Idempotent and safe against two taps at once: the key decides, never a read-then-write. */
    @Modifying @Transactional
    @Query(value="INSERT INTO meeting_chat_reactions(message_id,participant_id,emoji,created_at) VALUES (:message,:participant,:emoji,:at) ON CONFLICT DO NOTHING",nativeQuery=true)
    int add(@Param("message") UUID message,@Param("participant") UUID participant,@Param("emoji") String emoji,@Param("at") Instant at);
    /** Only ever the caller's own row: the participant is part of the key. */
    @Modifying @Transactional
    @Query(value="DELETE FROM meeting_chat_reactions WHERE message_id=:message AND participant_id=:participant AND emoji=:emoji",nativeQuery=true)
    int remove(@Param("message") UUID message,@Param("participant") UUID participant,@Param("emoji") String emoji);
}
