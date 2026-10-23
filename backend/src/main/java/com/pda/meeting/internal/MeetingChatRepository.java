package com.pda.meeting.internal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface MeetingChatRepository extends JpaRepository<MeetingChatMessage,UUID> {
    Page<MeetingChatMessage> findByMeetingId(UUID meetingId,Pageable pageable);
    void deleteByMeetingId(UUID meetingId);
    Optional<MeetingChatMessage> findByIdAndMeetingId(UUID id,UUID meetingId);
    /** How many messages come before this one in the newest-first history order (sent_at DESC, id DESC): its position. */
    @Query("select count(m) from MeetingChatMessage m where m.meetingId=:meeting and (m.sentAt>:sentAt or (m.sentAt=:sentAt and m.id>:id))")
    long newerThan(@Param("meeting") UUID meeting,@Param("sentAt") Instant sentAt,@Param("id") UUID id);
}
